#include "../../modules/audio-playback/android/src/main/cpp/audio/RenderGate.h"
#include <cassert>
#include <thread>
#include <atomic>
int main() {
  remixer::RenderGate gate;
  std::atomic<bool> done{false};
  int protectedValue = 0;
  gate.resume();
  std::thread reader([&] {
    while (!done.load()) {
      if (gate.enter()) {
        // A control-side reset can only occur after this reader leaves.
        const int before = protectedValue;
        std::this_thread::yield();
        assert(protectedValue == before);
        gate.leave();
      }
    }
  });
  for (int i=0;i<1000;++i) {
    gate.suspend();
    ++protectedValue;
    gate.resume();
  }
  done.store(true); reader.join(); gate.suspend();
  assert(!gate.enter());
}
