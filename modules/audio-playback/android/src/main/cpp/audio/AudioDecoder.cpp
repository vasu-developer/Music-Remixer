#include "AudioDecoder.h"
#include <android/log.h>
#include <unistd.h>
#include <chrono>
#include <cmath>
#include <cstring>
#include <sys/resource.h>

namespace remixer {
namespace {
constexpr auto kTag = "RemixerDecoder";
}

AudioDecoder::AudioDecoder() {
  resampleOutBuffer_.resize(32768 * 2);
}

AudioDecoder::~AudioDecoder() {
  release();
}

std::string AudioDecoder::getPcmEncodingName() const {
  if (pcmEncoding_ == 4) return "PCM_FLOAT";
  if (pcmEncoding_ == 2) return "PCM_16BIT";
  return "PCM_OTHER (" + std::to_string(pcmEncoding_) + ")";
}

bool AudioDecoder::open(int fd, int64_t offset, int64_t length, int targetSampleRate) {
  std::lock_guard<std::mutex> lock(controlMutex_);
  cleanupLocked();

  if (fd < 0 || targetSampleRate <= 0) {
    __android_log_print(ANDROID_LOG_ERROR, kTag, "Invalid arguments: fd=%d, rate=%d", fd, targetSampleRate);
    if (fd >= 0) ::close(fd);
    return false;
  }

  trackFd_ = fd;
  trackOffset_ = offset;
  trackLength_ = length;
  targetSampleRate_ = targetSampleRate;

  extractor_ = AMediaExtractor_new();
  if (!extractor_) {
    __android_log_print(ANDROID_LOG_ERROR, kTag, "Failed to create AMediaExtractor");
    ::close(trackFd_);
    trackFd_ = -1;
    return false;
  }

  media_status_t status = AMediaExtractor_setDataSourceFd(extractor_, trackFd_, trackOffset_, trackLength_);
  if (status != AMEDIA_OK) {
    __android_log_print(ANDROID_LOG_ERROR, kTag, "AMediaExtractor_setDataSourceFd failed: %d", status);
    cleanupLocked();
    return false;
  }

  size_t numTracks = AMediaExtractor_getTrackCount(extractor_);
  int audioTrackIdx = -1;
  AMediaFormat* format = nullptr;

  for (size_t i = 0; i < numTracks; ++i) {
    format = AMediaExtractor_getTrackFormat(extractor_, i);
    const char* mime = nullptr;
    if (AMediaFormat_getString(format, AMEDIAFORMAT_KEY_MIME, &mime) && mime) {
      if (strncmp(mime, "audio/", 6) == 0) {
        audioTrackIdx = static_cast<int>(i);
        mimeType_ = mime;
        break;
      }
    }
    AMediaFormat_delete(format);
    format = nullptr;
  }

  if (audioTrackIdx < 0 || !format) {
    __android_log_print(ANDROID_LOG_ERROR, kTag, "No audio track found in media container");
    cleanupLocked();
    return false;
  }

  AMediaExtractor_selectTrack(extractor_, audioTrackIdx);

  int32_t sampleRate = 0, channels = 0;
  int64_t duration = 0;
  AMediaFormat_getInt32(format, AMEDIAFORMAT_KEY_SAMPLE_RATE, &sampleRate);
  AMediaFormat_getInt32(format, AMEDIAFORMAT_KEY_CHANNEL_COUNT, &channels);
  AMediaFormat_getInt64(format, AMEDIAFORMAT_KEY_DURATION, &duration);

  int32_t encoding = 2; // Default to PCM 16-bit
  if (AMediaFormat_getInt32(format, "pcm-encoding", &encoding)) {
    pcmEncoding_ = encoding;
  } else {
    pcmEncoding_ = 2;
  }

  trackSampleRate_ = sampleRate;
  trackChannels_ = channels;
  durationUs_ = duration;

  codec_ = AMediaCodec_createDecoderByType(mimeType_.c_str());
  if (!codec_) {
    __android_log_print(ANDROID_LOG_ERROR, kTag, "Failed to create decoder for mime %s", mimeType_.c_str());
    AMediaFormat_delete(format);
    cleanupLocked();
    return false;
  }

  status = AMediaCodec_configure(codec_, format, nullptr, nullptr, 0);
  AMediaFormat_delete(format);
  if (status != AMEDIA_OK) {
    __android_log_print(ANDROID_LOG_ERROR, kTag, "AMediaCodec_configure failed: %d", status);
    cleanupLocked();
    return false;
  }

  status = AMediaCodec_start(codec_);
  if (status != AMEDIA_OK) {
    __android_log_print(ANDROID_LOG_ERROR, kTag, "AMediaCodec_start failed: %d", status);
    cleanupLocked();
    return false;
  }

  ringBuffer_.clear();
  decodedFrames_.store(0, std::memory_order_relaxed);
  playedFrames_.store(0, std::memory_order_relaxed);
  isEof_.store(false, std::memory_order_relaxed);
  stopRequested_.store(false, std::memory_order_relaxed);
  isLoaded_.store(true, std::memory_order_relaxed);

  // Reset diagnostic metrics
  minBufferedFrames_.store(SIZE_MAX, std::memory_order_relaxed);
  maxBufferedFrames_.store(0, std::memory_order_relaxed);
  bufferedSumFrames_.store(0, std::memory_order_relaxed);
  bufferedSampleCount_.store(0, std::memory_order_relaxed);
  audioUnderrunCount_.store(0, std::memory_order_relaxed);
  underrunFrames_.store(0, std::memory_order_relaxed);
  decoderLoopIterations_.store(0, std::memory_order_relaxed);
  decoderStalls_.store(0, std::memory_order_relaxed);
  codecInputCount_.store(0, std::memory_order_relaxed);
  codecOutputCount_.store(0, std::memory_order_relaxed);
  resamplerOutputFrames_.store(0, std::memory_order_relaxed);
  ringBufferWriteFailures_.store(0, std::memory_order_relaxed);
  ringBufferReadUnderruns_.store(0, std::memory_order_relaxed);

  if (resampleOutBuffer_.size() < 32768 * 2) {
    resampleOutBuffer_.resize(32768 * 2);
  }


  renderGate_.resume();
  decodeThread_ = std::thread(&AudioDecoder::decodeThreadLoop, this);
  return true;
}

void AudioDecoder::start() {
  if (isLoaded_.load(std::memory_order_acquire)) {
    isPlaying_.store(true, std::memory_order_release);

  }
}

void AudioDecoder::stop() {
  isPlaying_.store(false, std::memory_order_release);

}


bool AudioDecoder::seekTo(int64_t positionUs) {
  std::lock_guard<std::mutex> lock(controlMutex_);
  if (!isLoaded_.load(std::memory_order_relaxed) || !extractor_ || !codec_) {
    return false;
  }

  const bool wasPlaying = isPlaying_.exchange(false);
  renderGate_.suspend();
  stopRequested_.store(true);
  if (decodeThread_.joinable()) decodeThread_.join();
  // Only this control thread owns the codec/extractor now; no active reader.
  positionUs = std::clamp<int64_t>(positionUs, 0, durationUs_);
  media_status_t status = AMediaExtractor_seekTo(extractor_, positionUs, AMEDIAEXTRACTOR_SEEK_CLOSEST_SYNC);
  if (status != AMEDIA_OK) {
    status = AMediaExtractor_seekTo(extractor_, positionUs, AMEDIAEXTRACTOR_SEEK_PREVIOUS_SYNC);
  }
  const media_status_t flushed = AMediaCodec_flush(codec_);
  ringBuffer_.clear();
  if (status != AMEDIA_OK || flushed != AMEDIA_OK) {
    isLoaded_.store(false);
    return false;
  }
  int64_t actualPtsUs = AMediaExtractor_getSampleTime(extractor_);
  if (actualPtsUs < 0) actualPtsUs = positionUs;
  playedFrames_.store((actualPtsUs * targetSampleRate_) / 1000000);
  decodedFrames_.store(playedFrames_.load());
  isEof_.store(false);
  stopRequested_.store(false);
  renderGate_.resume();
  // A new worker resets EOS and resampler history instead of reusing stale PCM.
  decodeThread_ = std::thread(&AudioDecoder::decodeThreadLoop, this);
  isPlaying_.store(wasPlaying);

  return true;
}

void AudioDecoder::release() {
  std::lock_guard<std::mutex> lock(controlMutex_);
  cleanupLocked();
}

void AudioDecoder::cleanupLocked() {
  renderGate_.suspend();
  stopRequested_.store(true, std::memory_order_relaxed);
  isPlaying_.store(false, std::memory_order_relaxed);

  if (decodeThread_.joinable()) {
    decodeThread_.join();
  }

  if (codec_) {
    AMediaCodec_stop(codec_);
    AMediaCodec_delete(codec_);
    codec_ = nullptr;
  }

  if (extractor_) {
    AMediaExtractor_delete(extractor_);
    extractor_ = nullptr;
  }

  if (trackFd_ >= 0) {
    ::close(trackFd_);
    trackFd_ = -1;
  }

  ringBuffer_.clear();
  isLoaded_.store(false, std::memory_order_relaxed);
  isEof_.store(false, std::memory_order_relaxed);
  decodedFrames_.store(0, std::memory_order_relaxed);
  playedFrames_.store(0, std::memory_order_relaxed);
}

void AudioDecoder::render(float* output, int32_t frames, int32_t channels) noexcept {
  if (!renderGate_.enter()) {
    std::memset(output, 0, frames * channels * sizeof(float));
    return;
  }
  struct Exit { RenderGate& gate; ~Exit() { gate.leave(); } } exit{renderGate_};
  if (!isPlaying_.load(std::memory_order_relaxed) || !isLoaded_.load(std::memory_order_relaxed)) {
    std::memset(output, 0, frames * channels * sizeof(float));
    return;
  }

  const size_t avail = ringBuffer_.availableRead();

  // Diagnostics tracking
  size_t curMin = minBufferedFrames_.load(std::memory_order_relaxed);
  while (avail < curMin && !minBufferedFrames_.compare_exchange_weak(curMin, avail, std::memory_order_relaxed)) {}

  size_t curMax = maxBufferedFrames_.load(std::memory_order_relaxed);
  while (avail > curMax && !maxBufferedFrames_.compare_exchange_weak(curMax, avail, std::memory_order_relaxed)) {}

  bufferedSumFrames_.fetch_add(avail, std::memory_order_relaxed);
  bufferedSampleCount_.fetch_add(1, std::memory_order_relaxed);

  const auto result = ringBuffer_.readAtRate(output, frames, rate_.load(std::memory_order_relaxed),
      currentRate_, 1.0 / (0.02 * targetSampleRate_), isEof_.load(std::memory_order_acquire));
  if (result.outputFrames < static_cast<size_t>(frames) && !isEof_.load(std::memory_order_acquire)) {
    audioUnderrunCount_.fetch_add(1, std::memory_order_relaxed);
    ringBufferReadUnderruns_.fetch_add(1, std::memory_order_relaxed);
    underrunFrames_.fetch_add(static_cast<size_t>(frames) - result.outputFrames, std::memory_order_relaxed);
  }
  playedFrames_.fetch_add(result.consumedFrames, std::memory_order_relaxed);
  if (isEof_.load(std::memory_order_acquire) && ringBuffer_.availableRead() == 0) {
    isPlaying_.store(false, std::memory_order_release);
  }
}

void AudioDecoder::decodeThreadLoop() {
  setpriority(PRIO_PROCESS, 0, 10);


  bool sawInputEos = false;
  int currentSampleRate = trackSampleRate_ > 0 ? trackSampleRate_ : 44100;
  int currentChannels = trackChannels_ > 0 ? trackChannels_ : 2;

  // Stateful continuous resampler across codec buffer boundaries
  bool hasPrevSample = false;
  float prevSampleL = 0.0f;
  float prevSampleR = 0.0f;
  double nextBufferT = 0.0;

  while (!stopRequested_.load(std::memory_order_relaxed)) {
    decoderLoopIterations_.fetch_add(1, std::memory_order_relaxed);

    // Check if deck is paused and has adequate prebuffer to yield CPU
    if (!isPlaying_.load(std::memory_order_relaxed) && ringBuffer_.availableRead() >= 24000) {
      std::this_thread::sleep_for(std::chrono::milliseconds(20));
      continue;
    }

    // If ring buffer is nearly full, pause decoding to yield CPU
    // 120,000 frames is ~2.5 seconds of headroom
    if (ringBuffer_.availableWrite() < 8192) {
      decoderStalls_.fetch_add(1, std::memory_order_relaxed);
      std::this_thread::sleep_for(std::chrono::milliseconds(10));
      continue;
    }

    // 1. Feed input buffer (non-blocking)
    if (!sawInputEos) {
      ssize_t inIdx = AMediaCodec_dequeueInputBuffer(codec_, 0);
      if (inIdx >= 0) {
        size_t bufSize = 0;
        uint8_t* inBuf = AMediaCodec_getInputBuffer(codec_, inIdx, &bufSize);
        if (inBuf && bufSize > 0) {
          ssize_t sampleSize = AMediaExtractor_readSampleData(extractor_, inBuf, bufSize);
          if (sampleSize < 0) {
            sawInputEos = true;
            AMediaCodec_queueInputBuffer(codec_, inIdx, 0, 0, 0, AMEDIACODEC_BUFFER_FLAG_END_OF_STREAM);

          } else {
            int64_t pts = AMediaExtractor_getSampleTime(extractor_);
            AMediaCodec_queueInputBuffer(codec_, inIdx, 0, sampleSize, pts, 0);
            AMediaExtractor_advance(extractor_);
            codecInputCount_.fetch_add(1, std::memory_order_relaxed);
          }
        }
      }
    }

    // 2. Drain output buffer (short timeout 1ms)
    AMediaCodecBufferInfo info;
    ssize_t outIdx = AMediaCodec_dequeueOutputBuffer(codec_, &info, 1000);

    if (outIdx >= 0) {
      codecOutputCount_.fetch_add(1, std::memory_order_relaxed);

      if (info.size > 0) {
        size_t outBufSize = 0;
        uint8_t* outBuf = AMediaCodec_getOutputBuffer(codec_, outIdx, &outBufSize);
        if (outBuf) {
          const uint8_t* pcmBytes = outBuf + info.offset;
          size_t inFrames = 0;
          const double rateRatio = static_cast<double>(currentSampleRate) / static_cast<double>(targetSampleRate_);
          size_t outFrameCount = 0;

          if (pcmEncoding_ == 4) {
            // Float PCM
            const float* pcmFloat = reinterpret_cast<const float*>(pcmBytes);
            const size_t totalSamples = info.size / sizeof(float);
            inFrames = (currentChannels > 0) ? (totalSamples / currentChannels) : 0;
            if (inFrames > 0) {
              size_t estOut = static_cast<size_t>(std::ceil(inFrames / rateRatio)) + 8;
              if (resampleOutBuffer_.size() < estOut * 2) {
                resampleOutBuffer_.resize((estOut + 1024) * 2);
              }

              double T = nextBufferT;
              if (hasPrevSample && T < 1.0) {
                float curr0L = pcmFloat[0];
                float curr0R = (currentChannels > 1) ? pcmFloat[1] : curr0L;
                while (T < 1.0) {
                  float f = static_cast<float>(T);
                  resampleOutBuffer_[outFrameCount * 2]     = (1.0f - f) * prevSampleL + f * curr0L;
                  resampleOutBuffer_[outFrameCount * 2 + 1] = (1.0f - f) * prevSampleR + f * curr0R;
                  outFrameCount++;
                  T += rateRatio;
                }
                T -= 1.0;
              }

              while (true) {
                size_t n = static_cast<size_t>(T);
                if (n + 1 >= inFrames) {
                  prevSampleL = pcmFloat[(inFrames - 1) * currentChannels];
                  prevSampleR = (currentChannels > 1) ? pcmFloat[(inFrames - 1) * currentChannels + 1] : prevSampleL;
                  hasPrevSample = true;
                  nextBufferT = T - static_cast<double>(inFrames - 1);
                  break;
                }
                float f = static_cast<float>(T - n);
                float aL = pcmFloat[n * currentChannels];
                float aR = (currentChannels > 1) ? pcmFloat[n * currentChannels + 1] : aL;
                float bL = pcmFloat[(n + 1) * currentChannels];
                float bR = (currentChannels > 1) ? pcmFloat[(n + 1) * currentChannels + 1] : bL;

                resampleOutBuffer_[outFrameCount * 2]     = (1.0f - f) * aL + f * bL;
                resampleOutBuffer_[outFrameCount * 2 + 1] = (1.0f - f) * aR + f * bR;
                outFrameCount++;
                T += rateRatio;
              }
            }
          } else {
            // PCM 16-bit
            const int16_t* pcm16 = reinterpret_cast<const int16_t*>(pcmBytes);
            const size_t totalSamples = info.size / sizeof(int16_t);
            inFrames = (currentChannels > 0) ? (totalSamples / currentChannels) : 0;
            if (inFrames > 0) {
              size_t estOut = static_cast<size_t>(std::ceil(inFrames / rateRatio)) + 8;
              if (resampleOutBuffer_.size() < estOut * 2) {
                resampleOutBuffer_.resize((estOut + 1024) * 2);
              }

              double T = nextBufferT;
              if (hasPrevSample && T < 1.0) {
                float curr0L = pcm16[0] / 32768.0f;
                float curr0R = (currentChannels > 1) ? (pcm16[1] / 32768.0f) : curr0L;
                while (T < 1.0) {
                  float f = static_cast<float>(T);
                  resampleOutBuffer_[outFrameCount * 2]     = (1.0f - f) * prevSampleL + f * curr0L;
                  resampleOutBuffer_[outFrameCount * 2 + 1] = (1.0f - f) * prevSampleR + f * curr0R;
                  outFrameCount++;
                  T += rateRatio;
                }
                T -= 1.0;
              }

              while (true) {
                size_t n = static_cast<size_t>(T);
                if (n + 1 >= inFrames) {
                  prevSampleL = pcm16[(inFrames - 1) * currentChannels] / 32768.0f;
                  prevSampleR = (currentChannels > 1) ? (pcm16[(inFrames - 1) * currentChannels + 1] / 32768.0f) : prevSampleL;
                  hasPrevSample = true;
                  nextBufferT = T - static_cast<double>(inFrames - 1);
                  break;
                }
                float f = static_cast<float>(T - n);
                float aL = pcm16[n * currentChannels] / 32768.0f;
                float aR = (currentChannels > 1) ? (pcm16[n * currentChannels + 1] / 32768.0f) : aL;
                float bL = pcm16[(n + 1) * currentChannels] / 32768.0f;
                float bR = (currentChannels > 1) ? (pcm16[(n + 1) * currentChannels + 1] / 32768.0f) : bL;

                resampleOutBuffer_[outFrameCount * 2]     = (1.0f - f) * aL + f * bL;
                resampleOutBuffer_[outFrameCount * 2 + 1] = (1.0f - f) * aR + f * bR;
                outFrameCount++;
                T += rateRatio;
              }
            }
          }

          if (outFrameCount > 0) {
            resamplerOutputFrames_.fetch_add(outFrameCount, std::memory_order_relaxed);
            size_t written = 0;
            while (written < outFrameCount && !stopRequested_.load(std::memory_order_relaxed)) {
              size_t n = ringBuffer_.write(&resampleOutBuffer_[written * 2], outFrameCount - written);
              written += n;
              if (written < outFrameCount) {
                ringBufferWriteFailures_.fetch_add(1, std::memory_order_relaxed);
                std::this_thread::sleep_for(std::chrono::milliseconds(2));
              }
            }
            decodedFrames_.fetch_add(outFrameCount, std::memory_order_relaxed);
          }
        }
      }

      AMediaCodec_releaseOutputBuffer(codec_, outIdx, false);

      if (info.flags & AMEDIACODEC_BUFFER_FLAG_END_OF_STREAM) {

        isEof_.store(true, std::memory_order_relaxed);
        break;
      }
    } else if (outIdx == AMEDIACODEC_INFO_OUTPUT_FORMAT_CHANGED) {
      AMediaFormat* newFormat = AMediaCodec_getOutputFormat(codec_);
      if (newFormat) {
        AMediaFormat_getInt32(newFormat, AMEDIAFORMAT_KEY_SAMPLE_RATE, &currentSampleRate);
        AMediaFormat_getInt32(newFormat, AMEDIAFORMAT_KEY_CHANNEL_COUNT, &currentChannels);
        int32_t enc = 2;
        if (AMediaFormat_getInt32(newFormat, "pcm-encoding", &enc)) {
          pcmEncoding_ = enc;
        }
        AMediaFormat_delete(newFormat);

      }
    } else if (outIdx == AMEDIACODEC_INFO_TRY_AGAIN_LATER) {
      std::this_thread::sleep_for(std::chrono::milliseconds(2));
    }
  }

}

} // namespace remixer
