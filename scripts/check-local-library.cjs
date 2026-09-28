const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const src = path.resolve(__dirname, '../src');
require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText.replace(/require\(["']@\/([^"']+)["']\)/g,
    (_, target) => `require(${JSON.stringify(path.join(src, target))})`);
  module._compile(output, filename);
};
let granted = false, requests = 0, scans = 0, fail = false, empty = false;
let response = 'granted';
const platform = { OS: 'android', Version: 35 };
const row = (id, title) => ({ uri: `content://media/external/audio/media/${id}`, title, artist: '<unknown>', durationMs: 123000, mimeType: 'audio/mpeg' });
const native = { getLocalAudioTracks: async (cursor) => {
  scans++;
  if (fail) throw new Error('provider unavailable');
  if (empty) return { tracks: [], nextCursor: null };
  return cursor === null ? { tracks: [row(1, 'Zebra'), row(1, 'Zebra')], nextCursor: '1' }
    : { tracks: [row(2, 'Alpha'), { uri: 'file:///bad' }], nextCursor: null };
} };
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  if (name === 'expo') return { requireOptionalNativeModule: (name) => name === 'LocalMusic' ? native : null };
  if (name === 'react-native') return {
    Platform: platform,
    PermissionsAndroid: {
      PERMISSIONS: { READ_MEDIA_AUDIO: 'audio', READ_EXTERNAL_STORAGE: 'storage' },
      RESULTS: { GRANTED: 'granted', NEVER_ASK_AGAIN: 'blocked' },
      check: async (permission) => { assert.equal(permission, platform.Version >= 33 ? 'audio' : 'storage'); return granted; },
      request: async (permission) => { assert.equal(permission, platform.Version >= 33 ? 'audio' : 'storage'); requests++; granted = response === 'granted'; return response; },
    },
  };
  return originalLoad.call(this, name, ...args);
};
const service = require('../src/core/library/localMusic.ts');
const { useLibraryStore: library } = require('../src/store/useLibraryStore.ts');
const { normalizeLocalTrack } = require('../src/core/library/normalizeTrack.ts');
const { useDeckStore: decks } = require('../src/store/useDeckStore.ts');
// Library selection is tested independently of hardware decoding. A real local
// load without any playback module must now fail instead of simulating success.
const { setAudioEngine, MockAudioEngine } = require('../src/core/audio/index.ts');
setAudioEngine(MockAudioEngine.getInstance());
Module._load = originalLoad;
(async () => {
  const malformed = normalizeLocalTrack({ ...row(3, ''), durationMs: -1, artist: null });
  assert.equal(malformed.title, 'Untitled track');
  assert.equal(malformed.artist, 'Unknown artist');
  assert.equal(malformed.duration, 0);
  assert.deepEqual(malformed.waveformData, []);
  assert.equal(normalizeLocalTrack({ ...row(4, 'Bad'), mimeType: 'video/mp4' }), null);
  assert.equal(normalizeLocalTrack({ uri: 'https://example.com/music.mp3' }), null);
  await library.getState().loadTracks();
  assert.equal(requests, 0, 'Focus must not request permission');
  assert.equal(scans, 0);
  assert.equal(library.getState().permission, 'denied');
  response = 'blocked';
  await library.getState().requestAccess();
  await library.getState().refreshTracks();
  assert.equal(library.getState().permission, 'blocked');
  assert.equal(requests, 1);
  response = 'granted';
  await library.getState().requestAccess();
  assert.deepEqual(library.getState().tracks.map(t => t.title), ['Alpha', 'Zebra']);
  const count = scans;
  await Promise.all([library.getState().refreshTracks(), library.getState().refreshTracks()]);
  assert.equal(scans - count, 2, 'Concurrent refreshes must share one paginated scan');
  const track = library.getState().tracks[0];
  const untouchedB = decks.getState().deckB;
  await decks.getState().loadTrack('A', track);
  assert.equal(decks.getState().deckA.loadedTrack, track);
  assert.equal(decks.getState().deckA.isPlaying, false);
  assert.equal(decks.getState().deckB, untouchedB);
  const untouchedA = decks.getState().deckA;
  await decks.getState().loadTrack('B', track);
  assert.equal(decks.getState().deckA, untouchedA);
  assert.equal(decks.getState().deckB.isPlaying, false);
  library.getState().setSearchQuery('Alpha');
  await library.getState().refreshTracks();
  assert.equal(decks.getState().deckA, untouchedA);
  await decks.getState().toggleSync('A');
  assert.equal(decks.getState().deckA.tempo, 1);
  fail = true;
  await library.getState().refreshTracks();
  assert.ok(library.getState().error);
  assert.equal(library.getState().isLoading, false);
  fail = false; empty = true;
  await library.getState().refreshTracks();
  assert.deepEqual(library.getState().tracks, []);
  assert.equal(library.getState().error, null);
  granted = false;
  await library.getState().refreshTracks();
  assert.equal(library.getState().permission, 'denied');
  assert.deepEqual(library.getState().tracks, []);
  assert.equal(requests, 2, 'Revocation/refresh must not prompt');
  platform.Version = 32;
  response = 'denied';
  await library.getState().requestAccess();
  assert.equal(library.getState().permission, 'denied');
  assert.equal(requests, 3);
  console.log('PASS: permission gating, denial/block/revocation, pagination/deduplication, malformed metadata, empty/error states, scan deduplication and isolated A/B selection without autoplay.');
})().catch(error => { console.error(error); process.exitCode = 1; });
