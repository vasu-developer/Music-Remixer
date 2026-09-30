#pragma once
#include "DeckEq.h"
#include "GraphicEq.h"

namespace remixer {
// Controls publish atomic targets; callback exclusively owns all DSP state.
class MasterDsp {
 public:
  MasterDsp() { target_[4].store(1); target_[5].store(1); }
  void set(int index, float value) noexcept {
    if (index < 0 || index > 16 || !std::isfinite(value)) return;
    if (index >= 6 && index < 16) { graphic_.setBand(index - 6, std::clamp(value, -12.f, 12.f) / 12, false); return; }
    if (index == 1 || index == 2) { tone_.setBand(index == 1 ? 0 : 2, std::clamp(value, -12.f, 12.f) / 12, false); return; }
    const float lo = index == 0 ? -12.f : index == 3 ? -1.f : 0.f;
    const float hi = index == 0 ? 12.f : index == 4 ? 2.f : 1.f;
    target_[index == 16 ? 6 : index].store(std::clamp(value, lo, hi), std::memory_order_relaxed);
  }
  void process(float* data, int frames, int channels, int rate) noexcept {
    if (channels != 2 || rate <= 0) return;
    if (target_[6].load(std::memory_order_relaxed) == 0 && wet_ < 1e-5f) {
      wet_ = 0;
      limiter_ = 1;
      for (int i = 0; i < frames * channels; ++i)
        data[i] = std::isfinite(data[i]) ? std::clamp(data[i], -1.f, 1.f) : 0.f;
      return; // Bypassed processing costs no filter work.
    }
    const float gain = std::pow(10.f, target_[0].load(std::memory_order_relaxed) / 20.f);
    const float pan = target_[3].load(std::memory_order_relaxed);
    const float width = target_[4].load(std::memory_order_relaxed);
    const float enabled = target_[6].load(std::memory_order_relaxed);
    const bool limit = target_[5].load(std::memory_order_relaxed) >= .5f;
    const float smoothing = 1.f - std::exp(-1.f / (.02f * rate));
    const float release = 1.f - std::exp(-1.f / (.1f * rate));
    for (int offset = 0; offset < frames; offset += 256) {
      const int count = std::min(256, frames - offset);
      float* block = data + offset * 2;
      for (int f = 0; f < count; ++f) {
        gain_ += (gain - gain_) * smoothing;
        for (int ch = 0; ch < 2; ++ch) {
          const int i = f * 2 + ch;
          dry_[i] = std::isfinite(block[i]) ? block[i] : 0;
          block[i] = dry_[i] * gain_;
        }
      }
      graphic_.process(block, count, 2, rate);
      tone_.process(block, count, 2, rate);
      for (int f = 0; f < count; ++f) {
        pan_ += (pan - pan_) * smoothing;
        width_ += (width - width_) * smoothing;
        wet_ += (enabled - wet_) * smoothing;
        const float mid = (block[f*2] + block[f*2+1]) * .5f;
        const float side = (block[f*2] - block[f*2+1]) * .5f * width_;
        float left = (mid + side) * (1.f - std::max(0.f, pan_));
        float right = (mid - side) * (1.f + std::min(0.f, pan_));
        const float peak = std::max(std::abs(left), std::abs(right));
        const float desired = limit && peak > .98f ? .98f / peak : 1.f;
        limiter_ = desired < limiter_ ? desired : limiter_ + (desired - limiter_) * release;
        left *= limiter_; right *= limiter_;
        // Fade bypass over 20 ms. Keep the final hard safety bound in all modes.
        block[f*2] = std::clamp(dry_[f*2] + wet_ * (left - dry_[f*2]), -1.f, 1.f);
        block[f*2+1] = std::clamp(dry_[f*2+1] + wet_ * (right - dry_[f*2+1]), -1.f, 1.f);
      }
    }
  }
 private:
  std::atomic<float> target_[7]{};
  GraphicEq graphic_;
  DeckEq tone_;
  float dry_[512]{};
  float gain_ = 1, pan_ = 0, width_ = 1, wet_ = 0, limiter_ = 1;
};
}
