# Phase 2.1: audio control pipeline

## Findings and changes

1. **Source of delay:** continuous store actions published values after awaiting engine calls. Mixer changes launched separate native A/B writes, tempo and bend independently changed PlaybackParams, and scratch movements issued asynchronous MediaPlayer seeks without tracking seek completion. These paths allowed stale state and overlapping work; UI rendering was not assumed to be the cause.
2. **Affected controls:** channel volume, trim/gain, master, crossfader, pitch/tempo, pitch bend, waveform seeking and jog scratching. EQ controls update state only; no EQ DSP was added.
3. **Promises:** the former store/engine path awaited native promises. Continuous actions now publish application/engine state immediately and submit writes without waiting for hardware acknowledgment. Discrete track loading may still await initialization.
4. **Cadence:** UI shared values remain driven by gestures. JS gesture snapshots and ordinary native writes use a 40 ms cadence (25 Hz). Visual animation is not throttled.
5. **Latest value:** each writer retains one in-flight command and at most one replacement value. Intermediate pending values are discarded. Duplicate values are skipped; failures allow retry.
6. **Final values:** release and cancellation flush the exact final value without rounding. Unmount/navigation flush outstanding changes; jog cleanup consumes any remaining cumulative delta. A final value bypasses the timer, or runs immediately after an already in-flight call returns.
7. **Native API:** setMixerVolumes applies the A/B pair together; setDeckRate combines tempo and bend. Revision-tagged seeks and completion events distinguish requested targets from actual positions. Native diagnostics expose parameters and seek completion timing.
8. **JS/React:** shared-value visuals and all existing component StyleSheets are preserved. Gesture callbacks submit snapshots; controls do not depend on React rendering to call audio operations. Synthetic VU updates remain independent.
9. **Zustand:** controls publish state before submitting audio changes; asynchronous acknowledgments cannot overwrite a newer gesture value. Sync reads current state when updating a deck.
10. **Seek/scratch:** jog deltas accumulate against the latest local target. Both JS and native seek paths coalesce. MediaPlayer has one active seek and one latest pending destination; settled native positions remain authoritative. Stale position revisions are ignored during scrubbing.
11. **Pitch/tempo:** one coalesced tuple per deck. Changing rate while paused stores the parameters; PlaybackParams is applied on playback, avoiding its implicit-start behavior.
12. **Threading and limits:** MediaPlayers, controls, callbacks and position polling share a dedicated RemixerAudio looper, outside the rendering thread. MediaPlayer still performs asynchronous seeks and separate deck playback; this is not a professional DJ engine. Acoustic latency and tactile response require physical listening/interaction measurements. EQ remains state-only, and meters remain synthetic. Oboe/C++ mixing and DSP are deferred.

## Validation

- TypeScript: passed (`npx tsc --noEmit`).
- Local library, control state and audio playback checks: passed.
- Behavioral tests cover 1,000-event bursts, 25 Hz pacing, slow native acknowledgments, latest-only replacement, exact final flush, failure retry, immediate store updates, combined mixer/rate writes, accumulated scratch targets, stale-clock rejection and meter isolation.
- Android export: passed.
- Existing component StyleSheet comparison against the pre-change snapshot: unchanged.
- ESLint is not configured; Expo lint attempted automatic setup; that dependency installation was cancelled and its package additions removed. Lint was not treated as a passing check.
- Native `assembleDebug`: passed (12m 2s). Updated arm64 APK installed with `adb install -r` on Infinix X6851 / Android 15; installation succeeded and app launched.
- Verified the new app process has the dedicated `RemixerAudio` thread. Screenshots confirm the existing mixer/deck UI remains present. No audio-control exception appeared in the scoped new-process log query; this alone does not certify every gesture.
- Physical validation remains partial: debugger evaluations timed out, so native seek timing and final parameter diagnostics could not be collected. Audible response, repeated real-track gestures and simultaneous multitouch checks still need confirmation on the phone. No acoustic-latency or 60 fps measurement is claimed. The existing header's 5.3 ms display is synthetic, not a measurement from this pass.

## JavaScript/native version mismatch

A Metro reload cannot add native methods to an already installed APK. The reported `mixer write failed` and `rate A failed` TypeErrors occur when the new JavaScript calls batch methods absent from the older APK. This phase requires rebuilding and installing the native app, not just reloading its bundle.

## September 27: accumulating mixer screens

Library entry used push, but loading a track or returning used replace('/'). Each round trip left the previous mixer mounted underneath a new mixer, retaining its engine subscriptions and animations. Position delivery doubled after the first load and tripled after the second. Library/settings returns and bottom navigation now use dismissTo to reuse an existing destination.

Verified on Infinix X6851: four successive A/B/A/B loads retained one position, meter and playback subscriber. Play results reached JS in 45 ms (A) and 207 ms (B). Sampled fader deliveries reported latest-value ages of 10/14 ms and notification waits of 44/143 ms with both decks playing. These samples are not acoustic latency or a percentile guarantee. User confirmed responsive volume and play/pause. Temporary render/tick probes were removed after validation. The bounded gesture handoff and throttled CONTROL_STATS remain.
