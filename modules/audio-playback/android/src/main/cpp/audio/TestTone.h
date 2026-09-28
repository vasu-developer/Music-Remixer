#pragma once
#include <algorithm>
#include <cmath>

namespace remixer {
inline float clampVolume(float value) noexcept {
  return std::isfinite(value) ? std::clamp(value, 0.0f, 1.0f) : 0.0f;
}
// Owned solely by the audio callback while running. Configuration only changes
// after the previous stream has closed. No heap storage or external calls.
class TestTone {
 public:
  void configure(int sampleRate) noexcept {
    phase_ = 0.0;
    increment_ = kTau * 440.0 / sampleRate;
    volume_ = 0.0f;
    slew_ = 1.0f / (0.005f * sampleRate);
  }
  void render(float* output, int frames, int channels, float target) noexcept {
    for (int frame = 0; frame < frames; ++frame) {
      volume_ += std::clamp(target - volume_, -slew_, slew_);
      const float sample = static_cast<float>(std::sin(phase_)) * volume_;
      for (int channel = 0; channel < channels; ++channel) *output++ = sample;
      phase_ += increment_;
      if (phase_ >= kTau) phase_ -= kTau;
    }
  }
 private:
  static constexpr double kTau = 6.28318530717958647692;
  double phase_ = 0.0, increment_ = 0.0;
  float volume_ = 0.0f, slew_ = 0.0f;
};
}
