import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
let frame, mask = 0, smoke, texturePath;
const refs = [], cleanups = [];
const jsx = (type, props) => ({ type, props });
const modes = { standard: { color: '#009B3A' }, rapid: { color: '#FED100' }, power: { color: '#CE1126' } };
function load(path, dependencies) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: id => dependencies[id] });
  return exports;
}
const factory = load('src/player/powerSmoke.ts', { three: THREE });
const { PlayerSmokeOrb } = load('src/player/PlayerSmokeOrb.tsx', {
  three: THREE,
  react: { useMemo: fn => fn(), useEffect: fn => cleanups.push(fn()), useRef: current => { const ref = { current }; refs.push(ref); return ref; } },
  'react/jsx-runtime': { jsx, jsxs: jsx },
  '@react-three/drei': { useTexture: path => { texturePath = path; return new THREE.Texture(); } },
  './powerSmoke': { createPowerSmoke: (...args) => (smoke = factory.createPowerSmoke(...args)) },
  './temporaryPowers': { getActivePowerMask: () => mask, powerModes: modes, powerOrder: Object.keys(modes) },
  './gameFocus': { gameNow: () => 1000, subscribeGameFocus: () => () => {} },
  './useGameFrame': { useGameFrame: fn => { frame = fn; } },
  '../world/visualQuality': { isCompactVisualBudget: () => false },
});
const tree = PlayerSmokeOrb({ damageFlashUntil: 0 });
assert.equal(texturePath, "/images/cltd-logo.svg");
const sprite = tree.props.children[1];
assert.equal(sprite.props.scale[0], sprite.props.scale[1], "original square SVG proportions");
assert.deepEqual(sprite.props.children.props.map.repeat.toArray(), [1, 1], "entire original SVG, no atlas crop");
const root = refs[0].current = new THREE.Group();
frame({}, 1 / 60);
const palette = () => smoke.material.uniforms.uColors.value.slice(0, smoke.material.uniforms.uColorCount.value).map(color => color.getHexString());
const hex = color => new THREE.Color(color).getHexString();
assert.deepEqual(Array.from(palette()), ['000000']);
// Exercise all 8 combinations, including removal of each effect with others active.
for (let effects = 7; effects >= 0; effects--) {
  mask = effects;
  frame({}, 1 / 60);
  const expected = Object.values(modes).filter((_, i) => mask & (1 << i)).map(mode => hex(mode.color));
  if (!expected.length) expected.push('000000');
  assert.deepEqual(Array.from(palette()), expected, `exact active hues immediately for mask ${effects}`);
  // Shader assigns consecutive wisps modulo palette length: each hue has equal count.
  const counts = expected.map(() => 0);
  for (let i = 0; i < smoke.geometry.instanceCount; i++) counts[i % expected.length]++;
  assert(counts.every(count => count === counts[0]), 'every active hue has an equal share of wisps');
}
for (let i = 0; i < 180; i++) { root.position.x += 0.05; frame({}, 1 / 60); }
assert(smoke.material.uniforms.uTrail.value.some(point => point.x < -0.1), 'trail follows behind movement');
assert(smoke.material.uniforms.uTrail.value.every(point => point.length() <= 0.650001), 'trail stays compact');
const movingTrail = smoke.material.uniforms.uTrail.value[7].length();
frame({}, 1 / 60);
assert(smoke.material.uniforms.uTrail.value[7].length() > movingTrail * 0.8, 'stopping does not snap the trail');
for (let i = 0; i < 180; i++) frame({}, 1 / 60);
assert(smoke.material.uniforms.uTrail.value.every(point => point.length() < 0.00001), 'stopped smoke settles back to vertical');
for (let i = 0; i < 60; i++) { root.position.z += 0.05; frame({}, 1 / 60); }
assert(smoke.material.uniforms.uTrail.value.some(point => point.z < -0.1), 'trail responds to new direction');
root.position.x += 50;
frame({}, 1 / 60);
assert(smoke.material.uniforms.uTrail.value.every(point => point.length() === 0), 'teleport clears history');
cleanups.forEach(cleanup => cleanup?.());
console.log('Player smoke passed: all 8 effect combinations, immediate expiry, equal colour shares, original SVG, smooth stop/turn, bounded trail and teleport reset.');
