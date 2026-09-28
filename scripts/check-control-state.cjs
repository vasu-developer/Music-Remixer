// Run with: node scripts/check-control-state.cjs
// Uses the project's existing TypeScript compiler; no test dependency required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const src = path.resolve(__dirname, '../src');
require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText.replace(/require\(["']@\/([^"']+)["']\)/g,
    (_, target) => `require(${JSON.stringify(path.join(src, target))})`);
  module._compile(output, filename);
};
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  if (name === 'react-native') return { Platform: { OS: 'android', Version: 35 } };
  if (name === 'expo') return { requireOptionalNativeModule: () => null };
  return originalLoad.call(this, name, ...args);
};
const { useMixerStore } = require('../src/store/useMixerStore.ts');
const { useDeckStore } = require('../src/store/useDeckStore.ts');
const { MOCK_TRACKS } = require('../src/constants/mockTracks.ts');
(async () => {
  const mixer = useMixerStore.getState();
  const untouchedB = mixer.eqB;
  await Promise.all([mixer.setEQ('A', 'high', 0.6), mixer.setEQ('A', 'mid', -0.4), mixer.setEQ('A', 'low', 0.2)]);
  assert.equal(useMixerStore.getState().eqA.high, 0.6);
  assert.equal(useMixerStore.getState().eqA.mid, -0.4);
  assert.equal(useMixerStore.getState().eqA.low, 0.2);
  assert.equal(useMixerStore.getState().eqB, untouchedB);
  await Promise.all([mixer.setEQ('A', 'high', 0.3), mixer.toggleEQKill('A', 'low')]);
  assert.equal(useMixerStore.getState().eqA.high, 0.3);
  assert.equal(useMixerStore.getState().eqA.lowKill, true);

  const deck = useDeckStore.getState();
  await deck.loadTrack('A', MOCK_TRACKS[0]);
  const untouchedDeckB = useDeckStore.getState().deckB;
  await Promise.all([deck.seek('A', 10), deck.setVolume('A', 0.4), deck.setTempo('A', 1.1)]);
  const result = useDeckStore.getState().deckA;
  assert.equal(result.currentTime, 10);
  assert.equal(result.volume, 0.4);
  assert.equal(result.tempo, 1.1);
  assert.equal(useDeckStore.getState().deckB, untouchedDeckB);
  const eqBeforeMeters = useMixerStore.getState().eqA;
  mixer.updateMeters({ deckA: { left: 0.5, right: 0.4 }, deckB: { left: 0, right: 0 }, master: { left: 0.3, right: 0.3 } });
  assert.equal(useMixerStore.getState().eqA, eqBeforeMeters);
  console.log('PASS: simultaneous EQ/kill and seek/volume/tempo updates preserve unrelated state; meter updates preserve EQ identity.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
