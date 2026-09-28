const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Running Audio Playback Verification ---');

const projectRoot = path.resolve(__dirname, '..');

// 1. Verify DeckPlayer.kt
const deckPlayerPath = path.join(
  projectRoot,
  'modules/audio-playback/android/src/main/java/expo/modules/audioplayback/DeckPlayer.kt'
);
assert(fs.existsSync(deckPlayerPath), 'DeckPlayer.kt must exist');
const deckPlayerContent = fs.readFileSync(deckPlayerPath, 'utf8');
assert(deckPlayerContent.includes('MediaPlayer()'), 'DeckPlayer must instantiate MediaPlayer');
assert(deckPlayerContent.includes('openAssetFileDescriptor'), 'DeckPlayer must support openAssetFileDescriptor for content URIs');
assert(deckPlayerContent.includes('applyVolumeInternal'), 'DeckPlayer must apply volume');
assert(deckPlayerContent.includes('playbackParams'), 'DeckPlayer must support playbackParams for tempo / pitch bend');
assert(deckPlayerContent.includes('state == State.STARTED'), 'DeckPlayer isPlaying must check State.STARTED');
console.log('✓ DeckPlayer.kt verified');

// 2. Verify AudioPlaybackModule.kt
const modulePath = path.join(
  projectRoot,
  'modules/audio-playback/android/src/main/java/expo/modules/audioplayback/AudioPlaybackModule.kt'
);
assert(fs.existsSync(modulePath), 'AudioPlaybackModule.kt must exist');
const moduleContent = fs.readFileSync(modulePath, 'utf8');
assert(moduleContent.includes('Name("AudioPlayback")'), 'Module name must be AudioPlayback');
assert(moduleContent.includes('AsyncFunction("loadTrack")'), 'Module must expose loadTrack');
assert(moduleContent.includes('AsyncFunction("play")'), 'Module must expose play');
assert(moduleContent.includes('AsyncFunction("pause")'), 'Module must expose pause');
assert(moduleContent.includes('AsyncFunction("seek")'), 'Module must expose seek');
assert(moduleContent.includes('AsyncFunction("setVolume")'), 'Module must expose setVolume');
assert(moduleContent.includes('AsyncFunction("setTempo")'), 'Module must expose setTempo');
assert(moduleContent.includes('ACTION_AUDIO_BECOMING_NOISY'), 'Module must handle ACTION_AUDIO_BECOMING_NOISY');
assert(moduleContent.includes('AUDIOFOCUS_GAIN'), 'Module must handle audio focus');
assert(moduleContent.includes('sendEvent("onPositionUpdate"'), 'Module must emit onPositionUpdate');
console.log('✓ AudioPlaybackModule.kt verified');

// 3. Verify nativeAudio.ts
const nativeAudioPath = path.join(projectRoot, 'src/core/audio/nativeAudio.ts');
assert(fs.existsSync(nativeAudioPath), 'nativeAudio.ts must exist');
const nativeAudioContent = fs.readFileSync(nativeAudioPath, 'utf8');
assert(nativeAudioContent.includes("requireOptionalNativeModule<AudioPlaybackNativeModule>('AudioPlayback')"), 'Must link to AudioPlayback module');
assert(nativeAudioContent.includes('isNativeAudioAvailable'), 'Must export isNativeAudioAvailable');
assert(nativeAudioContent.includes('loadTrack'), 'Must provide loadTrack');
assert(nativeAudioContent.includes('addPositionListener'), 'Must provide addPositionListener');
console.log('✓ nativeAudio.ts verified');

// 4. Verify RealAndroidAudioEngine.ts
const realEnginePath = path.join(projectRoot, 'src/core/audio/RealAndroidAudioEngine.ts');
assert(fs.existsSync(realEnginePath), 'RealAndroidAudioEngine.ts must exist');
const realEngineContent = fs.readFileSync(realEnginePath, 'utf8');
assert(realEngineContent.includes('class RealAndroidAudioEngine implements IAudioEngine'), 'Must implement IAudioEngine');
assert(realEngineContent.includes('NativeAudio.loadTrack'), 'Must call NativeAudio.loadTrack');
assert(realEngineContent.includes('NativeAudio.play'), 'Must call NativeAudio.play');
assert(realEngineContent.includes('calculateEffectiveVolume'), 'Must calculate effective volume with crossfader & gain');
assert(realEngineContent.includes('calculateMeters'), 'Must calculate stereo VU meters');
console.log('✓ RealAndroidAudioEngine.ts verified');

// 5. Verify index.ts selects RealAndroidAudioEngine on Android
const indexPath = path.join(projectRoot, 'src/core/audio/index.ts');
const indexContent = fs.readFileSync(indexPath, 'utf8');
assert(indexContent.includes('RealAndroidAudioEngine'), 'index.ts must export RealAndroidAudioEngine');
assert(
  indexContent.includes("Platform.OS === 'android'") &&
  indexContent.includes('RealAndroidAudioEngine.getInstance()'),
  'Must select RealAndroidAudioEngine on Android'
);
console.log('✓ audio/index.ts selection verified');

// 6. Verify useDeckStore.ts
const storePath = path.join(projectRoot, 'src/store/useDeckStore.ts');
const storeContent = fs.readFileSync(storePath, 'utf8');
assert(storeContent.includes('await engine.getDuration(deckId)'), 'useDeckStore must resolve duration from engine');
assert(storeContent.includes('track.bpm > 0 ? track.bpm : 128.0'), 'useDeckStore must ensure valid BPM');
console.log('✓ useDeckStore.ts verified');

console.log('--- ALL AUDIO PLAYBACK CHECKS PASSED ---');

// Exercise behavior under delayed native acknowledgments, not only source presence.
require('./check-audio-controls.cjs');
