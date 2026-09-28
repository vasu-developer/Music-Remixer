# Remixer UI performance and layout pass

## Findings and changes

This is a source-level rendering audit, not a measured phone profile. The mock engine emits position/meter updates every 50 ms. No physical device was available (`adb devices -l` returned an empty list), so frame rate, touch latency, and simultaneous multi-touch smoothness remain unverified.

1. **Lag sources:** whole-deck subscriptions propagated the 20 Hz position feed through `DeckContainer`, `DualWaveformView`, `MixerSection`, and the library. Meter subscriptions rerendered `MixerSection`, `AppHeader`, and the legacy `ChannelStrip`. JS `PanResponder` handlers made control movement depend on JS scheduling and React/store updates. Waveform bars and meter segments were recreated on updates. Meter segments carried repeated shadows.
2. **React boundaries:** deck selection now excludes position, volume, gain, and pitch bend; track time subscribes separately at whole-second resolution. Each waveform owns its track subscription and a small tenths-of-a-second text readout. Each EQ band, trim, channel fader, and master/headphone control owns its own scalar subscriptions. Each effect unit owns its subscriptions. The legacy strip selects only gain/volume from its deck; it is not mounted by the current mixer screen.
3. **High-frequency visuals:** Gesture Handler worklets update Reanimated shared values for slider/fader caps, fills, knob rotation, scratching, and waveform scrubbing. Visual movement does not wait for a store action or a React render. Engine/store commits occur at most every 50 ms during movement, plus start/final commits; cancellation also flushes the final value. Store state remains authoritative; shared values are transient presentation state.
4. **Zustand:** no whole-store React subscriptions were found. The problem was whole nested deck/EQ objects and high-frequency meter selectors. These were replaced with scalar/shallow selections or imperative subscriptions feeding shared values. Existing stores and actions remain in place. Concurrent EQ/kill and seek/tempo updates merge into current state rather than overwriting unrelated values from pre-await snapshots.
5. **Jog wheels:** the original concentric artwork and rotating center are retained. Touch angle calculations and transforms run on the UI runtime. Scratch deltas are accumulated before bounded engine callbacks, including a final flush. Playback resumes using current playback/tempo props after release or cancellation; animations are cancelled on cleanup. The artwork is memoized and the platter only shrinks when its measured available width requires it.
6. **Waveforms:** existing track peak data is reused, with a module-level empty fallback. Memoized played/unplayed artwork preserves the existing bars and colors. An animated clipping boundary reveals played bars; a separate transform moves the playhead. Neither operation remaps the peak array. Width state changes only on layout. The small numeric readout is isolated from the waveform tree. Gesture callbacks follow current track duration instead of the initial render's duration.
7. **VU meters:** imperative store subscriptions drive interpolated shared left/right levels. Static vertical segments use animated styles; React is not invoked for meter ticks. Repeated segment/clip shadows were removed. Subscriptions clean up on unmount.
8. **Mixer sliders:** UI-thread movement uses the actual cap travel distance and gesture translation, avoiding child-relative coordinate jumps. EQ detents are preserved. Scalar leaf subscriptions prevent A-HIGH changes from rerendering A-MID, A-LOW, Deck A/B, master, header, navigation, or waveforms. Crossfader width is constrained by measured layout. Gesture Handler scroll views coordinate scrolling with native control gestures.
9. **Exact spacing cause:** `BpmKeyDisplay` was one horizontal row with `justifyContent: 'space-between'`, `bpmBox.flex: 1.2`, and `keyBox.flex: 1`. These growing metadata columns competed with fixed-width pitch/reset/SYNC controls and reserved excess horizontal space; the row also exceeded narrow half-screen deck widths. There was no hidden spacer component.
10. **Layout correction:** metadata and control groups now use explicit gaps and intrinsic widths with intentional shrink/grow behavior. On narrow windows, the same metadata and tightly grouped controls occupy two internal rows. Deck A and B remain in one horizontal row. Track metadata can shrink and time badges wrap instead of overflowing.
11. **Design/scope:** no replacement deck, jog, waveform, transport, or meter design. Cyan/amber identity and existing hardware artwork are retained. Changes are rendering/gesture implementation and responsive spacing fixes. `IAudioEngine`, `MockAudioEngine`, dependencies, and navigation architecture were not changed by this pass.

## Validation

- `npx tsc --noEmit`: passed.
- `EXPO_NO_TELEMETRY=1 CI=1 npx expo export --platform android`: passed; Hermes bundle written to `dist`.
- `node scripts/check-control-state.cjs`: passed. Exercises concurrent EQ/kill updates, concurrent seek/volume/tempo updates, preservation of the other deck/channel, and EQ identity across meter updates.
- `EXPO_NO_TELEMETRY=1 CI=1 npx expo lint`: unavailable because ESLint/config are not installed. Expo attempted automatic installation; it was interrupted and its manifest additions were removed. No new dependency retained.
- Physical Android test: pending; ADB found no attached device. Export/type checking do not establish runtime smoothness.

## Phone acceptance checks still required

Use the existing Android development build on the Infinix. Verify both narrow portrait and landscape widths, then use React Native DevTools' Profiler and the performance monitor:

- Play both decks for 30 seconds. Deck/mixer chassis and navigation should not commit with position or VU ticks; only numeric time readouts should update in React.
- Drag A-HIGH through both endpoints and its center detent. Check neighboring controls remain unchanged, including with KILL and reset actions.
- Simultaneously move an EQ slider, crossfader, and jog wheel where multi-touch permits. Record UI/JS frame times and visible latency; no frame-time claim is made by this report.
- Scratch before/after play, pause, tempo sync, and track changes. Cancel a touch by navigating/backgrounding. Check release/cancellation and rotation restart behavior.
- Seek on both waveforms after changing tracks with different durations. Confirm touch position, endpoint clamping, displayed time, and playhead agree.
- Scroll from gaps between controls and verify dragging a control does not scroll the page. Check all labels, SYNC, pitch nudges, and transport touch targets at the phone's actual font/display scale.
