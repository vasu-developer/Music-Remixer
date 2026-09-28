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
const calls = { cppVolume: [], eq: [], cppRates: [], mediaVolume: [], rates: [], seek: [], stopped: 0, released: 0 };
const states = { A: { playing: false, position: 0 }, B: { playing: false, position: 0 } };
const listeners = new Map();
let failCppLoad = false, failMediaLoad = false, failPlay = false;
const cpp = {
  initialize: async () => true,
  loadTrack: async () => ({ success: !failCppLoad, duration: 120 }),
  play: async id => { if (failPlay) return false; states[id].playing = true; return true; },
  pause: async id => { states[id].playing = false; return true; },
  seek: async (id, pos) => { calls.seek.push([id, pos]); states[id].position = pos; return pos; },
  setVolume: (id, volume) => calls.cppVolume.push([id, volume]),
  setEQ: (...args) => calls.eq.push(args),
  setRate: (...args) => calls.cppRates.push(args),
  getPosition: id => states[id].position,
  getDuration: () => 120,
  isPlaying: id => states[id].playing,
  getDiagnostics: async () => ({}),
  stop: async () => { calls.stopped++; states.A.playing = states.B.playing = false; return true; },
  release: async () => { calls.released++; },
};
const media = {
  loadTrack: async () => { if (failMediaLoad) throw Error('expected failure'); return {duration: 120}; },
  play: async () => true, pause: async () => true, stop: async () => true,
  setMixerVolumes: async (a,b) => calls.mediaVolume.push([a,b]),
  setDeckRate: async (...args) => calls.rates.push(args),
  seek: async (_,pos) => pos,
  addListener: (name, fn) => { listeners.set(name,fn); return {remove:()=>listeners.delete(name)}; },
};
const original = Module._load;
Module._load = function(name,...args) {
  if (name === 'expo') return {requireOptionalNativeModule: name => name === 'NativeAudioEngine' ? cpp : media};
  if (name === 'react-native') return {Platform:{OS:'android',Version:35}};
  return original.call(this,name,...args);
};
const { RealAndroidAudioEngine } = require('../src/core/audio/RealAndroidAudioEngine.ts');
const { setAudioEngine } = require('../src/core/audio/index.ts');
const { useDeckStore } = require('../src/store/useDeckStore.ts');
const { useMixerStore } = require('../src/store/useMixerStore.ts');
const { crossfaderGain } = require('../src/core/audio/crossfader.ts');
Module._load = original;
(async () => {
  const engine = new RealAndroidAudioEngine();
  setAudioEngine(engine);
  await engine.initialize();
  const unsub = engine.addPlaybackStateListener((id,playing) => useDeckStore.getState().updatePlaybackState(id,playing));
  const track = {id:'local',uri:'content://media/test',title:'Test',artist:'Test',duration:120,bpm:120,musicalKey:'--',waveformData:[]};
  try {
    await useDeckStore.getState().loadTrack('A',track);
    await useDeckStore.getState().loadTrack('B',track);
    assert.deepEqual(calls.cppRates.slice(-2), [['A',1],['B',1]], 'Loading resets native rate');
    await useMixerStore.getState().setEQ('A','low',.75);
    assert.deepEqual(calls.eq.at(-1), ['A',0,.75,false]);
    await useMixerStore.getState().toggleEQKill('A','low');
    assert.deepEqual(calls.eq.at(-1), ['A',0,-1,true]);
    await useMixerStore.getState().toggleEQKill('A','low');
    assert.deepEqual(calls.eq.at(-1), ['A',0,.75,false], 'Unkill restores slider gain');
    await useMixerStore.getState().setEQ('B','high',-.5);
    assert.deepEqual(calls.eq.at(-1), ['B',2,-.5,false]);
    await useDeckStore.getState().loadTrack('B',track);
    assert.ok(calls.eq.slice(-3).some(x => x[0]==='B' && x[1]===2 && x[2]===-.5));
    await useMixerStore.getState().resetEQ('A');
    assert.deepEqual(calls.eq.slice(-3), [['A',0,0,false],['A',1,0,false],['A',2,0,false]]);
    for (const curve of ['linear','smooth','cut']) {
      assert.equal(crossfaderGain(-1,'A',curve),1);
      assert.equal(crossfaderGain(-1,'B',curve),0);
      assert.equal(crossfaderGain(1,'A',curve),0);
      assert.equal(crossfaderGain(1,'B',curve),1);
      let prior = 0;
      for(let i=0;i<=100;i++) {
        const gain=crossfaderGain(i/50-1,'B',curve);
        assert.ok(gain>=prior && gain<=1);prior=gain;
      }
    }
    assert.equal(crossfaderGain(0,'A','linear'),.5);
    assert.ok(Math.abs(crossfaderGain(0,'A','smooth')-Math.SQRT1_2)<1e-12);
    assert.equal(crossfaderGain(0,'A','cut'),1);
    useMixerStore.getState().setCrossfaderCurve('linear');
    assert.ok(Math.abs(calls.cppVolume.at(-1)[1]-.85*.85*.5)<1e-9);
    await engine.setTempo('A',1.2); await engine.setPitchBend('A',1);
    assert.deepEqual(calls.cppRates.at(-1), ['A',1.2*1.08]);
    await engine.setPitchBend('A',0);
    assert.deepEqual(calls.cppRates.at(-1), ['A',1.2]);
    failPlay = true;
    await assert.rejects(useDeckStore.getState().play('A'));
    assert.equal(useDeckStore.getState().deckA.isPlaying,false);
    failPlay = false;
    await useDeckStore.getState().play('A'); await useDeckStore.getState().play('B');
    await useDeckStore.getState().setVolume('A',0.23);
    assert.equal(calls.cppVolume.at(-1)[0],'A');
    await engine.setTempo('A',1.1); engine.flushControls();
    assert.equal(calls.rates.length,0,'C++ controls must not change MediaPlayer parameters');
    await useDeckStore.getState().pause('A');
    states.B.position = 3; engine.tick();
    assert.equal(useDeckStore.getState().deckA.isPlaying,false);
    assert.equal(useDeckStore.getState().deckB.isPlaying,true);
    assert.equal(await engine.getPosition('B'),3);
    states.B.playing = false; states.B.position = 120; engine.tick();
    assert.equal(useDeckStore.getState().deckB.isPlaying,false,'EOF/background native pause must reach UI');
    assert.equal(await engine.getPosition('B'),120,'EOF must not silently rewind');
    for(let i=0;i<100;i++) void engine.seek('A',i);
    engine.flushControls(); await engine.seekWriters.A.whenIdle();
    assert.deepEqual(calls.seek,[['A',99]],'C++ scrubbing is latest-only');
    failCppLoad = true;
    await useDeckStore.getState().loadTrack('A',track);
    listeners.get('onPositionUpdate')({deckId:'A',position:7});
    assert.equal(await engine.getPosition('A'),7,'MediaPlayer fallback position events must not be dropped');
    const count = calls.cppVolume.length;
    await engine.setVolume('A',0.4); engine.flushControls(); await engine.mixerWriter.whenIdle();
    assert.equal(calls.cppVolume.length,count,'Media fallback fader must not call C++');
    assert.ok(calls.mediaVolume.at(-1)[0] > 0);
    failMediaLoad = true;
    await assert.rejects(useDeckStore.getState().loadTrack('A',track));
    await assert.rejects(engine.play('A'),'Failed local loads must not simulate playback');
  } finally {
    unsub(); await engine.dispose();
  }
  assert.equal(calls.stopped,1); assert.equal(calls.released,1);
  console.log('PASS: dual-deck isolation, native EOF/pause UI state, failed play/load, real MediaPlayer fallback, latest-only C++ seeks and native disposal');
})().catch(error => {console.error(error);process.exitCode=1;});
