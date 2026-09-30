const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const cache = new Map();
function load(relative) {
  const file = path.resolve(relative);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = new Module(file); cache.set(file, mod);
  mod.require = name => {
    if (name === 'react') return { memo: fn => fn, createElement: (type, props) => ({ type, props }) };
    if (name === 'react-native') return { StyleSheet: { create: styles => styles } };
    if (name === '@/constants/theme') return { DJColors: {}, DJFonts: {} };
    if (name === '@/screens/MixerScreen') return load('src/screens/MixerScreen.tsx');
    if (name === './MixerScreen') return load('src/screens/MixerScreen.tsx');
    return {};
  };
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true,
  }}).outputText, file);
  return mod.exports;
}
const main = load('src/screens/MixerScreen.tsx');
const compatibility = load('src/screens/ProMixerScreen.tsx');
const home = load('src/app/index.tsx');
assert.equal(typeof main.default, 'function');
assert.equal(main.default, main.MixerScreen);
assert.equal(main.ProMixerScreen, main.MixerScreen);
assert.equal(compatibility.default, main.default);
assert.equal(home.default().type, main.default, 'HomeRoute must render the defined canonical screen');
console.log('PASS: HomeRoute renders a defined component; default, named and compatibility exports match.');
