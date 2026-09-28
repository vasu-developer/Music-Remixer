#pragma once
#include <atomic>
#include <chrono>
#include <memory>
#include <mutex>
#include <string>
#include <vector>
#include <oboe/Oboe.h>
#include "TestTone.h"
#include "AudioDecoder.h"
#include "DeckEq.h"

namespace remixer {
static_assert(std::atomic<float>::is_always_lock_free);
static_assert(std::atomic<bool>::is_always_lock_free);
static_assert(std::atomic<uint32_t>::is_always_lock_free);

struct DeckChannel {
  AudioDecoder decoder;
  DeckEq eq;
  float smoothedVolume = 0; // Audio callback owns this value.
  std::atomic<float> volume{1.0f};
  std::atomic<bool> playing{false};
  std::atomic<int64_t> lastVolumeLatencyUs{-1}; // Unmeasured; never acoustic latency.

  bool isLoaded() const noexcept { return decoder.isLoaded(); }
  bool isPlaying() const noexcept {
    return playing.load(std::memory_order_relaxed) && decoder.isPlaying();
  }
};

class RemixerAudioEngine final : public oboe::AudioStreamDataCallback,
                                 public oboe::AudioStreamErrorCallback {
 public:
  bool initialize();
  bool loadTrackFd(int deckIndex, int fd, int64_t offset, int64_t length);
  bool playDeck(int deckIndex);
  bool pauseDeck(int deckIndex);
  bool start();
  bool stop();
  void release();
  bool seekTo(int deckIndex, double positionSeconds);
  double getPosition(int deckIndex) const noexcept;
  double getDuration(int deckIndex) const noexcept;
  void setTestToneVolume(float volume) noexcept;
  void setVolume(int deckIndex, float volume, int seq = 0, int64_t tGesture = 0) noexcept;
  void setEq(int deckIndex, int band, float value, bool kill) noexcept;
  void setRate(int deckIndex, float rate) noexcept;
  bool isRunning() const noexcept { return running_.load(std::memory_order_relaxed); }
  bool isDeckPlaying(int deckIndex) const noexcept;
  std::string getDiagnostics();
  oboe::DataCallbackResult onAudioReady(oboe::AudioStream*, void*, int32_t) override;
  bool onError(oboe::AudioStream*, oboe::Result) override;

 private:
  void processDeck(int deckIndex, float* data, int frames, int channels) noexcept;
  bool initializeLocked();
  bool ensureStreamStartedLocked();
  void closeLocked();
  void recordError(oboe::Result);
  DeckChannel* getDeck(int deckIndex) noexcept;
  const DeckChannel* getDeck(int deckIndex) const noexcept;

  std::mutex controlMutex_; // NEVER acquired by onAudioReady.
  std::shared_ptr<oboe::AudioStream> stream_;
  std::atomic<bool> running_{false};
  std::atomic<bool> toneEnabled_{false};
  std::atomic<uint32_t> callbackCount_{0};

  TestTone tone_;
  DeckChannel decks_[2]; // deck 0 = Deck A, deck 1 = Deck B
  std::vector<float> scratchBuffer_; // Preallocated scratch buffer for real-time mixing

  bool initialized_ = false;
  int sampleRate_ = 0, channels_ = 0, framesPerBurst_ = 0, bufferSize_ = 0;
  int openAttempt_ = 0;
  oboe::AudioFormat format_ = oboe::AudioFormat::Unspecified;
  oboe::PerformanceMode performance_ = oboe::PerformanceMode::None;
  oboe::SharingMode sharing_ = oboe::SharingMode::Shared;
  oboe::AudioApi api_ = oboe::AudioApi::Unspecified;
  oboe::Result lastError_ = oboe::Result::OK;
};
}
