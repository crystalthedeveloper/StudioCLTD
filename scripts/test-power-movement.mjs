import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
function load(path, deps = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: id => deps[id] });
  return exports;
}
let now = 0, focused = true, frame;
const focus = { gameNow: () => now, isGameFocused: () => focused,
  gameTimers: { setTimeout: () => 1, clearTimeout() {} } };
const powers = load('src/player/temporaryPowers.ts', {
  './effectColors': load('src/player/effectColors.ts'), './gameFocus': focus,
  './poweredJump': { resetPoweredJump() {} },
});
const velocity = { x: 0, y: 0, z: 0 };
const body = { translation: () => ({ x: 0, y: 0.32, z: 0 }), linvel: () => velocity,
  setLinvel: next => Object.assign(velocity, next) };
const jsx = (type, props) => { if (type === 'body') props.ref.current = body; return { type, props }; };
const { CharacterController } = load('src/player/CharacterController.tsx', {
  three: THREE,
  react: { useRef: current => ({ current }), useMemo: fn => fn(), useEffect() {} },
  'react/jsx-runtime': { jsx, jsxs: jsx },
  '@react-three/rapier': { RigidBody: 'body', BallCollider: 'collider', useRapier: () => ({
    rapier: { Ray: class { constructor(origin) { this.origin = origin; } }, QueryFilterFlags: { EXCLUDE_SENSORS: 1 } },
    world: { castRayAndGetNormal: () => ({ normal: { y: 1 } }), castRay: () => ({}) },
  }) },
  './temporaryPowers': powers, './poweredJump': {}, './useGameFrame': { useGameFrame: cb => { frame = cb; } },
  './playerDimensions': { playerSphereRadius: 0.32, playerCenterHeightReduction: 0.71 },
  './PlayerCharacter': { PlayerCharacter: 'player' }, './ThirdPersonCamera': { ThirdPersonCamera: 'camera' },
  './useKeyboardControls': { useKeyboardControls: () => ({ forward: true, backward: false, left: false, right: false }) },
  '../world/playerWorldState': { playerWorldState: { position: new THREE.Vector3() } },
  './footsteps': { playConcreteFootstep() {}, installFootstepAudioUnlock() {} },
});
CharacterController({ damageFlashUntil: 0, dialogue: null, restartKey: 0, transportDestination: null });
function check(expected, label) {
  for (let i = 0; i < 180; i++) if (focused) frame({ clock: { elapsedTime: now / 1000 } }, 1 / 60);
  assert(Math.abs(Math.hypot(velocity.x, velocity.z) - expected) < 0.0001, label);
}
check(13.2, 'normal movement with no Powers');
for (const mode of powers.powerOrder) {
  powers.resetTemporaryPowers(); now = 0;
  assert.equal(powers.collectFixPower(mode), true);
  assert(powers.hasPowerSpeedBoost(), `${mode} grants a movement boost`);
  check(18.4, `${mode} uses the unchanged boosted movement speed`);
  now = powers.powerDurations[mode];
  assert(!powers.hasPowerSpeedBoost());
  check(13.2, `${mode} alone returns to normal at expiry`);
}
powers.resetTemporaryPowers(); now = 0;
powers.collectFixPower('standard');
now = 2000; powers.collectFixPower('power');
now = 3000; powers.collectFixPower('rapid');
check(18.4, 'three active Powers do not multiply the movement boost');
now = 6000; check(18.4, 'Wind expiry keeps the boost while other Powers remain');
now = 13000; check(18.4, 'Shock expiry keeps the boost while Fire remains');
focused = false;
assert.equal(powers.getPowerRemainingMs('power'), 4000);
assert(powers.hasPowerSpeedBoost(), 'paused remaining Power preserves its boost');
focused = true;
now = 17000; check(13.2, 'only the last active expiry ends the boost');
now = 20000; powers.collectFixPower('standard');
now = 25000; powers.collectFixPower('standard');
now = 26000; check(18.4, 'refilling a Power extends its own movement boost');
now = 31000; check(13.2, 'refilled Power ends at its new expiry');
powers.collectFixPower('power'); powers.resetTemporaryPowers();
check(13.2, 'reset clears boosted movement with the Power timers');
console.log('Power movement passed: actual controller speeds, each Power, overlaps, no stacking, last expiry, pause, refill and reset.');
