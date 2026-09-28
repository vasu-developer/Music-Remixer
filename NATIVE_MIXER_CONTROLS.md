# Native deck controls

The September 27 implementation connects the existing Android mixer controls to C++/Oboe. Install the newly built APK; a Metro reload alone cannot add these native methods.

## Implemented

- Independent LOW/bass, MID and HIGH/treble on Deck A and Deck B. Normal slider range is -12 to +12 dB. Low shelf: 250 Hz; mid peak: 1 kHz, Q=0.7; high shelf: 4 kHz. Coefficients follow the [W3C Audio EQ Cookbook](https://www.w3.org/TR/audio-eq-cookbook/).
- Each KILL sets its filter target to -60 dB; the attenuation varies with frequency. This is a deep filter cut, not a perfect isolated-band mute. Unkill restores the slider setting. RST restores all three bands and clears their kills.
- Filter histories are independent per deck and stereo channel. Control threads only publish atomic target gains. The audio callback smooths coefficient changes over 20 ms and processes PCM before deck gain and summation. No allocation, mutex, or logging was added to the callback; existing volume callback logging was removed.
- Tempo and pitch-bend now change the native decoder's consumption rate. Playback position advances by consumed source frames. Fractional linear interpolation retains phase across callbacks and supports pause, EOF, ring wraparound, and seek/reset. This is vinyl-style varispeed: tempo and pitch move together, without key lock/time stretching. Linear interpolation is not a band-limited mastering-quality resampler.
- Crossfader LINEAR uses equal-amplitude fading (center 0.5/0.5); SMOOTH uses equal-power fading (center approximately 0.707/0.707); CUT opens each deck over the first 5% of travel from its closed endpoint. FULL A/B exactly mutes the opposite deck. Deck gains ramp over 5 ms in C++.
- Final output is bounded to [-1,1], including single-deck EQ boosts. Large boosts or two loud tracks can hit this hard clip; automatic loudness normalization and a look-ahead limiter are not implemented.
- EQ settings carry over when loading another track on that deck; tempo resets to 1x. Diagnostics expose deckARate/deckBRate and each deck's EqLowDb/EqMidDb/EqHighDb targets.

## Validation

- `node scripts/check-dual-deck.cjs`: JS/store/native forwarding, per-deck EQ and rate, kill/un-kill/reset, load persistence, curve endpoints/center/monotonicity, existing transport and backend fallback checks.
- `node scripts/check-audio-controls.cjs`, `node scripts/check-control-state.cjs`, `node scripts/check-gesture-delivery.cjs`: existing control/state/blocked-JS regressions.
- `c++ -std=c++17 -O2 scripts/native/test-deck-dsp.cpp -o /tmp/remixer-dsp-test && /tmp/remixer-dsp-test`: response at 44.1/48/96 kHz, gain ranges, kill attenuation, channel isolation, parameter stress, rate/pitch/position, EOF and ring wraparound. Address/undefined sanitizer run also passed with leak detection disabled because the execution sandbox does not support LeakSanitizer.
- Existing PCM ring-buffer/decoder host tests pass (one pre-existing unused-variable warning).
- TypeScript passes. ESLint is not configured; lint is not claimed as passing.
- Android debug APK builds using `cd android && ./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a --offline`.
- Physical listening, output latency and on-device underrun checks for these DSP changes remain pending until the phone is connected.

## Device follow-up

Install `android/app/build/outputs/apk/debug/app-debug.apk` and start Metro. Play different tracks on both decks; adjust each EQ band and KILL independently, then RST. Check tempo up/down, pitch bend press/release, center reset, crossfader curves and endpoint mutes. Repeat library load/return cycles and confirm the earlier screen-accumulation regression does not return. Start with moderate master level for boost tests.

The debug-only NativeAudioTestReceiver additionally accepts `eq` (`deck`, integer `band` 0..2, float `value`, boolean `kill`) and `rate` (`deck`, float `rate`) commands. Its diagnostic log reports native targets, not an acoustic measurement.

## Still outside this change

EQ DSP is supported by the C++ backend; MediaPlayer fallback does not support this EQ and reports an error when changed. Filter/echo/reverb/stutter effects remain unimplemented. Headphone cue routing requires a separate audio-output design. VU meters remain estimates, not measured PCM levels. Key detection, beat-grid sync and key-locked tempo are not added by this change.

## EQ interface and local-track waveforms

EQ now uses individual cyan/amber deck cards with bass/mid/treble rotary controls,
±12 dB readouts, per-band kill and deck reset. Drag vertically; touching the dial
preserves its value. Bounded gesture delivery remains in use.

Local tracks previously had an empty waveform array and no analyzer. LocalMusic
now decodes selected songs on one background-priority worker using a separate
MediaExtractor/MediaCodec, producing 192 amplitude peaks. It never reads or
changes playback buffers. Results are cached for up to 32 tracks in app cache
and JS memory, keyed by URI, modification time and duration. Identical requests
share work. UI ignores results for replaced tracks and caps visible bars at 128.
Loading/error states replace the empty waveform; silent tracks retain a baseline.
First analysis may take time; whole-track extraction has a 120-second timeout.
Rapid track changes can queue analysis; obsolete native jobs currently finish
before the next queued song. Peak display uses square-root amplitude scaling.

Validation: TypeScript, gesture regression (including relative dial motion),
dual-deck regression, waveform single-flight/cache/invalidation/retry tests and
arm64 debug Android build pass. ESLint has no project configuration. Device
listening, actual MediaStore waveform decoding and visual verification remain
pending USB connection. Install the new APK; Metro reload alone cannot add the
native analyzer.

## Compact performance screen

MixerScreen uses a fixed two-deck layout without a ScrollView. Each deck has a
track/library shortcut, seekable waveform, bass/mid/treble with kills, volume,
tempo, cue and play/pause. Crossfader and master stay at the bottom. Navigation
moves into the header. Landscape places EQ and level controls beside each other.
App config and the Android activity now allow rotation (device auto-rotate must
be enabled). Decorative platters and the unimplemented effects/headphone rack
are no longer on the performance screen. EQ reset and crossfader curve remain
in Settings. No audio DSP changes. TypeScript and gesture regression pass;
physical screen fit, large accessibility fonts and rotation during playback
still need device verification.
