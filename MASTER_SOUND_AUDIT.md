# Master sound audit — 2026-09-29

## What was actually present

The four new files SystemEqualizerView.tsx, useSystemEqualizerStore.ts,
systemEqualizer.ts and SystemEqualizerModule.kt were all zero bytes. No new
native module registration, UI import, audiofx implementation or spectrum
analyzer was found. The existing source feature was three-band EQ per deck.

Important: binary inspection of the preserved root APK found SystemEqualizerModule,
BassBoost, Virtualizer and the session receiver in classes3.dex, and DJ DECKS /
SYSTEM EQ labels (UTF-16) plus JS bridge names in its Hermes bundle. This APK
was therefore built from different source than the current checkout. The cited
production screenshot is dated September 28, while the root APK is dated
September 29. That screenshot shows no mode switch and partly clipped transport
buttons; it does not verify either claimed feature. No device was connected
when checked, so the installed APK identity remains unknown.

Sample-rate conversion is present in AudioDecoder. Automatic Bluetooth recovery
is not present in the current onError handler: it closes the stream and marks
the engine uninitialized. Global audiofx session-0 insert effects are deprecated
by Android; blanket cross-app coverage cannot be promised. The new master
screen intentionally processes Remixer only and is not a replacement for a
verified, cross-app system EQ service.
The pre-existing modified AndroidRemixer-release.apk was not overwritten.

## Implemented and reachable

Mixer header **EQ**, or **Settings → Equalizers → Master sound** opens the panel.
Enable **Processing** to hear changes; default is bypass. Settings last for the
current session, not across process restarts. Load at least one real native
track; demo tracks have no real audio. MediaPlayer fallback is explicitly
unsupported and reported in the panel.

Native signal chain:
Deck decoders → deck EQ/gain → unclipped stereo sum → preamp (±12 dB) →
ten octave-spaced peaking filters (31–16000 Hz, ±12 dB, Q 1.4) → bass/treble
shelves (250 Hz/4 kHz, ±12 dB) → mid/side width (0–2) → channel balance →
optional stereo-linked sample peak limiter → final safety clip.

Control changes publish atomic targets. Scalar/filter transitions use ~20 ms
smoothing. The callback uses fixed storage, no allocation or locks. The limiter
has instantaneous gain reduction and 100 ms release, no lookahead. This is not
a true-peak limiter, multiband compressor, or guarantee against audible distortion.
The controls affect Remixer only, not device-wide audio. We use the existing
C++ stream rather than assuming Android audiofx attaches to an Oboe stream.

The formulas follow https://www.w3.org/TR/audio-eq-cookbook/ . Android describes
LoudnessEnhancer as a session-attached gain/compression effect, not a guarantee
of distortion-free output: https://developer.android.com/reference/android/media/audiofx/LoudnessEnhancer .
There is no basis for claiming all effects have zero latency or zero CPU cost.

## Still not implemented

Parametric frequency/Q editing, measured AutoEQ headphone profiles, reverb,
Android LoudnessEnhancer/BassBoost/Virtualizer, spectrum FFT, persistent presets
and background playback. These are not advertised as working in the UI.

## Verification

scripts/native/test-master-dsp.cpp: each band response at 44.1/48/96 kHz,
neutral bypass, preamp recovery of summed >1 signals, mono, balance, linked
limiting, finite bounded output under rapid EQ changes.
scripts/check-master-sound.cjs: control bounds, defaults, failed native writes,
reset and reapplication. Existing dual-deck and gesture regressions pass.
TypeScript passes. ESLint is not configured. Physical Android listening,
performance measurements and compatibility with this user's headphones remain
unverified until device testing.

A release artifact check (`scripts/check-master-apk.py APK_PATH`) checks the
actual packaged Hermes labels/bridge, Kotlin DEX method and exported native JNI
entry point. It prints SHA-256 so this APK can be distinguished from old copies.
This proves inclusion, not acoustic performance or functionality of unrelated
Android system audio effects. ASan/UBSan DSP validation also passed.
