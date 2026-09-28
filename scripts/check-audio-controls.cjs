// Behavioral regression tests: slow native calls, latest-value replacement,
// final flushes, shared mixer writes and stale playback-clock rejection.
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
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const { LatestValueWriter } = require('../src/core/audio/LatestValueWriter.ts');

async function schedulerTests() {
  let now = 0, nextId = 1;
  const timers = new Map();
  const old = { now: Date.now, setTimeout: global.setTimeout, clearTimeout: global.clearTimeout };
  Date.now = () => now;
  global.setTimeout = (fn, delay) => { const id = nextId++; timers.set(id, { at: now + delay, fn }); return id; };
  global.clearTimeout = id => timers.delete(id);
  async function advance(to) {
    while (true) {
      const next = [...timers.entries()].filter(([, t]) => t.at <= to).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      now = next[1].at; timers.delete(next[0]); next[1].fn(); await settle();
    }
    now = to;
  }
  try {
    const calls = [], resolves = [];
    const writer = new LatestValueWriter(value => { calls.push(value); return new Promise(resolve => resolves.push(resolve)); });
    for (let i = 0; i < 100; i++) writer.submit(i);
    writer.flush();
    assert.deepEqual(calls, [99]);
    for (let i = 100; i < 1000; i++) writer.submit(i);
    writer.submit(0.723456); writer.flush();
    assert.deepEqual(calls, [99], 'A slow native write must not cause overlapping calls');
    resolves.shift()(); await settle();
    assert.deepEqual(calls, [99, 0.723456], 'Only the exact newest final value may follow the in-flight call');
    resolves.shift()(); await writer.whenIdle();
    assert.equal(timers.size, 0);
    writer.submit(0.723456); writer.flush();
    assert.equal(calls.length, 2, 'Unchanged values must not write again');

    const paced = [];
    const fast = new LatestValueWriter(async value => { paced.push({ value, at: now }); });
    for (let i = 0; i < 1000; i++) { fast.submit(i); await advance(i); }
    fast.flush(); await fast.whenIdle();
    assert.ok(paced.length <= 27, `Expected <=25 Hz plus final flush, got ${paced.length}`);
    assert.equal(paced.at(-1).value, 999);
    for (let i = 1; i < paced.length - 1; i++) assert.ok(paced[i].at - paced[i - 1].at >= 40);

    let fail = true, failures = 0, attempts = 0;
    const retry = new LatestValueWriter(async () => { attempts++; if (fail) throw Error('test'); }, Object.is, () => failures++);
    retry.submit(1); retry.flush(); await retry.whenIdle(); fail = false;
    retry.submit(1); retry.flush(); await retry.whenIdle();
    assert.equal(attempts, 2); assert.equal(failures, 1);
    const stale = [];
    const cleared = new LatestValueWriter(async v => stale.push(v));
    cleared.submit('old track'); cleared.clearPending(); await advance(2000);
    assert.deepEqual(stale, []);
  } finally { Date.now = old.now; global.setTimeout = old.setTimeout; global.clearTimeout = old.clearTimeout; }
}

async function engineTests() {
  const calls = { mixer: [], rate: [], seek: [] };
  const listeners = new Map();
  let holdMixer = false, resolveMixer;
  const native = {
    loadTrack: async () => ({ duration: 120 }), play: async () => true, pause: async () => true, stop: async () => true,
    setMixerVolumes: (a, b) => { calls.mixer.push([a, b]); return holdMixer ? new Promise(r => { resolveMixer = r; }) : Promise.resolve(); },
    setDeckRate: async (id, tempo, bend) => { calls.rate.push([id, tempo, bend]); },
    seek: async (id, position, revision) => { calls.seek.push([id, position, revision]); return position; },
    addListener: (name, listener) => { listeners.set(name, listener); return { remove: () => listeners.delete(name) }; },
  };
  const originalLoad = Module._load;
  Module._load = function (name, ...args) {
    if (name === 'expo') return { requireOptionalNativeModule: () => native };
    if (name === 'react-native') return { Platform: { OS: 'android', Version: 35 } };
    return originalLoad.call(this, name, ...args);
  };
  const { RealAndroidAudioEngine } = require('../src/core/audio/RealAndroidAudioEngine.ts');
  const { setAudioEngine } = require('../src/core/audio/index.ts');
  const { useDeckStore } = require('../src/store/useDeckStore.ts');
  const { useMixerStore } = require('../src/store/useMixerStore.ts');
  Module._load = originalLoad;
  const engine = new RealAndroidAudioEngine();
  setAudioEngine(engine);
  await engine.initialize();
  try {
    const track = { id: 'local', uri: 'content://media/external/audio/media/1', title: 'Test', artist: 'Test', duration: 120, bpm: 120, musicalKey: '--', waveformData: [] };
    await useDeckStore.getState().loadTrack('A', track);
    await useDeckStore.getState().loadTrack('B', track);
    calls.mixer.length = calls.rate.length = calls.seek.length = 0;
    holdMixer = true;
    void useDeckStore.getState().setVolume('A', 0.2);
    engine.flushControls();
    for (let i = 0; i < 100; i++) {
      void useDeckStore.getState().setVolume('A', i / 100);
      void useMixerStore.getState().setMasterVolume(i / 100);
    }
    void useDeckStore.getState().setVolume('B', 0.7);
    void useDeckStore.getState().setGain('A', 0.5);
    void useMixerStore.getState().setCrossfader(1);
    engine.flushControls();
    assert.equal(useDeckStore.getState().deckA.volume, 0.99, 'Store must update before native acknowledgment');
    assert.equal(useMixerStore.getState().masterVolume, 0.99);
    assert.equal(calls.mixer.length, 1);
    holdMixer = false; resolveMixer(); await settle();
    assert.equal(calls.mixer.length, 2);
    assert.ok(Math.abs(calls.mixer.at(-1)[0]) < 1e-10);
    assert.equal(calls.mixer.at(-1)[1], 0.7 * 0.99);
    for (let i = 0; i < 100; i++) { void engine.setTempo('A', 1 + i / 100); void engine.setPitchBend('A', i / 100); }
    engine.flushControls(); await settle();
    assert.deepEqual(calls.rate, [['A', 1.99, 0.99]]);
    for (let i = 0; i < 100; i++) void engine.scratch('A', 1);
    engine.flushControls(); await settle();
    assert.equal(calls.seek.length, 1);
    assert.ok(Math.abs(calls.seek[0][1] - 5) < 1e-8, 'Scratch deltas accumulate against latest desired position');
    const revision = calls.seek[0][2];
    listeners.get('onPositionUpdate')({ deckId: 'A', position: 0, seekRevision: revision - 1 });
    assert.ok(Math.abs(await engine.getPosition('A') - 5) < 1e-8);
    listeners.get('onPositionUpdate')({ deckId: 'A', position: 1, seekRevision: revision, isSeeking: true });
    assert.ok(Math.abs(await engine.getPosition('A') - 5) < 1e-8);
    listeners.get('onPositionUpdate')({ deckId: 'A', position: 5.02, seekRevision: revision, isSeeking: false });
    assert.equal(await engine.getPosition('A'), 5.02);
    const before = calls.mixer.length;
    engine.calculateMeters();
    useMixerStore.getState().updateMeters({ deckA: { left: 1, right: 1 }, deckB: { left: 1, right: 1 }, master: { left: 1, right: 1 } });
    await settle(); assert.equal(calls.mixer.length, before, 'Meters must never write audio controls');
    assert.equal(engine.getControlDiagnostics().mixer.maxInFlight, 1);
  } finally { await engine.dispose(); }
}
(async () => {
  await schedulerTests();
  await engineTests();
  console.log('PASS: latest-only/25Hz writers, slow-native final flush, failure recovery, optimistic stores, batched mixer/rate, accumulated scratch, stale clock rejection and meter independence.');
})().catch(error => { console.error(error); process.exitCode = 1; });
