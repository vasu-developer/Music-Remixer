#pragma once

#include <atomic>
#include <vector>
#include <cstdint>
#include <cstring>
#include <algorithm>
#include <cmath>

namespace remixer {

// Lock-free Single-Producer Single-Consumer (SPSC) RingBuffer for interleaved stereo float samples.
// All size and index units are in stereo frames (1 frame = 2 float samples: Left and Right).
class PcmRingBuffer {
 public:
  explicit PcmRingBuffer(size_t capacityFrames = 65536)
      : capacity_(capacityFrames),
        buffer_(capacityFrames * 2, 0.0f),
        writeIndex_(0),
        readIndex_(0) {}

  void resize(size_t capacityFrames) {
    readPhase_ = 0;
    capacity_ = capacityFrames;
    buffer_.assign(capacityFrames * 2, 0.0f);
    writeIndex_.store(0, std::memory_order_relaxed);
    readIndex_.store(0, std::memory_order_relaxed);
  }

  void clear() noexcept {
    readPhase_ = 0;
    readIndex_.store(0, std::memory_order_relaxed);
    writeIndex_.store(0, std::memory_order_relaxed);
  }

  size_t capacity() const noexcept { return capacity_; }

  size_t availableRead() const noexcept {
    const size_t w = writeIndex_.load(std::memory_order_acquire);
    const size_t r = readIndex_.load(std::memory_order_relaxed);
    return (w >= r) ? (w - r) : 0;
  }

  size_t availableWrite() const noexcept {
    const size_t r = readIndex_.load(std::memory_order_acquire);
    const size_t w = writeIndex_.load(std::memory_order_relaxed);
    const size_t used = (w >= r) ? (w - r) : 0;
    return (capacity_ > used) ? (capacity_ - used) : 0;
  }

  // Consumer (Oboe Audio Callback thread):
  // Reads up to frames requested. If fewer are available, zero-fills the remainder (silence).
  // Returns the number of actual audio frames read.
  size_t read(float* dest, size_t frames) noexcept {
    const size_t avail = availableRead();
    const size_t framesToRead = std::min(frames, avail);
    const size_t r = readIndex_.load(std::memory_order_relaxed);

    if (framesToRead > 0) {
      const size_t startSample = (r % capacity_) * 2;
      const size_t samplesToRead = framesToRead * 2;
      const size_t capacitySamples = capacity_ * 2;

      if (startSample + samplesToRead <= capacitySamples) {
        std::memcpy(dest, &buffer_[startSample], samplesToRead * sizeof(float));
      } else {
        const size_t firstPartSamples = capacitySamples - startSample;
        const size_t secondPartSamples = samplesToRead - firstPartSamples;
        std::memcpy(dest, &buffer_[startSample], firstPartSamples * sizeof(float));
        std::memcpy(dest + firstPartSamples, &buffer_[0], secondPartSamples * sizeof(float));
      }
      readIndex_.store(r + framesToRead, std::memory_order_release);
    }

    if (framesToRead < frames) {
      const size_t silenceSamples = (frames - framesToRead) * 2;
      std::memset(dest + framesToRead * 2, 0, silenceSamples * sizeof(float));
    }

    return framesToRead;
  }

  struct RateRead { size_t outputFrames; size_t consumedFrames; };
  // Consumer-only fractional read cursor. Pitch follows tempo (vinyl-style varispeed).
  // No allocation or locks; adjacent stereo frames use the same interpolation phase.
  RateRead readAtRate(float* dest, size_t frames, float targetRate, double& currentRate,
                      double slew, bool eof) noexcept {
    const size_t r = readIndex_.load(std::memory_order_relaxed);
    const size_t avail = availableRead();
    double pos = readPhase_;
    size_t output = 0;
    for (; output < frames; ++output) {
      const size_t index = static_cast<size_t>(pos);
      if (index >= avail) break;
      const double fraction = pos - index;
      if (fraction > 0 && index + 1 >= avail && !eof) break;
      const size_t next = std::min(index + 1, avail - 1);
      for (size_t ch = 0; ch < 2; ++ch) {
        const float a = buffer_[((r + index) % capacity_) * 2 + ch];
        const float b = buffer_[((r + next) % capacity_) * 2 + ch];
        dest[output * 2 + ch] = static_cast<float>(a + (b - a) * fraction);
      }
      currentRate += std::clamp(static_cast<double>(targetRate) - currentRate, -slew, slew);
      pos += currentRate;
    }
    const size_t consumed = std::min(static_cast<size_t>(pos), avail);
    readPhase_ = eof && consumed == avail ? 0 : pos - consumed;
    readIndex_.store(r + consumed, std::memory_order_release);
    std::fill(dest + output * 2, dest + frames * 2, 0.0f);
    return {output, consumed};
  }

  // Producer (Decoder Thread):
  // Writes stereo float frames into the ring buffer.
  // Returns number of frames successfully written.
  size_t write(const float* src, size_t frames) noexcept {
    const size_t avail = availableWrite();
    const size_t framesToWrite = std::min(frames, avail);
    if (framesToWrite == 0) return 0;

    const size_t w = writeIndex_.load(std::memory_order_relaxed);
    const size_t startSample = (w % capacity_) * 2;
    const size_t samplesToWrite = framesToWrite * 2;
    const size_t capacitySamples = capacity_ * 2;

    if (startSample + samplesToWrite <= capacitySamples) {
      std::memcpy(&buffer_[startSample], src, samplesToWrite * sizeof(float));
    } else {
      const size_t firstPartSamples = capacitySamples - startSample;
      const size_t secondPartSamples = samplesToWrite - firstPartSamples;
      std::memcpy(&buffer_[startSample], src, firstPartSamples * sizeof(float));
      std::memcpy(&buffer_[0], src + firstPartSamples, secondPartSamples * sizeof(float));
    }

    writeIndex_.store(w + framesToWrite, std::memory_order_release);
    return framesToWrite;
  }

 private:
  double readPhase_ = 0; // Consumer only; clear/resize require the render gate.
  size_t capacity_;
  std::vector<float> buffer_;
  std::atomic<size_t> writeIndex_{0};
  std::atomic<size_t> readIndex_{0};
};

} // namespace remixer
