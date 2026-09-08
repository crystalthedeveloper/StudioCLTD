import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
const { Mesh, BoxGeometry, Group, Vector3 } = THREE;
function load(path, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, require: id => id === 'three' ? THREE : dependencies[id] ?? {} });
  return exports;
}

// Run the production recoil hook with a controlled game clock and frame callbacks.
let now = 0;
const frames = [], effects = [], cleanup = [];
const powers = load('src/player/temporaryPowers.ts');
const reactions = load('src/villain/useVillainHitReaction.ts', {
  react: { useRef: current => ({ current }), useEffect: effect => effects.push(effect) },
  '../player/gameFocus': { gameNow: () => now },
  '../player/useGameFrame': { useGameFrame: frame => frames.push(frame) },
  '../player/temporaryPowers': powers,
});
const sharedMaterial = new THREE.MeshStandardMaterial({ emissive: '#050505', emissiveIntensity: 0.025 });
const first = new Mesh(new BoxGeometry(), sharedMaterial), second = new Mesh(new BoxGeometry(), sharedMaterial);
const feedback = reactions.useVillainHitReaction('first', first, true);
reactions.useVillainHitReaction('second', second, true);
effects.forEach(effect => cleanup.push(effect()));
feedback.group.current = new Group(); feedback.group.current.add(first);
for (const mode of ['standard', 'rapid', 'power']) {
  reactions.reactToVillainHit('first', mode, new Vector3(0, 0, -1));
  frames.forEach(frame => frame());
  assert(first.material.emissive.equals(new THREE.Color(powers.powerModes[mode].color)), 'body flash matches the power colour');
  assert(second.material.emissive.equals(sharedMaterial.emissive), 'other villains do not flash');
  now += 110; frames.forEach(frame => frame());
  assert.equal(feedback.group.current.position.z, -0.14, 'small backward recoil');
  assert(Math.abs(feedback.group.current.rotation.x) > 0.08, 'visible flinch');
  now += 111; frames.forEach(frame => frame());
  assert.equal(feedback.group.current.position.length(), 0, 'recoil recovers');
  assert(first.material.emissive.equals(sharedMaterial.emissive), 'flash restores original material');
}
cleanup.forEach(dispose => dispose());
assert.equal(first.material, sharedMaterial);
console.log('Hit feedback tests passed: all power colours, isolated materials, flinch, backward movement, recovery and cleanup.');
