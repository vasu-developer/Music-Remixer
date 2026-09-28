#pragma once
#include <algorithm>
#include <array>
#include <atomic>
#include <cmath>

namespace remixer {
// RBJ low/high shelves and peaking EQ; coefficients from the W3C Audio EQ Cookbook.
// Target gains are the only control-thread writes. Filter memory belongs to the audio callback.
class DeckEq {
 public:
  void setBand(int band, float normalized, bool kill) noexcept {
    if (band < 0 || band > 2) return;
    const float value = std::isfinite(normalized) ? std::clamp(normalized, -1.0f, 1.0f) : 0.0f;
    targets_[band].store(kill ? -60.0f : value * 12.0f, std::memory_order_relaxed);
  }
  float gainDb(int band) const noexcept { return targets_[band].load(std::memory_order_relaxed); }
  // Reset is published, never clears filter memory on the control thread.
  void requestReset() noexcept { reset_.store(true, std::memory_order_release); }
  void process(float* data, int frames, int channels, int sampleRate) noexcept {
    if (channels != 2 || sampleRate <= 0) return;
    if (reset_.exchange(false, std::memory_order_acquire) || sampleRate_ != sampleRate) {
      sampleRate_ = sampleRate;
      for (auto& f : filters_) f = Filter{};
      lastDb_.fill(999.0f);
    }
    for (int band = 0; band < 3; ++band) {
      const float db = targets_[band].load(std::memory_order_relaxed);
      if (db != lastDb_[band]) {
        auto& f = filters_[band];
        f.target = coefficients(band, db, sampleRate);
        // 20 ms coefficient ramp, updated once per sample for both stereo channels.
        f.remaining = std::max(1, sampleRate / 50);
        for (int i = 0; i < 5; ++i) f.step[i] = (f.target[i] - f.c[i]) / f.remaining;
        lastDb_[band] = db;
      }
    }
    for (int frame = 0; frame < frames; ++frame) {
      for (auto& f : filters_) {
        if (f.remaining > 0) {
          for (int i = 0; i < 5; ++i) f.c[i] += f.step[i];
          if (--f.remaining == 0) f.c = f.target;
        }
        for (int ch = 0; ch < 2; ++ch) {
          const double x = data[frame * 2 + ch];
          const double y = f.c[0] * x + f.z1[ch];
          f.z1[ch] = f.c[1] * x - f.c[3] * y + f.z2[ch];
          f.z2[ch] = f.c[2] * x - f.c[4] * y;
          if (std::abs(f.z1[ch]) < 1e-25) f.z1[ch] = 0;
          if (std::abs(f.z2[ch]) < 1e-25) f.z2[ch] = 0;
          if (!std::isfinite(y)) { f.z1[ch] = f.z2[ch] = 0; data[frame * 2 + ch] = 0; }
          else data[frame * 2 + ch] = static_cast<float>(y);
        }
      }
    }
  }
 private:
  using Coeff = std::array<double, 5>;
  struct Filter {
    Coeff c{1,0,0,0,0}, target{1,0,0,0,0}, step{};
    double z1[2]{}, z2[2]{};
    int remaining = 0;
  };
  static Coeff coefficients(int band, double db, int rate) noexcept {
    if (db == 0) return {1,0,0,0,0};
    const double frequency = std::min(band == 0 ? 250.0 : band == 1 ? 1000.0 : 4000.0, rate * .4);
    const double w = 6.283185307179586 * frequency / rate;
    const double cs = std::cos(w), sn = std::sin(w), A = std::pow(10.0, db / 40.0);
    double b0,b1,b2,a0,a1,a2;
    if (band == 1) {
      const double alpha = sn / (2 * .7);
      b0=1+alpha*A; b1=-2*cs; b2=1-alpha*A;
      a0=1+alpha/A; a1=-2*cs; a2=1-alpha/A;
    } else {
      const double beta = std::sqrt(2 * A) * sn; // shelf slope S=1
      if (band == 0) {
        b0=A*((A+1)-(A-1)*cs+beta); b1=2*A*((A-1)-(A+1)*cs); b2=A*((A+1)-(A-1)*cs-beta);
        a0=(A+1)+(A-1)*cs+beta; a1=-2*((A-1)+(A+1)*cs); a2=(A+1)+(A-1)*cs-beta;
      } else {
        b0=A*((A+1)+(A-1)*cs+beta); b1=-2*A*((A-1)+(A+1)*cs); b2=A*((A+1)+(A-1)*cs-beta);
        a0=(A+1)-(A-1)*cs+beta; a1=2*((A-1)-(A+1)*cs); a2=(A+1)-(A-1)*cs-beta;
      }
    }
    return {b0/a0,b1/a0,b2/a0,a1/a0,a2/a0};
  }
  std::atomic<float> targets_[3]{};
  std::atomic<bool> reset_{true};
  std::array<Filter,3> filters_{};
  std::array<float,3> lastDb_{999,999,999};
  int sampleRate_ = 0;
};
}
