#pragma once

#include <atomic>
#include <cstdint>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <vector>
#include <media/NdkMediaCodec.h>
#include <media/NdkMediaExtractor.h>
#include <media/NdkMediaFormat.h>
#include "PcmRingBuffer.h"
#include "RenderGate.h"

namespace remixer {

class AudioDecoder {
 public:
  AudioDecoder();
  ~AudioDecoder();

  AudioDecoder(const AudioDecoder&) = delete;
  AudioDecoder& operator=(const AudioDecoder&) = delete;

  bool open(int fd, int64_t offset, int64_t length, int targetSampleRate);
  void setDeckId(char id) noexcept { deckId_ = id; }
  char getDeckId() const noexcept { return deckId_; }
  void start();
  void stop();
  void release();
  bool seekTo(int64_t positionUs);

  void setRate(float rate) noexcept {
    rate_.store(std::isfinite(rate) ? std::clamp(rate, 0.46f, 2.16f) : 1.0f, std::memory_order_relaxed);
  }
  float getRate() const noexcept { return rate_.load(std::memory_order_relaxed); }
  void render(float* output, int32_t frames, int32_t channels) noexcept;

  bool isLoaded() const noexcept { return isLoaded_.load(std::memory_order_relaxed); }
  bool isPlaying() const noexcept { return isPlaying_.load(std::memory_order_relaxed); }
  bool isEof() const noexcept { return isEof_.load(std::memory_order_relaxed); }

  int getTrackSampleRate() const noexcept { return trackSampleRate_; }
  int getTrackChannels() const noexcept { return trackChannels_; }
  int64_t getDurationUs() const noexcept { return durationUs_; }
  int64_t getDecodedFrames() const noexcept { return decodedFrames_.load(std::memory_order_relaxed); }
  int64_t getPlayedFrames() const noexcept { return playedFrames_.load(std::memory_order_relaxed); }
  size_t getBufferedFrames() const noexcept { return ringBuffer_.availableRead(); }

  // Diagnostics required by Phase 3.2
  size_t getMinBufferedFrames() const noexcept { return minBufferedFrames_.load(std::memory_order_relaxed); }
  size_t getMaxBufferedFrames() const noexcept { return maxBufferedFrames_.load(std::memory_order_relaxed); }
  size_t getAverageBufferedFrames() const noexcept {
    const size_t count = bufferedSampleCount_.load(std::memory_order_relaxed);
    return count > 0 ? (bufferedSumFrames_.load(std::memory_order_relaxed) / count) : 0;
  }
  uint64_t getAudioUnderrunCount() const noexcept { return audioUnderrunCount_.load(std::memory_order_relaxed); }
  uint64_t getUnderrunFrames() const noexcept { return underrunFrames_.load(std::memory_order_relaxed); }
  uint64_t getDecoderLoopIterations() const noexcept { return decoderLoopIterations_.load(std::memory_order_relaxed); }
  uint64_t getDecoderStalls() const noexcept { return decoderStalls_.load(std::memory_order_relaxed); }
  uint64_t getCodecInputCount() const noexcept { return codecInputCount_.load(std::memory_order_relaxed); }
  uint64_t getCodecOutputCount() const noexcept { return codecOutputCount_.load(std::memory_order_relaxed); }
  uint64_t getResamplerOutputFrames() const noexcept { return resamplerOutputFrames_.load(std::memory_order_relaxed); }
  uint64_t getRingBufferWriteFailures() const noexcept { return ringBufferWriteFailures_.load(std::memory_order_relaxed); }
  uint64_t getRingBufferReadUnderruns() const noexcept { return ringBufferReadUnderruns_.load(std::memory_order_relaxed); }
  std::string getPcmEncodingName() const;

 private:
  void decodeThreadLoop();
  void cleanupLocked();

  RenderGate renderGate_;
  std::mutex controlMutex_;
  std::thread decodeThread_;
  std::atomic<bool> stopRequested_{false};
  std::atomic<bool> isLoaded_{false};
  std::atomic<bool> isPlaying_{false};
  std::atomic<bool> isEof_{false};
  char deckId_ = 'A';

  int trackFd_ = -1;
  int64_t trackOffset_ = 0;
  int64_t trackLength_ = 0;
  int targetSampleRate_ = 48000;

  int trackSampleRate_ = 0;
  int trackChannels_ = 0;
  int64_t durationUs_ = 0;
  int pcmEncoding_ = 2; // 2 = PCM_16BIT, 4 = PCM_FLOAT
  std::string mimeType_;

  AMediaExtractor* extractor_ = nullptr;
  AMediaCodec* codec_ = nullptr;

  // 128k frames = ~2.73s at 48 kHz
  PcmRingBuffer ringBuffer_{131072};
  std::atomic<float> rate_{1.0f};
  double currentRate_ = 1.0; // Audio callback only while the render gate is open.

  std::atomic<int64_t> decodedFrames_{0};
  std::atomic<int64_t> playedFrames_{0};

  // Real-time diagnostics
  std::atomic<size_t> minBufferedFrames_{SIZE_MAX};
  std::atomic<size_t> maxBufferedFrames_{0};
  std::atomic<uint64_t> bufferedSumFrames_{0};
  std::atomic<uint64_t> bufferedSampleCount_{0};
  std::atomic<uint64_t> audioUnderrunCount_{0};
  std::atomic<uint64_t> underrunFrames_{0};
  std::atomic<uint64_t> decoderLoopIterations_{0};
  std::atomic<uint64_t> decoderStalls_{0};
  std::atomic<uint64_t> codecInputCount_{0};
  std::atomic<uint64_t> codecOutputCount_{0};
  std::atomic<uint64_t> resamplerOutputFrames_{0};
  std::atomic<uint64_t> ringBufferWriteFailures_{0};
  std::atomic<uint64_t> ringBufferReadUnderruns_{0};

  // Preallocated resampler scratch buffer (reused without reallocations)
  std::vector<float> resampleOutBuffer_;
};

} // namespace remixer
