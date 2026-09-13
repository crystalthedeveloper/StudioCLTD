import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
let width = 390, coarse = true;
const window = { matchMedia: () => ({ matches: coarse || width <= 768 }) };
function load(path, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => dependencies[name], window });
  return exports;
}
const quality = load('src/world/visualQuality.ts');
const assets = load('src/world/mobileAssets.ts', {
  './visualQuality': quality, './mobile-assets.json': JSON.parse(readFileSync('src/world/mobile-assets.json', 'utf8')),
});
for (const viewport of [390, 430, 768, 844]) {
  width = viewport;
  assert.equal(assets.assetForDevice('/characters/char-optimized.glb'), '/characters/char-mobile.glb');
}
width = 1440; coarse = false;
assert.equal(assets.assetForDevice('/characters/char-optimized.glb'), '/characters/char-optimized.glb');
width = 390;
assert.equal(quality.isCompactVisualBudget(), true, 'narrow screens with a mouse use mobile budget');
let slots = [], cursor = 0, frame;
const react = {
  useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
  useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = typeof value === 'function' ? value() : value;
    return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
  useMemo(factory) { const i = cursor++; return slots[i] ??= factory(); },
  Suspense: 'Suspense',
};
const runtime = { jsx: (type, props) => ({ type, props }) };
const playerWorldState = { position: new THREE.Vector3() };
const { NearbyAsset } = load('src/world/NearbyAsset.tsx', {
  react, 'react/jsx-runtime': runtime, '../player/useGameFrame': { useGameFrame: cb => { frame = cb; } },
  './playerWorldState': { playerWorldState }, './visualQuality': quality,
});
function renderNearby() { cursor = 0; return NearbyAsset({ position: [48, 2, 48], children: 'stateful encounter' }); }
assert.equal(renderNearby(), null, 'distant encounter does not mount during startup');
playerWorldState.position.set(40, 2, 40); frame({ clock: { elapsedTime: 1 } });
assert.equal(renderNearby().props.children, 'stateful encounter', 'teleport/approach loads district');
playerWorldState.position.set(-90, 0, -90); frame({ clock: { elapsedTime: 2 } });
assert.equal(renderNearby().props.children, 'stateful encounter', 'leaving retains progress and loaded resources');
slots = []; width = 1440;
assert.equal(renderNearby().props.children, 'stateful encounter', 'desktop never distance-gates content');
slots = [];
const { useScreenVisibility } = load('src/world/useScreenVisibility.ts', {
  react, three: THREE, '../player/useGameFrame': { useGameFrame: cb => { frame = cb; } },
});
function renderScreen() { cursor = 0; return useScreenVisibility(); }
let screen = renderScreen();
const camera = new THREE.PerspectiveCamera(58, 390 / 844, 0.1, 1000);
camera.updateMatrixWorld();
screen.ref.current = new THREE.Mesh(); screen.ref.current.position.set(0, 0, -20);
frame({ camera, clock: { elapsedTime: 1 } }); assert.equal(renderScreen().visible, true);
screen.ref.current.position.z = 20;
frame({ camera, clock: { elapsedTime: 2 } }); assert.equal(renderScreen().visible, false, 'video behind camera pauses');
screen.ref.current.position.z = -100;
frame({ camera, clock: { elapsedTime: 3 } }); assert.equal(renderScreen().visible, false, 'distant video pauses');
screen.ref.current.position.z = -20;
frame({ camera, clock: { elapsedTime: 4 } }); assert.equal(renderScreen().visible, true, 'returning to screen resumes');
console.log('Mobile loading tests passed: portrait/landscape device URLs, desktop original URLs, deferred mount, teleport, retained state and video visibility.');
