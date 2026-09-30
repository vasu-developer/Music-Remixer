#include "RemixerAudioEngine.h"
#include <android/log.h>
#include <sstream>
#include <algorithm>
#include <unistd.h>

namespace remixer {
namespace {
constexpr auto kTag = "RemixerOboe";

}

void RemixerAudioEngine::recordError(oboe::Result result) {
  lastError_ = result;
  __android_log_print(ANDROID_LOG_ERROR, kTag, "%s", oboe::convertToText(result));
}

DeckChannel* RemixerAudioEngine::getDeck(int deckIndex) noexcept {
  return &decks_[deckIndex == 1 ? 1 : 0];
}

const DeckChannel* RemixerAudioEngine::getDeck(int deckIndex) const noexcept {
  return &decks_[deckIndex == 1 ? 1 : 0];
}

bool RemixerAudioEngine::initialize() {
  std::lock_guard<std::mutex> lock(controlMutex_);
  return initializeLocked();
}

bool RemixerAudioEngine::initializeLocked() {
  if (initialized_ && stream_) return true;
  closeLocked();

  for (int attempt = 0; attempt < 3; ++attempt) {
    oboe::AudioStreamBuilder builder;
    builder.setDirection(oboe::Direction::Output)
      ->setPerformanceMode(attempt < 2 ? oboe::PerformanceMode::LowLatency : oboe::PerformanceMode::None)
      ->setSharingMode(attempt == 0 ? oboe::SharingMode::Exclusive : oboe::SharingMode::Shared)
      ->setFormat(oboe::AudioFormat::Float)
      ->setFormatConversionAllowed(true)
      ->setChannelCount(2)
      ->setUsage(oboe::Usage::Media)
      ->setContentType(oboe::ContentType::Music)
      ->setDataCallback(this)->setErrorCallback(this);
    auto result = builder.openStream(stream_);
    if (result != oboe::Result::OK) { recordError(result); stream_.reset(); continue; }
    if (stream_->getFormat() != oboe::AudioFormat::Float || stream_->getSampleRate() <= 0) {
      stream_->close(); stream_.reset(); recordError(oboe::Result::ErrorInvalidFormat); continue;
    }
    sampleRate_ = stream_->getSampleRate();
    channels_ = stream_->getChannelCount();
    framesPerBurst_ = stream_->getFramesPerBurst();
    stream_->setBufferSizeInFrames(framesPerBurst_ * 2);
    bufferSize_ = stream_->getBufferSizeInFrames();
    format_ = stream_->getFormat(); performance_ = stream_->getPerformanceMode();
    sharing_ = stream_->getSharingMode(); api_ = stream_->getAudioApi();
    openAttempt_ = attempt + 1;
    tone_.configure(sampleRate_);
    scratchBuffer_.assign(std::max(framesPerBurst_ * 8 * 2, 16384), 0.0f);
    decks_[0].decoder.setDeckId('A');
    decks_[1].decoder.setDeckId('B');
    callbackCount_.store(0, std::memory_order_relaxed);
    initialized_ = true; lastError_ = oboe::Result::OK;

    return true;
  }
  return false;
}

bool RemixerAudioEngine::ensureStreamStartedLocked() {
  if (!initialized_ || !stream_) {
    if (!initializeLocked()) return false;
  }
  if (running_.load(std::memory_order_relaxed)) return true;
  auto result = stream_->start();
  if (result != oboe::Result::OK) {
    recordError(result);
    return false;
  }
  running_.store(true, std::memory_order_relaxed);

  return true;
}

bool RemixerAudioEngine::loadTrackFd(int deckIndex, int fd, int64_t offset, int64_t length) {
  std::lock_guard<std::mutex> lock(controlMutex_);
  if (!initializeLocked()) { if (fd >= 0) ::close(fd); return false; }
  auto* deck = getDeck(deckIndex);
  deck->decoder.setDeckId(deckIndex == 1 ? 'B' : 'A');
  deck->eq.requestReset();
  bool res = deck->decoder.open(fd, offset, length, sampleRate_);

  return res;
}

bool RemixerAudioEngine::playDeck(int deckIndex) {


  if (!running_.load(std::memory_order_relaxed)) {
    std::lock_guard<std::mutex> lock(controlMutex_);
    if (!initializeLocked()) return false;
    if (!ensureStreamStartedLocked()) return false;
  }

  auto* deck = getDeck(deckIndex);
  if (!deck->decoder.isLoaded()) return false;
  if (deck->decoder.isEof() && deck->decoder.getBufferedFrames() == 0) {
    if (!deck->decoder.seekTo(0)) return false;
  }
  deck->decoder.start();
  deck->playing.store(true, std::memory_order_release);


  return true;
}

bool RemixerAudioEngine::pauseDeck(int deckIndex) {


  auto* deck = getDeck(deckIndex);
  deck->playing.store(false, std::memory_order_release);
  if (deck->decoder.isLoaded()) {
    deck->decoder.stop();
  }


  return true;
}

bool RemixerAudioEngine::isDeckPlaying(int deckIndex) const noexcept {
  const auto* deck = getDeck(deckIndex);
  return running_.load(std::memory_order_relaxed) && deck->isPlaying();
}

bool RemixerAudioEngine::start() {
  // Start Deck A by default if loaded
  return playDeck(0);
}

bool RemixerAudioEngine::stop() {
  std::lock_guard<std::mutex> lock(controlMutex_);
  running_.store(false, std::memory_order_relaxed);
  for (int d = 0; d < 2; ++d) {
    decks_[d].playing.store(false, std::memory_order_relaxed);
    if (decks_[d].decoder.isLoaded()) {
      decks_[d].decoder.stop();
    }
  }
  if (!stream_ || !initialized_) return true;
  auto result = stream_->stop();
  if (result != oboe::Result::OK) { recordError(result); closeLocked(); return false; }

  return true;
}

void RemixerAudioEngine::closeLocked() {
  running_.store(false, std::memory_order_relaxed);
  for (int d = 0; d < 2; ++d) {
    decks_[d].playing.store(false, std::memory_order_relaxed);
    decks_[d].decoder.release();
  }
  if (stream_) { stream_->close(); stream_.reset(); }
  initialized_ = false;
}

bool RemixerAudioEngine::seekTo(int deckIndex, double positionSeconds) {
  std::lock_guard<std::mutex> lock(controlMutex_);
  auto* deck = getDeck(deckIndex);
  if (!deck->decoder.isLoaded()) return false;
  int64_t posUs = static_cast<int64_t>(positionSeconds * 1000000.0);
  deck->eq.requestReset();
  return deck->decoder.seekTo(posUs);
}

double RemixerAudioEngine::getPosition(int deckIndex) const noexcept {
  const auto* deck = getDeck(deckIndex);
  if (!deck->decoder.isLoaded() || sampleRate_ <= 0) return 0.0;
  return static_cast<double>(deck->decoder.getPlayedFrames()) / static_cast<double>(sampleRate_);
}

double RemixerAudioEngine::getDuration(int deckIndex) const noexcept {
  const auto* deck = getDeck(deckIndex);
  if (!deck->decoder.isLoaded()) return 0.0;
  return static_cast<double>(deck->decoder.getDurationUs()) / 1000000.0;
}

void RemixerAudioEngine::release() {
  std::lock_guard<std::mutex> lock(controlMutex_);
  closeLocked();

}

void RemixerAudioEngine::setTestToneVolume(float volume) noexcept {
  toneEnabled_.store(volume > 0.0f, std::memory_order_relaxed);
  setVolume(0, volume);
}

// Keep the bridge signature compatible; trace arguments are intentionally unused.
void RemixerAudioEngine::setVolume(int deckIndex, float volume, int /*seq*/, int64_t /*tGesture*/) noexcept {
  auto* deck = getDeck(deckIndex);
  float clamped = clampVolume(volume);
  deck->volume.store(clamped, std::memory_order_relaxed);
}

void RemixerAudioEngine::setEq(int deckIndex, int band, float value, bool kill) noexcept {
  getDeck(deckIndex)->eq.setBand(band, value, kill);
}

void RemixerAudioEngine::setRate(int deckIndex, float rate) noexcept {
  getDeck(deckIndex)->decoder.setRate(rate);
}

void RemixerAudioEngine::processDeck(int deckIndex, float* data, int frames, int channels) noexcept {
  auto& deck = decks_[deckIndex];
  deck.eq.process(data, frames, channels, sampleRate_);
  const float target = deck.volume.load(std::memory_order_relaxed);
  const float step = 1.0f / (0.005f * sampleRate_);
  for (int frame = 0; frame < frames; ++frame) {
    deck.smoothedVolume += std::clamp(target - deck.smoothedVolume, -step, step);
    for (int ch = 0; ch < channels; ++ch) data[frame * channels + ch] *= deck.smoothedVolume;
  }
}

oboe::DataCallbackResult RemixerAudioEngine::onAudioReady(oboe::AudioStream* stream, void* data, int32_t frames) {
  float* output = static_cast<float*>(data);
  const int32_t channels = stream->getChannelCount();
  const int32_t totalSamples = frames * channels;

  const bool playA = decks_[0].isPlaying();
  const bool playB = decks_[1].isPlaying();

  if (!playA && !playB) {
    if (toneEnabled_.load(std::memory_order_relaxed)) {
      tone_.render(output, frames, channels, 1.0f);
      const float vol = decks_[0].volume.load(std::memory_order_relaxed);
      for (int32_t i = 0; i < totalSamples; ++i) {
        output[i] *= vol;
      }
    } else {
      std::memset(output, 0, totalSamples * sizeof(float));
    }
  } else if (playA && !playB) {
    decks_[0].decoder.render(output, frames, channels);
    processDeck(0, output, frames, channels);
  } else if (!playA && playB) {
    decks_[1].decoder.render(output, frames, channels);
    processDeck(1, output, frames, channels);
  } else {
    // Both Deck A and Deck B are playing simultaneously!
    decks_[0].decoder.render(output, frames, channels);
    processDeck(0, output, frames, channels);

    // Bounded chunks handle callbacks larger than the preallocated workspace.
    const int32_t chunkFrames = static_cast<int32_t>(scratchBuffer_.size()) / channels;
    for (int32_t offset = 0; offset < frames;) {
      const int32_t count = std::min(chunkFrames, frames - offset);
      decks_[1].decoder.render(scratchBuffer_.data(), count, channels);
      processDeck(1, scratchBuffer_.data(), count, channels);
      for (int32_t i = 0; i < count * channels; ++i) {
        const int32_t index = offset * channels + i;
        output[index] += scratchBuffer_[i];
      }
      offset += count;
    }
  }

  // Process the summed signal before clipping so preamp can restore headroom.
  masterDsp_.process(output, frames, channels, sampleRate_);
  callbackCount_.fetch_add(1, std::memory_order_relaxed);
  return oboe::DataCallbackResult::Continue;
}

bool RemixerAudioEngine::onError(oboe::AudioStream* stream, oboe::Result error) {
  std::lock_guard<std::mutex> lock(controlMutex_);
  stream->stop();
  stream->close();
  if (stream_.get() == stream) {
    running_.store(false, std::memory_order_relaxed);
    initialized_ = false;
    recordError(error);
  }
  return true;
}

std::string RemixerAudioEngine::getDiagnostics() {
  int underruns = -1;
  double streamLatencyMs = 0.0;
  auto s = stream_;
  if (s && initialized_) {
    auto res = s->getXRunCount();
    if (res == oboe::Result::OK) underruns = res.value();
    auto latencyRes = s->calculateLatencyMillis();
    if (latencyRes == oboe::Result::OK) streamLatencyMs = latencyRes.value();
  }

  std::ostringstream ss;
  ss << "{"
     << "\"audioBackend\":\"cpp-oboe\","
     << "\"initialized\":" << (initialized_ ? "true" : "false") << ","
     << "\"running\":" << (running_.load(std::memory_order_relaxed) ? "true" : "false") << ","
     << "\"oboeRunning\":" << (running_.load(std::memory_order_relaxed) ? "true" : "false") << ","
     << "\"sampleRate\":" << sampleRate_ << ","
     << "\"channelCount\":" << channels_ << ","
     << "\"framesPerBurst\":" << framesPerBurst_ << ","
     << "\"bufferSize\":" << bufferSize_ << ","
     << "\"performanceMode\":\"" << oboe::convertToText(performance_) << "\","
     << "\"sharingMode\":\"" << oboe::convertToText(sharing_) << "\","
     << "\"format\":\"" << oboe::convertToText(format_) << "\","
     << "\"audioApi\":\"" << oboe::convertToText(api_) << "\","
     << "\"lastError\":\"" << oboe::convertToText(lastError_) << "\","
     << "\"callbackCount\":" << callbackCount_.load(std::memory_order_relaxed) << ","
     << "\"underrunCount\":" << underruns << ","
     << "\"streamLatencyMs\":" << streamLatencyMs << ","
     << "\"openAttempt\":" << openAttempt_ << ",";

  for (int d = 0; d < 2; ++d) {
    const char* prefix = (d == 0) ? "deckA" : "deckB";
    const auto& deck = decks_[d];
    ss << "\"" << prefix << "Loaded\":" << (deck.decoder.isLoaded() ? "true" : "false") << ","
       << "\"" << prefix << "Playing\":" << (isDeckPlaying(d) ? "true" : "false") << ","
       << "\"" << prefix << "DurationUs\":" << deck.decoder.getDurationUs() << ","
       << "\"" << prefix << "TrackSampleRate\":" << deck.decoder.getTrackSampleRate() << ","
       << "\"" << prefix << "TrackChannels\":" << deck.decoder.getTrackChannels() << ","
       << "\"" << prefix << "DecodedFrames\":" << deck.decoder.getDecodedFrames() << ","
       << "\"" << prefix << "PlayedFrames\":" << deck.decoder.getPlayedFrames() << ","
       << "\"" << prefix << "BufferedFrames\":" << deck.decoder.getBufferedFrames() << ","
       << "\"" << prefix << "MinBufferedFrames\":" << (deck.decoder.getMinBufferedFrames() == SIZE_MAX ? 0 : deck.decoder.getMinBufferedFrames()) << ","
       << "\"" << prefix << "MaxBufferedFrames\":" << deck.decoder.getMaxBufferedFrames() << ","
       << "\"" << prefix << "AverageBufferedFrames\":" << deck.decoder.getAverageBufferedFrames() << ","
       << "\"" << prefix << "AudioUnderrunCount\":" << deck.decoder.getAudioUnderrunCount() << ","
       << "\"" << prefix << "UnderrunFrames\":" << deck.decoder.getUnderrunFrames() << ","
       << "\"" << prefix << "DecoderStalls\":" << deck.decoder.getDecoderStalls() << ","
       << "\"" << prefix << "DecoderLoopIterations\":" << deck.decoder.getDecoderLoopIterations() << ","
       << "\"" << prefix << "PcmEncoding\":\"" << deck.decoder.getPcmEncodingName() << "\","
       << "\"" << prefix << "IsEof\":" << (deck.decoder.isEof() ? "true" : "false") << ","
       << "\"" << prefix << "Rate\":" << deck.decoder.getRate() << ","
       << "\"" << prefix << "EqLowDb\":" << deck.eq.gainDb(0) << ","
       << "\"" << prefix << "EqMidDb\":" << deck.eq.gainDb(1) << ","
       << "\"" << prefix << "EqHighDb\":" << deck.eq.gainDb(2) << ","
       << "\"" << prefix << "Volume\":" << deck.volume.load(std::memory_order_relaxed) << ","
       << "\"" << prefix << "LastVolumeLatencyUs\":" << deck.lastVolumeLatencyUs.load(std::memory_order_relaxed) << ",";
  }

  // Top-level compatibility fields
  const auto& mainDeck = decks_[0];
  ss << "\"trackLoaded\":" << (decks_[0].decoder.isLoaded() || decks_[1].decoder.isLoaded() ? "true" : "false") << ","
     << "\"trackSampleRate\":" << mainDeck.decoder.getTrackSampleRate() << ","
     << "\"trackChannels\":" << mainDeck.decoder.getTrackChannels() << ","
     << "\"durationUs\":" << mainDeck.decoder.getDurationUs() << ","
     << "\"decodedFrames\":" << mainDeck.decoder.getDecodedFrames() << ","
     << "\"playedFrames\":" << mainDeck.decoder.getPlayedFrames() << ","
     << "\"bufferedFrames\":" << mainDeck.decoder.getBufferedFrames() << ","
     << "\"minBufferedFrames\":" << (mainDeck.decoder.getMinBufferedFrames() == SIZE_MAX ? 0 : mainDeck.decoder.getMinBufferedFrames()) << ","
     << "\"maxBufferedFrames\":" << mainDeck.decoder.getMaxBufferedFrames() << ","
     << "\"averageBufferedFrames\":" << mainDeck.decoder.getAverageBufferedFrames() << ","
     << "\"audioUnderrunCount\":" << (decks_[0].decoder.getAudioUnderrunCount() + decks_[1].decoder.getAudioUnderrunCount()) << ","
     << "\"underrunFrames\":" << (decks_[0].decoder.getUnderrunFrames() + decks_[1].decoder.getUnderrunFrames()) << ","
     << "\"decoderStalls\":" << (decks_[0].decoder.getDecoderStalls() + decks_[1].decoder.getDecoderStalls()) << ","
     << "\"decoderLoopIterations\":" << (decks_[0].decoder.getDecoderLoopIterations() + decks_[1].decoder.getDecoderLoopIterations()) << ","
     << "\"codecInputCount\":" << (decks_[0].decoder.getCodecInputCount() + decks_[1].decoder.getCodecInputCount()) << ","
     << "\"codecOutputCount\":" << (decks_[0].decoder.getCodecOutputCount() + decks_[1].decoder.getCodecOutputCount()) << ","
     << "\"resamplerOutputFrames\":" << (decks_[0].decoder.getResamplerOutputFrames() + decks_[1].decoder.getResamplerOutputFrames()) << ","
     << "\"ringBufferWriteFailures\":" << (decks_[0].decoder.getRingBufferWriteFailures() + decks_[1].decoder.getRingBufferWriteFailures()) << ","
     << "\"ringBufferReadUnderruns\":" << (decks_[0].decoder.getRingBufferReadUnderruns() + decks_[1].decoder.getRingBufferReadUnderruns()) << ","
     << "\"pcmEncoding\":\"" << mainDeck.decoder.getPcmEncodingName() << "\","
     << "\"isEof\":" << (mainDeck.decoder.isEof() ? "true" : "false") << ","
     << "\"volume\":" << mainDeck.volume.load(std::memory_order_relaxed) << ","
     << "\"lastVolumeLatencyUs\":" << mainDeck.lastVolumeLatencyUs.load(std::memory_order_relaxed) << ","
     << "\"toneFrequencyHz\":" << 440.0
     << "}";
  return ss.str();
}

} // namespace remixer
