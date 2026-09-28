# Phase 1: Android local music library

## Scope

Local music discovery and metadata selection only. The native module never opens an audio output or decodes samples. `IAudioEngine` and `MockAudioEngine` are unchanged. Mock tracks remain available to the existing demo decks, but the Library contains only MediaStore results, including a real empty result. No DSP, beat/key detection, waveform generation, C++, or Oboe was added. Deck and mixer artwork/layout remain unchanged.

## Implementation

- `modules/local-music/android/src/main/java/expo/modules/localmusic/LocalMusicModule.kt`: isolated Expo native module. `getLocalAudioTracks(afterId, limit)` queries `MediaStore.Audio.Media.EXTERNAL_CONTENT_URI`, ordered by media ID with keyset pagination, up to 200 rows per bridge response. Work runs on Expo's native module worker queue and cursors are closed. It returns provider IDs, content URIs, title/display name, artist, album, duration, MIME type, modification time, and best-effort album artwork URIs. It queries no arbitrary filesystem paths and does no metadata/audio decoding.
- `src/core/library/localMusic.ts`: platform availability, explicit permission request/check, paginated scan, deduplication and sorting. Yields between pages. Expo Go/web/iOS receive a safe unavailable state.
- `src/core/library/normalizeTrack.ts`: validates content URIs/MIME types and maps provider metadata into the existing `Track`. Missing title/artist, duration, album and artwork have safe fallbacks. Milliseconds become seconds. BPM is `0`, musical key `--`, waveform data an empty array; none are fabricated.
- `src/store/useLibraryStore.ts`: granular library state for tracks, loading, permission, error and search. Focus/refresh checks permission without prompting. One shared in-flight operation prevents duplicate scans/dialogs. Revocation clears inaccessible results; errors can be retried.
- `src/screens/LibraryScreen.tsx`: retains the existing crate/list/LOAD A/LOAD B visual language. Searches title/artist/album with deferred filtering, virtualizes results using FlatList, shows small artwork, and supports refresh, loading, permission, empty/error and no-match states. Mock genre filters were replaced with the local-device/refresh toolbar.
- `src/components/library/TrackArtwork.tsx`: small cached native image with musical-note fallback. Reused in the existing deck artwork slot.
- `src/store/useDeckStore.ts`: existing load action assigns only the requested deck and keeps it stopped. Rejects engine load failures, resets stale cue/sync/loop/pitch state, and prevents syncing unanalyzed zero-BPM tracks. No playback action is called by selection.
- `src/components/deck/DeckContainer.tsx`: previous/next reads the local list on button press for local selections (no library subscription); demo tracks retain demo navigation.
- `src/components/deck/TrackInfo.tsx`: tiny integration for artwork/album metadata in the existing layout.

## Permissions and build configuration

Android API 33+: only `READ_MEDIA_AUDIO` is requested at runtime. API 24–32: `READ_EXTERNAL_STORAGE`. The latter is capped at API 32 in the native manifest and config plugin. No image/video/microphone/write-storage permission is requested; those are blocked from manifest merging. Existing normal app permissions such as internet remain unchanged.

Permission is never requested on launch/focus/refresh. The user first sees the explanation and taps **Allow Music Access**. Denial allows retry; a permanent denial offers Android app settings. Returning to the focused library rechecks access.

The project previously had no `android/` or `ios/` directories. Prebuild generated `android/` from Expo config without `--clean`, preserving the original configuration and adding `com.remixer.app`. Native source lives under `modules/`, while `plugins/with-local-music.js` owns manifest changes, so future CNG regeneration and a separate future audio module can coexist. Generated `android/` remains ignored by Git. No npm dependency or lockfile changes were needed for this phase. `npm run android` now builds the native app; the existing iOS script was preserved.

**A native Android build is required.** Expo Go's binary does not contain `LocalMusic`. JavaScript export alone cannot add Kotlin code to Expo Go. A local debug build is sufficient for this phase; expo-dev-client was not added.

References: [Expo local modules](https://docs.expo.dev/modules/get-started/), [Android shared media access](https://developer.android.com/training/data-storage/shared/media).

## Files

Created:

- `modules/local-music/expo-module.config.json`
- `modules/local-music/android/build.gradle`
- `modules/local-music/android/src/main/AndroidManifest.xml`
- `modules/local-music/android/src/main/java/expo/modules/localmusic/LocalMusicModule.kt`
- `plugins/with-local-music.js`
- `src/core/library/localMusic.ts`
- `src/core/library/normalizeTrack.ts`
- `src/store/useLibraryStore.ts`
- `src/components/library/TrackArtwork.tsx`
- `scripts/check-local-library.cjs`
- `LOCAL_MUSIC.md`

Modified in this phase: `app.json`, `package.json`, `src/types/track.ts`, `src/store/useDeckStore.ts`, `src/screens/LibraryScreen.tsx`, `src/components/deck/DeckContainer.tsx`, `src/components/deck/TrackInfo.tsx`.

Track additions are optional `uri`, `mimeType`, and `dateModified` (Unix seconds). Existing `artworkUrl` is reused; no duplicate artwork field or local-track model was introduced.

## Build and validation

Commands used:

```sh
npx tsc --noEmit
node scripts/check-local-library.cjs
node scripts/check-control-state.cjs
npx expo-modules-autolinking resolve --platform android --json
EXPO_NO_TELEMETRY=1 CI=1 npx expo prebuild --platform android --no-install --skip-dependency-update react-native,react
EXPO_NO_TELEMETRY=1 CI=1 npx expo export --platform android
CI=false EXPO_NO_TELEMETRY=1 npx expo lint
cd android
ANDROID_HOME=/home/vasudevverma/Android/Sdk GRADLE_USER_HOME=/tmp/remixer-gradle ./gradlew :app:assembleDebug --no-daemon -PreactNativeArchitectures=arm64-v8a
```

TypeScript, JS Android export, native autolinking, prebuild, library tests and existing control-state tests passed. The generated manifest was inspected for permission scope. Lint is unavailable: the project has no ESLint/config; its installation prompt was declined to avoid unrelated dependency changes.

Library tests cover permission checks without automatic prompts, denied/blocked/revoked access, provider errors, empty scans, malformed metadata, pagination/deduplication, concurrent refresh deduplication, and A/B selection isolation without autoplay. These service tests mock the native provider; they do not replace device testing.

Native compilation and physical-device results will be recorded after the build attempt. Connected device: Infinix X6851, Android API 35 (Android 15).
