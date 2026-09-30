const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
let fail = false, calls = [];
const engine = { setMasterFx: (i, v) => { if (fail) throw new Error('Install updated APK'); calls.push([i,v]); } };
function compile(file, imports) {
  const mod = new Module(require('node:path').resolve(file));
  mod.paths = module.paths;
  const req = mod.require.bind(mod);
  mod.require = name => imports[name] || req(name);
  mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions:{ module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2020 } }).outputText, file);
  return mod.exports;
}
const controls = compile('src/core/audio/systemEqualizer.ts', {});
const { useSystemEqualizerStore: store } = compile('src/store/useSystemEqualizerStore.ts', {
  '@/core/audio': { getAudioEngine: () => engine }, '@/core/audio/systemEqualizer': controls
});
assert.equal(store.getState().values.length,17);
assert.equal(store.getState().values[16],0);
store.getState().setValue(0,100); assert.deepEqual(calls.pop(),[0,12]);
store.getState().setValue(4,-1); assert.deepEqual(calls.pop(),[4,0]);
const before = [...store.getState().values];
fail = true; store.getState().setValue(16,1);
assert.deepEqual(store.getState().values,before); assert.match(store.getState().error,/updated APK/);
fail = false; store.getState().setValue(8,6); store.getState().setValue(16,1);
store.getState().reset(); assert.deepEqual(store.getState().values,controls.MASTER_DEFAULTS);
calls=[]; store.getState().apply(); assert.equal(calls.length,17);
store.getState().setValue(0,NaN); assert.match(store.getState().error,/Invalid/);
console.log('PASS: master control ranges, bypass defaults, native failure, reset and replay.');
