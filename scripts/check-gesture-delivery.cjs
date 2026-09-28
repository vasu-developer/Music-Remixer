const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const file = require('node:path').resolve('src/hooks/useControlGesture.ts');
let frame, handlers = {}, effects = [], rn = [], ui = [], calls = [], flushes = 0;
let now = 1000;
const originalNow = Date.now;
Date.now = () => now;
global.__DEV__ = false;
const gesture = new Proxy({}, { get: (_, key) => (...args) => {
  if (key.startsWith('on')) handlers[key] = args[0];
  return gesture;
}});
const mod = new Module(file);
mod.filename = file;
mod.require = name => ({
  react: { useCallback: fn => fn, useRef: current => ({ current }), useEffect: fn => effects.push(fn) },
  'react-native-gesture-handler': { Gesture: { Pan: () => gesture } },
  'react-native-reanimated': { useSharedValue: value => ({ value }), useFrameCallback: fn => { frame = fn; } },
  'react-native-worklets': { scheduleOnRN: (fn, ...args) => rn.push(() => fn(...args)), scheduleOnUI: (fn, ...args) => ui.push(() => fn(...args)) },
  '@/core/audio': { getAudioEngine: () => ({ flushControls: () => flushes++ }) },
}[name]);
mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText, file);
const control = mod.exports.useControlGesture(0, 0, 1, 100, 0, true, v => calls.push(v));
const cleanups = effects.map(fn => fn());
while (ui.length) ui.shift()();
handlers.onStart({ x: 0, y: 0 });
for (let i = 1; i <= 1000; i++) {
  now += 17;
  handlers.onUpdate({ translationX: i / 10, translationY: 0 });
  frame();
  assert.equal(rn.length, 1, 'Blocked JS must retain only one notification');
}
handlers.onFinalize();
frame();
assert.equal(control.position.value, 1, 'Visuals update even when JS is blocked');
rn.shift()();
assert.deepEqual(calls, [1], 'First delivery reads newest final value, not the scheduled old value');
assert.equal(flushes, 1);
// New movement races with acknowledgement; it must still be delivered.
handlers.onStart({ x: 25, y: 0 });
while (ui.length) ui.shift()();
now += 17; frame();
assert.equal(rn.length, 1);
rn.shift()();
assert.deepEqual(calls, [1, .25]);
while (ui.length) ui.shift()();
// Release must bypass cadence and flush even when the value is unchanged.
handlers.onFinalize(); frame(); rn.shift()();
assert.equal(flushes, 2);
while (ui.length) ui.shift()();
frame(); assert.equal(rn.length, 0, 'No idle redelivery');
handlers.onStart({ x: 73, y: 0 }); now += 17; frame();
cleanups.filter(Boolean).forEach(fn => fn());
const before = calls.length;
while (rn.length) rn.shift()();
assert.equal(calls.length, before, 'Unmounted callbacks must not write');
assert.equal(calls.at(-1), .73, 'Unmount flushes newest position');
Date.now = originalNow;
console.log('PASS: blocked-JS burst, latest final value, acknowledgement race, release flush, idle and unmount.');
const dial = mod.exports.useControlGesture(.5, -1, 1, 180, 0, false, () => {}, false, true, 'EQ', true);
handlers.onStart({ x: 70, y: 2 });
assert.equal(dial.position.value, .5, 'Touching a rotary control must preserve its value');
handlers.onUpdate({ translationX: 0, translationY: -45 });
assert.equal(dial.position.value, 1, 'Upward drag raises EQ');
handlers.onUpdate({ translationX: 0, translationY: 45 });
assert.equal(dial.position.value, 0, 'Dial snaps to neutral');
console.log('PASS: relative EQ drag preserves touch value and supports neutral detent.');
