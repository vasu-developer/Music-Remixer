# Phase 3.2 Implementation Report: Native PCM Audio Decoding

**Implementation and Host Validation: PASS.**
**Physical Device Validation: Ready for on-device testing via ADB and Remixer application.**

---

## 1. Architectural Overview

```text
MediaStore (content:// URI)
    ↓
Kotlin NativeAudioBridge.loadTrackUri (ParcelFileDescriptor.dup().detachFd())
    ↓ JNI loadTrackFd(fd, offset, length)
C++ RemixerAudioEngine::loadTrackFd
    ↓
C++ AudioDecoder::open
    ↓
Decoder Thread (std::thread off audio callback)
    ├─ AMediaExtractor (demux audio track, read samples)
    ├─ AMediaCodec (decode MP3/AAC/FLAC/WAV to raw PCM)
    ├─ Linear Resampler & Channel Mixer (sample rate conversion to 48kHz stereo float)
    └─ Writes into PcmRingBuffer
    ↓
PcmRingBuffer (Lock-Free SPSC Ring Buffer: 128k frames, ~2.7s capacity)
    ↓
Oboe Audio Callback (onAudioReady)
    ├─ Consumes stereo float frames directly
    ├─ If buffer has frames → outputs decoded PCM
    ├─ If buffer empty → zero-fills silence (never blocks, never allocates)
    └─ Lock-free callback counter & played frames tracker
    ↓
Android Low-Latency Output (AAudio / OpenSL ES)
    ↓
Speaker / Headphones
```

---

## 2. Key Components & Files

### Files Created
- `modules/audio-playback/android/src/main/cpp/audio/PcmRingBuffer.h`: Lock-free SPSC ring buffer for stereo float audio frames.
- `modules/audio-playback/android/src/main/cpp/audio/AudioDecoder.h`: Native audio decoder header.
- `modules/audio-playback/android/src/main/cpp/audio/AudioDecoder.cpp`: Asynchronous decoding engine using Android NDK `AMediaExtractor` and `AMediaCodec`.
- `scripts/native/test-pcm-decoder.cpp`: Host C++ unit test suite covering ring buffer concurrency, wrap-around, underrun silence padding, and linear resampling.
- `PHASE_3_2.md`: This comprehensive implementation report.

### Files Modified
- `modules/audio-playback/android/src/main/cpp/CMakeLists.txt`: Added `AudioDecoder.cpp` and linked Android NDK `mediandk`.
- `modules/audio-playback/android/src/main/cpp/audio/RemixerAudioEngine.h`: Integrated `AudioDecoder`.
- `modules/audio-playback/android/src/main/cpp/audio/RemixerAudioEngine.cpp`: Implemented `loadTrackFd`, PCM rendering, and diagnostic reporting.
- `modules/audio-playback/android/src/main/cpp/jni/RemixerAudioJni.cpp`: Exposed `loadTrackFd` and `setVolume` to Java/Kotlin via JNI.
- `modules/audio-playback/android/src/main/java/expo/modules/audioplayback/NativeAudioBridge.kt`: Implemented `loadTrackUri` resolving content URIs to file descriptors.
- `modules/audio-playback/android/src/main/java/expo/modules/audioplayback/NativeAudioModule.kt`: Exposed `loadTrack` to React Native.
- `modules/audio-playback/android/src/debug/java/expo/modules/audioplayback/NativeAudioTestReceiver.kt`: Added `loadTrack` command handling for ADB test harness.
- `src/core/audio/NativeAudioEngine.ts`: Added typed TypeScript bindings for `loadTrack` and `setVolume`.
- `scripts/check-oboe-device.py`: Updated physical device test harness to test real track decoding and 10-second listening test.

---

## 3. Strict Real-Time Audio Constraints Satisfied

1. **Zero-Wait Audio Thread**: The Oboe `onAudioReady` callback never waits for `AMediaCodec`, never makes blocking system calls, and never allocates memory.
2. **Buffer Underrun Protection**: If the ring buffer runs dry (e.g. initial buffering), `PcmRingBuffer::read` outputs silence (zeroes) without crashing, hanging, or producing digital clicks.
3. **Resampling & Format Matching**: Automatically detects source track sample rate (e.g. 44.1 kHz, 48 kHz) and channels (mono/stereo) and converts to target hardware rate (48 kHz stereo float).
4. **Clean Lifecycle & Resource Cleanup**: Stops decoder thread cleanly, closes `AMediaCodec` and `AMediaExtractor`, and closes duplicated file descriptors.
5. **UI & Fallback Preservation**: React Native UI layouts remain 100% frozen and untouched. The existing `MediaPlayer` engine remains active as fallback.

---

## 4. Verification Results

| Test | Details | Result |
|---|---|---|
| `scripts/native/test-pcm-decoder.cpp` | SPSC RingBuffer (basic, wrap-around, underrun silence, 100k frames multithreaded), 44.1→48kHz resampler | **PASS (with AddressSanitizer & UndefinedBehaviorSanitizer)** |
| `scripts/native/test-tone.cpp` | 440 Hz waveform test at 44.1, 48, 96 kHz | **PASS** |
| `check-local-library.cjs` | MediaStore permissions, query, deduplication | **PASS** |
| `check-control-state.cjs` | Control isolation, EQ/Kill, volume/tempo state | **PASS** |
| `check-audio-playback.cjs` | Dual-deck `MediaPlayer`, duration/BPM sync | **PASS** |
| `check-audio-controls.cjs` | `LatestValueWriter`, 25 Hz pacing, gesture coalescing | **PASS** |
| `npx tsc --noEmit` | Project-wide TypeScript type checking | **PASS (0 errors)** |
| `npx expo export --platform android` | Hermes production bundle | **PASS (4.4 MB)** |
