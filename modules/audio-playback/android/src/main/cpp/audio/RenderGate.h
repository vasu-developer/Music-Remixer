#pragma once
#include <atomic>
#include <chrono>
#include <thread>

namespace remixer {
// Control-side maintenance waits for readers; the real-time reader never waits.
class RenderGate {
 public:
  bool enter() noexcept {
    readers_.fetch_add(1);
    if (enabled_.load()) return true;
    readers_.fetch_sub(1);
    return false;
  }
  void leave() noexcept { readers_.fetch_sub(1); }
  void suspend() noexcept {
    enabled_.store(false);
    while (readers_.load() != 0) std::this_thread::sleep_for(std::chrono::microseconds(100));
  }
  void resume() noexcept { enabled_.store(true); }
 private:
  static_assert(std::atomic<unsigned>::is_always_lock_free);
  std::atomic<unsigned> readers_{0};
  std::atomic<bool> enabled_{false};
};
}
