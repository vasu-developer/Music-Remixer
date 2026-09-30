# System audio controls

The previous SystemEqualizerModule.kt was empty and unregistered. The original
/equalizer screen is still the C++ master processor for Remixer's decks.

Settings → Equalizers → System audio (also accessible from Master Sound) now
opens a separate native Android AudioFX controller. Enable it before restarting
playback in the external player. A user-started foreground service receives
OPEN/CLOSE_AUDIO_EFFECT_CONTROL_SESSION broadcasts, lists announced sessions,
and owns effects independently of the React screen. Only the selected session
is processed. Stop, notification Stop, process death, and session close release
effects. A closed selected session switches to another announced session, if any.
Controls reset on attachment; settings are not persisted across sessions.

The phone supplies the Equalizer band count, frequencies and range. BassBoost,
DynamicsProcessing preamp (-12…12 dB), a 3:1 compressor (-18 dB threshold), and a
limiter (-1 dB threshold, 20:1) are exposed when supported and controlled. Each
optional effect can fail independently. Competing equalizers can take control;
reselect the session after disabling them. No support or audible effect is
inferred merely from a music app running.

Optional Visualizer uses actual waveform samples, not simulated animation.
Android requires RECORD_AUDIO for this API. Samples stay in memory, are not
saved or uploaded, and visualization stops when the screen backgrounds/unmounts.
EQ does not require microphone permission. Notification permission is requested
on Android 13+ but denial does not falsely claim processing is unsupported.

Experimental global mode explicitly tries session 0 instead of per-session
attachment. Android deprecated insert effects on session 0; some devices reject
or ignore them. Neither this mode nor an attached effect guarantees Spotify,
YouTube, Bluetooth, offloaded or protected playback can be processed. DRM capture
restrictions and attaching AudioFX are different mechanisms. This implementation
does not capture/replay other apps, request DUMP or notification-listener access,
or discover private sessions. DUMP is not a universal audio-control permission.
Tempo, pitch, scratch, cue and looping remain deck-only features.

The service uses Android 14+ specialUse with an explicit manifest explanation,
not a falsely claimed media-playback service. Any future Play distribution must
include the corresponding foreground-service use-case declaration/review.

## Device acceptance checks

1. Enable normal mode, restart a player that broadcasts session intents; confirm
   the session appears and actual device bands are shown.
2. Move a low band down, toggle bypass by stopping/restarting, and listen for the
   change on the intended phone/player/output route. UI readback alone cannot
   prove the sound changed.
3. Switch apps; confirm the service and effects remain. Close the session; confirm
   effects release and the screen returns to waiting or selects another session.
4. Test no session, unavailable effects, competing equalizer, notification denial,
   microphone denial, granted visualization, Stop from notification, and restart.
5. Test global mode separately; report rejection or inaudible effects as device
   incompatibility, not successful processing.

References:
- https://developer.android.com/reference/android/media/audiofx/AudioEffect
- https://developer.android.com/reference/android/media/audiofx/Visualizer
- https://developer.android.com/reference/android/media/audiofx/DynamicsProcessing
- https://developer.android.com/develop/background-work/services/fgs/service-types

## Verified on the connected Android 15 phone

- Built `:app:assembleRelease --offline -PreactNativeArchitectures=arm64-v8a
  --max-workers=2 --no-parallel`; Android release checks passed.
- Installed `AndroidRemixer-system-audio-arm64.apk` successfully and opened
  `androidremixer://system-audio`.
- Created a real, silent AudioTrack in a temporary shell test process and sent
  standard OPEN/CLOSE session broadcasts (test session 2305).
- Remixer detected the external session and exposed the device's five bands:
  60, 230, 910, 3600 and 14000 Hz. BassBoost and DynamicsProcessing controls were
  available. A lower-priority independent Equalizer observer had no control but
  read the selected session's enabled effect and confirmed that dragging the
  60 Hz slider changed its native band level from 0 to -1000 millibels (-10 dB).
- Home/background preserved the foreground service. CLOSE removed the session
  and returned the UI to waiting. Turning processing off stopped the service.
- Experimental global mode attached a five-band EQ and exposed dynamics on this
  phone without an attachment error. This does not establish audibility on every
  player/output route. No Spotify/YouTube compatibility guarantee is inferred.
- TypeScript passed, and focused ESLint passed for the changed screens/bridge.
  Full-project lint remains blocked by existing React Hooks/gesture errors and
  other pre-existing lint findings. The repository previously lacked ESLint;
  Expo-compatible lint dependencies and configuration are now included.
- Microphone denial, competing equalizer takeover, audible frequency response,
  and sustained visualization sampling have not been fully verified by these
  automated checks.

## External playback controls

System Audio now includes a separate media-player picker and previous/play/pause/next controls.
Enable Remixer in Android notification-access settings using **Connect your music player**.
This authorizes MediaSessionManager discovery; Remixer's listener does not inspect or store notification contents.
Commands target the selected session only and are disabled when the player does not advertise support.
Selecting a playback player does not change the audio-effect session. If the selected session ends,
select it again rather than redirecting commands to another app.

These additions require a native update (`expo run:android`); Metro reload alone cannot register
the listener service or native methods. No APK/build was produced for this UI update.
TypeScript, changed-file lint, home-route and gesture regression checks pass; native compilation
and device playback/layout verification remain pending.

The mixer uses the available viewport height with fixed transport/output controls. Smaller views
place jog/bend/reset/sync actions in each deck's Tools sheet. Deck A is lavender, Deck B mint,
and master controls use pink accents on a purple chassis.
