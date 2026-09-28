#include <cassert>
#include <cmath>
#include <iostream>
#include <thread>
#include <vector>
#include "../../modules/audio-playback/android/src/main/cpp/audio/PcmRingBuffer.h"

using namespace remixer;

void testRingBufferBasic() {
  PcmRingBuffer rb(16);
  assert(rb.capacity() == 16);
  assert(rb.availableRead() == 0);
  assert(rb.availableWrite() == 16);

  std::vector<float> input(16 * 2);
  for (size_t i = 0; i < input.size(); ++i) input[i] = static_cast<float>(i + 1);

  size_t written = rb.write(input.data(), 8);
  assert(written == 8);
  assert(rb.availableRead() == 8);
  assert(rb.availableWrite() == 8);

  std::vector<float> output(8 * 2, 0.0f);
  size_t read = rb.read(output.data(), 8);
  assert(read == 8);
  assert(rb.availableRead() == 0);
  assert(rb.availableWrite() == 16);

  for (size_t i = 0; i < 16; ++i) {
    assert(std::abs(output[i] - input[i]) < 1e-6f);
  }
}

void testRingBufferWrapAround() {
  PcmRingBuffer rb(16);

  std::vector<float> data1(12 * 2, 1.0f);
  assert(rb.write(data1.data(), 12) == 12);
  std::vector<float> out1(12 * 2);
  assert(rb.read(out1.data(), 12) == 12);

  std::vector<float> data2(10 * 2);
  for (size_t i = 0; i < data2.size(); ++i) data2[i] = static_cast<float>(i + 100);
  assert(rb.write(data2.data(), 10) == 10);
  assert(rb.availableRead() == 10);

  std::vector<float> out2(10 * 2, 0.0f);
  assert(rb.read(out2.data(), 10) == 10);
  for (size_t i = 0; i < data2.size(); ++i) {
    assert(std::abs(out2[i] - data2[i]) < 1e-6f);
  }
}

void testRingBufferUnderrunSilence() {
  PcmRingBuffer rb(16);
  std::vector<float> input(4 * 2, 0.75f);
  rb.write(input.data(), 4);

  std::vector<float> output(8 * 2, 99.0f);
  size_t read = rb.read(output.data(), 8);
  assert(read == 4);

  for (size_t i = 0; i < 8; ++i) {
    assert(std::abs(output[i] - 0.75f) < 1e-6f);
  }
  for (size_t i = 8; i < 16; ++i) {
    assert(output[i] == 0.0f);
  }
}

void testRingBufferThreaded() {
  PcmRingBuffer rb(1024);
  const size_t totalFrames = 100000;
  std::atomic<bool> producerDone{false};

  std::thread producer([&]() {
    std::vector<float> chunk(64 * 2);
    size_t framesSent = 0;
    while (framesSent < totalFrames) {
      size_t count = std::min<size_t>(64, totalFrames - framesSent);
      for (size_t i = 0; i < count * 2; ++i) {
        chunk[i] = static_cast<float>(framesSent + i / 2);
      }
      size_t written = rb.write(chunk.data(), count);
      framesSent += written;
      if (written == 0) {
        std::this_thread::yield();
      }
    }
    producerDone.store(true, std::memory_order_release);
  });

  std::thread consumer([&]() {
    std::vector<float> chunk(48 * 2);
    size_t framesReceived = 0;
    while (framesReceived < totalFrames) {
      size_t count = std::min<size_t>(48, totalFrames - framesReceived);
      size_t read = rb.read(chunk.data(), count);
      for (size_t i = 0; i < read * 2; ++i) {
        float expected = static_cast<float>(framesReceived + i / 2);
        assert(std::abs(chunk[i] - expected) < 1e-6f);
      }
      framesReceived += read;
      if (read == 0) {
        std::this_thread::yield();
      }
    }
  });

  producer.join();
  consumer.join();
  assert(producerDone.load());
}

// Stateful Resampler Test (simulating codec buffer boundaries)
struct ResamplerState {
  double rateRatio = 44100.0 / 48000.0;
  bool hasPrev = false;
  float prevL = 0.0f, prevR = 0.0f;
  double nextT = 0.0;
};

void resampleChunk(ResamplerState& st, const float* inStereo, size_t inFrames, std::vector<float>& outStereo) {
  if (inFrames == 0) return;
  size_t k = 0;
  double T = st.nextT;

  // Handle interpolation between prevSample and in[0]
  if (st.hasPrev && T < 1.0) {
    while (T < 1.0) {
      float f = static_cast<float>(T);
      float yL = (1.0f - f) * st.prevL + f * inStereo[0];
      float yR = (1.0f - f) * st.prevR + f * inStereo[1];
      outStereo.push_back(yL);
      outStereo.push_back(yR);
      T += st.rateRatio;
    }
    T -= 1.0;
  }

  // Interpolate inside current buffer
  while (true) {
    size_t n = static_cast<size_t>(T);
    if (n + 1 >= inFrames) {
      // Need next buffer
      st.prevL = inStereo[(inFrames - 1) * 2];
      st.prevR = inStereo[(inFrames - 1) * 2 + 1];
      st.hasPrev = true;
      st.nextT = T - static_cast<double>(inFrames - 1);
      break;
    }
    float f = static_cast<float>(T - n);
    float aL = inStereo[n * 2], aR = inStereo[n * 2 + 1];
    float bL = inStereo[(n + 1) * 2], bR = inStereo[(n + 1) * 2 + 1];
    outStereo.push_back((1.0f - f) * aL + f * bL);
    outStereo.push_back((1.0f - f) * aR + f * bR);
    T += st.rateRatio;
  }
}

void testResamplerBoundaryContinuity() {
  // Test feeding a 440 Hz sine wave in small chunks (e.g. 100 frames per chunk)
  // Compare against single contiguous resample
  ResamplerState stateChunked;
  stateChunked.rateRatio = 44100.0 / 48000.0;

  const size_t totalInputFrames = 2000;
  std::vector<float> input(totalInputFrames * 2);
  for (size_t i = 0; i < totalInputFrames; ++i) {
    float s = std::sin(2.0 * M_PI * 440.0 * i / 44100.0);
    input[i * 2] = s;
    input[i * 2 + 1] = s;
  }

  // 1. Chunked resample in varying chunk sizes (57, 128, 83 frames)
  std::vector<float> outChunked;
  size_t offset = 0;
  size_t chunkSizes[] = { 57, 128, 83, 200, 64, 150, 318 };
  size_t cIdx = 0;
  while (offset < totalInputFrames) {
    size_t sz = chunkSizes[cIdx % 7];
    cIdx++;
    if (offset + sz > totalInputFrames) sz = totalInputFrames - offset;
    resampleChunk(stateChunked, &input[offset * 2], sz, outChunked);
    offset += sz;
  }

  // 2. Continuous monolithic resample
  ResamplerState stateSingle;
  stateSingle.rateRatio = 44100.0 / 48000.0;
  std::vector<float> outSingle;
  resampleChunk(stateSingle, input.data(), totalInputFrames, outSingle);

  // Both outputs should match with zero discontinuity
  assert(outChunked.size() == outSingle.size());
  for (size_t i = 0; i < outChunked.size(); ++i) {
    assert(std::abs(outChunked[i] - outSingle[i]) < 1e-5f);
  }
}

int main() {
  testRingBufferBasic();
  testRingBufferWrapAround();
  testRingBufferUnderrunSilence();
  testRingBufferThreaded();
  testResamplerBoundaryContinuity();
  std::cout << "PASS: PcmRingBuffer & Stateful Continuous Resampler verified!" << std::endl;
  return 0;
}
