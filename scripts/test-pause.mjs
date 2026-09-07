import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Test actual production modules against deterministic wall time and media.
let wall = 0;
let nextId = 0;
const pending = new Map();
const host = {
  setTimeout(callback, delay) { const id = ++nextId; pending.set(id, { callback, due: wall + delay }); return id; },
  clearTimeout(id) { pending.delete(id); },
};
function advance(ms) {
  const end = wall + ms;
  for (;;) {
    const next = [...pending.entries()].filter(([, task]) => task.due <= end).sort((a,b) => a[1].due - b[1].due)[0];
    if (!next) break;
    wall = next[1].due;
    pending.delete(next[0]);
    next[1].callback();
  }
  wall = end;
}
function load(path, deps = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, require: (id) => deps[id] ?? {}, window: host, performance: { now: () => wall } });
  return exports;
}
const focus = load('src/player/gameFocus.ts');
const { gameTimers, gameNow, setGameFocused } = focus;
let hits = 0;
gameTimers.setTimeout(() => hits++, 1000);
advance(5000);
assert.equal(gameNow(), 0);
assert.equal(hits, 0);
assert.equal(pending.size, 0, 'no native timers run before play');
setGameFocused(true);
advance(400);
setGameFocused(false);
assert.equal(pending.size, 0);
advance(60000);
assert.equal(gameNow(), 400);
assert.equal(hits, 0);
setGameFocused(true);
advance(599);
assert.equal(hits, 0);
advance(1);
assert.equal(hits, 1, 'timeout resumes with exactly its remaining duration');
let ticks = 0;
const interval = gameTimers.setInterval(() => ticks++, 100);
advance(250);
setGameFocused(false);
advance(10000);
assert.equal(ticks, 2);
setGameFocused(true);
advance(49);
assert.equal(ticks, 2);
advance(1);
assert.equal(ticks, 3, 'interval resumes without catch-up ticks');
gameTimers.clearInterval(interval);
setGameFocused(false);
const cancelled = gameTimers.setTimeout(() => { throw Error('cancelled timer fired'); }, 10);
gameTimers.clearTimeout(cancelled);
setGameFocused(true);
advance(100);
assert.equal(pending.size, 0);

const media = load('src/audio/gameMedia.ts', { '../player/gameFocus': focus });
const listeners = {};
const clip = {
  paused: true, ended: false, currentTime: 12.5,
  addEventListener(type, callback) { listeners[type] = callback; },
  play() { this.paused = false; listeners.play?.(); return Promise.resolve(); },
  pause() { this.paused = true; },
};
media.registerGameMedia(clip);
await media.playGameMedia(clip);
setGameFocused(false);
assert.equal(clip.paused, true);
assert.equal(clip.currentTime, 12.5);
setGameFocused(true);
await Promise.resolve();
assert.equal(clip.paused, false);
assert.equal(clip.currentTime, 12.5);
setGameFocused(false);
media.stopGameMedia(clip);
setGameFocused(true);
assert.equal(clip.paused, true, 'explicitly stopped media must not restart');
setGameFocused(false);
await media.playGameMedia(clip);
assert.equal(clip.paused, true, 'media requested while paused is deferred');
setGameFocused(true);
await Promise.resolve();
assert.equal(clip.paused, false);
setGameFocused(false);
assert.equal(pending.size, 0);
console.log('Pause regression tests passed: initial pause, frozen clock, remaining timers, intervals, cancellation, media pause/resume and stop.');

// Exercise the animation hook with real Three.js mixers and a deterministic
// skeleton, including initialization before any render callback runs.
const THREE = await import('three');
const layouts = [];
const frames = [];
const hook = load('src/player/useGameFrame.ts', {
  react: {
    useRef: (current) => ({ current }),
    useMemo: (factory) => factory(),
    useLayoutEffect: (effect) => layouts.push(effect),
  },
  '@react-three/fiber': { useFrame: (callback) => frames.push(callback) },
  three: THREE,
  './gameFocus': focus,
});
const root = new THREE.Group();
root.position.set(5, 2, 8);
const joint = new THREE.Bone();
joint.name = 'Joint';
root.add(joint);
const idleClip = new THREE.AnimationClip('idle', 1, [
  new THREE.NumberKeyframeTrack('Joint.position[x]', [0, 1], [3, 4]),
]);
const combatClip = new THREE.AnimationClip('combat', 1, [
  new THREE.NumberKeyframeTrack('Joint.position[x]', [0, 1], [10, 20]),
]);
const { actions } = hook.useGameAnimations([idleClip, combatClip], { current: root }, 'idle');
const cleanups = layouts.map((effect) => effect());
assert.equal(joint.position.x, 3, 'idle pose is evaluated before the first frame');
assert.deepEqual(root.position.toArray(), [5, 2, 8]);
actions.combat.play();
setGameFocused(true);
frames.forEach((frame) => frame({}, 0.4));
assert.equal(joint.position.x, 14);
setGameFocused(false);
assert.equal(joint.position.x, 3, 'pausing combat displays idle');
frames.forEach((frame) => frame({}, 60));
assert.equal(actions.combat.time, 0.4, 'paused rendering never advances combat');
assert.equal(joint.position.x, 3);
assert.deepEqual(root.position.toArray(), [5, 2, 8], 'idle preview never moves world position');
setGameFocused(true);
assert.equal(joint.position.x, 14, 'resume restores the exact saved combat pose');
frames.forEach((frame) => frame({}, 0.1));
assert.equal(joint.position.x, 15, 'combat continues from its saved time');
setGameFocused(false);
setGameFocused(true);
assert.equal(joint.position.x, 15, 'repeated pause/resume preserves pose');
cleanups.forEach((cleanup) => cleanup?.());
setGameFocused(false);
console.log('Animation tests passed: first-frame idle, paused idle, fixed world position, combat timing and repeated resume.');

// Shared firing controller: mouse/touch pointer IDs and keyboard use identical
// press/release semantics, one cooldown, and one bounded active-shot registry.
const shooter = load('src/player/fixShooter.ts', { './gameFocus': focus });
const shots = [];
const unsubscribeShot = shooter.subscribeFixShot((id) => shots.push(id));
shooter.resetFixShooter();
shooter.setFixHeld('keyboard', true);
assert.equal(shots.length, 0, 'input cannot fire or resume while paused');
setGameFocused(true);
shooter.collectFixAmmo("standard");
shooter.setFixHeld('keyboard', true);
assert.equal(shots.length, 1, 'Space fires immediately');
shooter.setFixHeld('keyboard', true);
shooter.setFixHeld('pointer:1', true);
assert.equal(shots.length, 1, 'keyboard autorepeat and overlapping mouse press cannot bypass cooldown');
advance(179);
assert.equal(shots.length, 1);
advance(1);
assert.equal(shots.length, 2, 'holding repeats at the cooldown');
shooter.setFixHeld('keyboard', false);
advance(180);
assert.equal(shots.length, 3, 'releasing Space preserves a held mouse button');
shooter.setFixHeld('pointer:1', false);
advance(1000);
assert.equal(shots.length, 3, 'pointer release/cancel stops firing');
shooter.setFixHeld('pointer:7', true);
shooter.setFixHeld('pointer:7', false);
shooter.setFixHeld('pointer:8', true);
assert.equal(shots.length, 4, 'rapid mobile taps share the same cooldown');
advance(180 * 10);
assert.equal(shots.length, 8, 'active projectiles are capped without replacing earlier shots');
assert.equal(new Set(shots).size, 8, 'each projectile owns a unique ID');
shooter.releaseFixShot(shots[2]);
advance(16);
assert.equal(shots.length, 9, 'completing one shot frees exactly one slot');
setGameFocused(false);
const shotsBeforePause = shots.length;
advance(10000);
assert.equal(shots.length, shotsBeforePause);
assert.equal(shooter.isFixHeld(), false);
setGameFocused(true);
advance(1000);
assert.equal(shots.length, shotsBeforePause, 'resume never fires stale held input');
shooter.resetFixShooter();
assert.equal(shooter.fireFixShot(), false, "restart starts empty");
shooter.collectFixAmmo("standard");
assert.equal(shooter.fireFixShot(), true, "pickup reloads after restart");
unsubscribeShot();
shooter.resetFixShooter();
setGameFocused(false);
const collision = load('src/world/projectileCollision.ts', { three: THREE });
const vector = (x,y=0,z=0) => new THREE.Vector3(x,y,z);
assert.equal(collision.segmentEllipsoidHit(vector(-10), vector(10), vector(0), 1,1,1), 0.45, 'swept hit catches a target between frames');
assert.equal(collision.segmentEllipsoidHit(vector(-10,3), vector(10,3), vector(0), 1,2,1), null, 'near miss does not deal damage');
assert.equal(collision.segmentEllipsoidHit(vector(0), vector(10), vector(0), 1,1,1), 0, 'shot starting in a hitbox registers once');
assert.equal(collision.segmentEllipsoidHit(vector(2), vector(2), vector(0), 1,1,1), null, 'stationary segment outside target misses');
const near = collision.segmentEllipsoidHit(vector(-10), vector(10), vector(-3), 1,1,1);
const far = collision.segmentEllipsoidHit(vector(-10), vector(10), vector(3), 1,1,1);
assert(near < far, 'nearest target wins independent of registration order');
console.log('Fix shooter tests passed: keyboard/mouse/touch input semantics, repeated taps, hold, shared cooldown, independent IDs, cap, pause/restart and swept hit detection.');

// Independent reserves, safe selection, and existing shortcut isolation.
setGameFocused(true);
shooter.resetFixShooter();
const fired = [];
const stopInventoryShots = shooter.subscribeFixShot((id, mode) => { fired.push(mode); shooter.releaseFixShot(id); });
const inventory = () => JSON.parse(JSON.stringify(shooter.getFixReserves()));
assert.deepEqual(inventory(), { standard: 0, rapid: 0, power: 0 });
assert.equal(shooter.fireFixShot(), false);
for (const code of ['KeyG', 'KeyH', 'KeyJ']) assert.equal(shooter.selectFixWeaponByKey(code), false);
shooter.collectFixAmmo('standard');
assert.equal(shooter.getFixMode(), 'standard');
shooter.collectFixAmmo('power');
shooter.collectFixAmmo('rapid');
assert.deepEqual(inventory(), { standard: 10, rapid: 20, power: 5 });
assert.equal(shooter.getFixMode(), 'standard', 'pickup preserves a usable current weapon');
shooter.collectFixAmmo('power');
assert.deepEqual(inventory(), { standard: 10, rapid: 20, power: 10 });
for (const [code, mode] of [['KeyG','standard'], ['KeyH','rapid'], ['KeyJ','power']]) {
  assert.equal(shooter.selectFixWeaponByKey(code), true);
  assert.equal(shooter.getFixMode(), mode);
}
assert.equal(fired.length, 0, 'click/shortcut selection never fires');
assert.equal(shooter.selectFixWeaponByKey('Digit1'), false, 'existing 1–4 controls remain unrelated');
assert.equal(shooter.fireFixShot(), true);
assert.deepEqual(inventory(), { standard: 10, rapid: 20, power: 9 });
shooter.selectFixWeapon('rapid');
assert.equal(shooter.fireFixShot(), false, 'switching cannot bypass firing cooldown');
advance(650);
shooter.setFixHeld('keyboard', true);
assert.equal(shooter.isFixHeld(), true);
const beforeSwitch = fired.length;
shooter.selectFixWeapon('power');
assert.equal(shooter.isFixHeld(), false);
advance(1000);
assert.equal(fired.length, beforeSwitch, 'selection cancels inherited held fire');
while (shooter.getFixAmmo() > 0) { advance(650); shooter.fireFixShot(); }
assert.equal(shooter.selectFixWeapon('power'), false, 'empty reserve cannot be selected');
assert.equal(shooter.fireFixShot(), false);
shooter.collectFixAmmo('rapid');
assert.equal(shooter.getFixMode(), 'rapid', 'pickup auto-selects when current reserve is empty');
assert.deepEqual(inventory(), { standard: 10, rapid: 39, power: 0 });
setGameFocused(false);
const pausedInventory = inventory();
assert.equal(shooter.collectFixAmmo('power'), false);
assert.equal(shooter.selectFixWeapon('standard'), false);
assert.equal(shooter.fireFixShot(), false);
assert.deepEqual(inventory(), pausedInventory);
shooter.resetFixShooter();
assert.deepEqual(inventory(), { standard: 0, rapid: 0, power: 0 });
stopInventoryShots();
console.log('Inventory tests passed: separate/additive reserves, zero start/reset, G/H/J, no firing on selection, cooldown/hold isolation, empty weapons, automatic pickup selection and pause guards.');

// Actual animation time, rather than contact entry or browser timers, controls damage.
const combatModule = load('src/villain/villainCombat.ts', { three: THREE, '../player/gameFocus': focus });
const actor = new THREE.Object3D();
const actorMixer = new THREE.AnimationMixer(actor);
const makeAction = (name, duration) => actorMixer.clipAction(new THREE.AnimationClip(name, duration, [new THREE.NumberKeyframeTrack('.position[x]', [0,duration], [0,0])]));
const combatActions = { idleV: makeAction('idleV', 1), runV: makeAction('runV', 1), attackV: makeAction('attackV', 1.25), dieV: makeAction('dieV', 1) };
const combat = combatModule.createVillainCombat(combatActions);
let damage = 0;
const impact = () => damage++;
setGameFocused(true);
combat.setMotion('idle');
assert.equal(combat.updateAttack(true, true, impact), true);
assert.equal(damage, 0, 'entering range does not immediately deal damage');
actorMixer.update(0.57);
combat.updateAttack(true, true, impact);
assert.equal(damage, 0);
actorMixer.update(0.02);
combat.updateAttack(true, true, impact);
assert.equal(damage, 1, 'damage occurs at the strike time');
actorMixer.update(0.1);
combat.updateAttack(true, true, impact);
assert.equal(damage, 1, 'one attack cannot hit twice');
setGameFocused(false);
combat.updateAttack(true, true, impact);
advance(5000);
assert.equal(damage, 1, 'paused attacks do no damage');
setGameFocused(true);
actorMixer.update(0.7);
combat.updateAttack(true, true, impact);
combat.updateAttack(true, true, impact);
assert.equal(combatActions.attackV.isRunning(), false, 'recovery cooldown prevents immediate restart');
advance(450);
combat.updateAttack(true, true, impact);
actorMixer.update(0.3);
assert.equal(combat.updateAttack(false, true, impact), false, 'leaving range immediately allows chasing');
actorMixer.update(0.5);
combat.updateAttack(false, true, impact);
assert.equal(damage, 1, 'cancelled strike cannot deal late damage');
advance(450);
combat.updateAttack(true, true, impact);
actorMixer.update(0.3);
combat.updateAttack(true, false, impact);
actorMixer.update(0.6);
combat.updateAttack(true, false, impact);
assert.equal(damage, 1, 'death interrupts the attack');
setGameFocused(false);
console.log('Villain combat tests passed: animation-timed impact, one hit per cycle, cooldown, range cancellation, death interruption and paused damage guard.');

// Run navigation clearance and attack sight checks against real Rapier colliders.
const rapierModule = await import('@dimforge/rapier3d-compat');
const rapier = rapierModule.default;
await rapier.init();
const navigationWorld = new rapier.World({ x: 0, y: 0, z: 0 });
const colliderStates = new Map();
function addCollider(x, y, z, hx, hy, hz, name = '') {
  const body = navigationWorld.createRigidBody(rapier.RigidBodyDesc.fixed().setTranslation(x,y,z));
  const collider = navigationWorld.createCollider(rapier.ColliderDesc.cuboid(hx,hy,hz), body);
  const object = new THREE.Object3D(); object.name = name;
  colliderStates.set(collider.handle, { object });
  return body;
}
addCollider(0,-0.25,0,14,0.25,14);
addCollider(0,1.25,0,0.5,1.25,0.25,'Screen');
addCollider(2,1,0,0.4,1,0.4,'StudioCLTDPlayer');
const selfBody = addCollider(4,1.2,0,0.5,1.25,0.5,'Villain');
navigationWorld.step();
const navigationModule = load('src/villain/useVillainNavigation.ts', {
  react: { useMemo: (factory) => factory() },
  '@react-three/rapier': { useRapier: () => ({ world: navigationWorld, rapier, colliderStates }) },
  three: THREE,
  '../world/playerCollision': load('src/world/playerCollision.ts', { three: THREE }),
});
const navigation = navigationModule.useVillainNavigation();
assert.equal(navigation.clear(0,0,0), false, 'screen blocks movement volume');
assert.equal(navigation.clear(-2,0,0), true, 'standing above platform floor is allowed');
assert.equal(navigation.clear(2,0,0), true, 'player collider does not trap chasing logic');
assert.equal(navigation.clear(4,0,0,selfBody), true, 'villain excludes its own collider');
assert.equal(navigation.sight(vector(-2),vector(2)), false, 'screen blocks attack line of sight');
navigationWorld.free();
console.log('Rapier navigation tests passed: screen blocking, floor clearance, player/self filtering and attack line of sight.');
