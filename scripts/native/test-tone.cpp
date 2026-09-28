#include "../../modules/audio-playback/android/src/main/cpp/audio/TestTone.h"
#include <cassert>
#include <cmath>
#include <iostream>
#include <limits>
#include <vector>
int main() {
  using remixer::clampVolume;
  assert(clampVolume(-1) == 0 && clampVolume(2) == 1);
  assert(clampVolume(0.72f) == 0.72f);
  assert(clampVolume(std::numeric_limits<float>::quiet_NaN()) == 0);
  assert(clampVolume(std::numeric_limits<float>::infinity()) == 0);
  for (int rate : {44100, 48000, 96000}) {
    remixer::TestTone tone;
    tone.configure(rate);
    std::vector<float> output(rate * 2);
    tone.render(output.data(), rate, 2, 0.2f);
    int crossings = 0;
    double squareSum = 0;
    for (int i = 0; i < rate; ++i) {
      assert(std::isfinite(output[2*i]));
      assert(output[2*i] == output[2*i+1]);
      assert(std::abs(output[2*i]) <= 0.200001f);
      if (i > 0 && output[2*i-2] < 0 && output[2*i] >= 0) ++crossings;
      if (i >= rate / 10) squareSum += output[2*i] * output[2*i];
    }
    assert(crossings >= 439 && crossings <= 440);
    assert(std::abs(std::sqrt(squareSum / (rate - rate/10)) - 0.2/std::sqrt(2)) < 0.001);
    remixer::TestTone split;
    split.configure(rate);
    std::vector<float> chunks(output.size());
    for (int offset = 0; offset < rate;) {
      int frames = std::min(137, rate - offset);
      split.render(chunks.data() + offset*2, frames, 2, 0.2f);
      offset += frames;
    }
    assert(chunks == output); // Callback size does not change pitch or phase.
    tone.render(output.data(), rate, 2, 0);
    for (int i = rate / 10; i < rate; ++i) assert(output[2*i] == 0);
  }
  std::cout << "PASS: 440 Hz at 44.1/48/96 kHz, stereo, bounded output, variable buffers, silence, volume clamping/nonfinite inputs\n";
}
