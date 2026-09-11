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
const vector = (x,y=0,z=0) => new THREE.Vector3(x,y,z);
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

// Production power controls, inventory and timers run against deterministic game time.
const powers = load('src/player/temporaryPowers.ts', { './gameFocus': focus });
const inventory = () => JSON.parse(JSON.stringify(powers.getFixCharges()));
const empty = { standard: false, rapid: false, power: false };
powers.resetTemporaryPowers();
assert.deepEqual(inventory(), empty);
assert.equal(powers.getActivePower(), null);
assert.equal(powers.collectFixPower('standard'), false, 'paused pickup does nothing');
assert.equal(powers.handlePowerShortcut('Space'), false);
setGameFocused(true);
assert.equal(powers.handlePowerShortcut('Space'), false, 'empty Fix/Space cannot activate');
assert.equal(powers.handlePowerShortcut('KeyG'), false);
for (const mode of ['standard', 'rapid', 'power']) {
  assert.equal(powers.getPowerStatus(mode), 'EMPTY');
  assert.equal(powers.collectFixPower(mode), true);
  assert.equal(powers.collectFixPower(mode), true, 'ready power accepts a refill without stacking');
  assert.equal(powers.getPowerStatus(mode), 'READY');
  assert.equal(powers.getSelectedPower(), null);
  assert.equal(powers.getActivePower(), null, 'pickup alone creates no aura');
}
assert.equal(powers.handlePowerShortcut('Space'), false, 'READY must first be selected');
for (const mode of ['standard', 'rapid', 'power', 'standard']) {
  assert.equal(powers.handlePowerShortcut('KeyG'), true);
  assert.equal(powers.getSelectedPower(), mode);
  assert.equal(powers.getPowerStatus(mode), 'SELECTED');
  assert.equal(powers.getActivePower(), null, 'cycling only selects');
}
for (const key of ['KeyE', 'KeyH', 'KeyJ', 'Digit1']) assert.equal(powers.handlePowerShortcut(key), false, 'removed shortcuts do not activate');
assert.equal(powers.getActivePower(), null);
let defeats = 0;
assert.equal(powers.resolvePowerContact(true, () => defeats++), false, 'selection alone cannot defeat');
assert.equal(powers.handlePowerShortcut('Space'), true);
assert.equal(powers.getPowerStatus('standard'), 'ACTIVE');
assert.equal(powers.getPowerRemainingMs(), 6000);
assert.equal(powers.getFixCharges().standard, true, 'active power remains in collected inventory');
assert.equal(powers.hasPowerSpeedBoost(), false);
assert.equal(powers.resolvePowerContact(false, () => defeats++), false, 'no distant or obstructed kills');
assert.equal(powers.resolvePowerContact(true, () => defeats++), true);
assert.equal(defeats, 1);
assert.equal(powers.activateSelectedPower(), false, 'active power cannot be restarted by Fix');
advance(2000.25);
assert.equal(powers.getPowerRemainingMs(), 3999.75);
assert.equal(powers.selectFixPower('rapid'), true, 'HUD selection pauses the old effect');
assert.equal(powers.getActivePower(), null);
assert.equal(powers.getPowerStatus('standard'), 'PAUSED');
assert.equal(powers.getPowerRemainingMs('standard'), 3999.75, 'save sub-millisecond precision');
assert.equal(powers.getPowerRemainingMs('rapid'), 10000);
assert.equal(powers.resolvePowerContact(true, () => defeats++), false, 'switch removes contact power immediately');
advance(10000);
assert.equal(powers.getPowerRemainingMs('standard'), 3999.75, 'old expiry cannot empty a paused power');
assert.equal(powers.getPowerRemainingMs('rapid'), 10000, 'unactivated selection never drains');
assert.equal(powers.activateSelectedPower(), true);
assert.equal(powers.hasPowerSpeedBoost(), true);
advance(1250.5);
assert.equal(powers.handlePowerShortcut('KeyG'), true);
assert.equal(powers.getSelectedPower(), 'power');
assert.equal(powers.hasPowerSpeedBoost(), false, 'switch removes speed immediately');
assert.equal(powers.getPowerStatus('rapid'), 'PAUSED');
assert.equal(powers.getPowerRemainingMs('rapid'), 8749.5);
assert.equal(powers.handlePowerShortcut('KeyG'), true);
assert.equal(powers.getSelectedPower(), 'standard', 'G includes previously active powers');
assert.equal(powers.getPowerStatus('standard'), 'PAUSED');
assert.equal(powers.getPowerRemainingMs('standard'), 3999.75);
assert.equal(powers.getActivePower(), null, 'returning does not auto-activate');
assert.equal(powers.handlePowerShortcut('Space'), true);
assert.equal(powers.getPowerRemainingMs(), 3999.75, 'resume rather than refill');
setGameFocused(false);
advance(60000);
assert.equal(powers.getPowerRemainingMs(), 3999.75, 'global pause also freezes active timer');
assert.equal(powers.handlePowerShortcut('KeyG'), false, 'global pause blocks switching');
assert.equal(powers.collectFixPower('standard'), false);
assert.equal(powers.resolvePowerContact(true, () => defeats++), false);
setGameFocused(true);
advance(3999.75);
assert.equal(powers.getActivePower(), null);
assert.equal(powers.getPowerStatus('standard'), 'EMPTY');
assert.equal(powers.getSelectedPower(), 'standard', 'expired selection stays selected for empty meter');
assert.equal(powers.getPowerRemainingMs('standard'), 0);
assert.equal(powers.getPowerRemainingMs('rapid'), 8749.5, 'other timer never drains');
assert.equal(powers.getPowerStatus('power'), 'READY');
assert.equal(powers.resolvePowerContact(true, () => defeats++), false);
for (const [mode, duration] of [['standard', 6000], ['rapid', 10000], ['power', 15000]]) {
  powers.resetTemporaryPowers();
  powers.collectFixPower(mode); powers.selectFixPower(mode);
  assert.equal(powers.activateSelectedPower(), true, 'Fix button shares the activation action');
  assert.equal(powers.getPowerRemainingMs(), duration);
  assert.equal(powers.hasPowerSpeedBoost(), mode === 'rapid');
  advance(duration / 2);
  assert.equal(powers.getPowerRemainingMs(), duration / 2);
  assert.equal(powers.collectFixPower(mode), true, 'matching active pickup refreshes immediately');
  assert.equal(powers.getPowerRemainingMs(), duration, 'refresh restores a full bar');
  assert.equal(powers.getFixCharges()[mode], true, 'refreshed active power remains cycleable');
  assert.equal(powers.getPowerStatus(mode), 'ACTIVE');
  advance(duration / 2);
  assert.equal(powers.getActivePower(), mode, 'old expiry was cancelled');
  assert.equal(powers.getPowerRemainingMs(), duration / 2);
  assert.equal(powers.collectFixPower(mode), true, 'successive refreshes restart again');
  setGameFocused(false); advance(50000);
  assert.equal(powers.getPowerRemainingMs(), duration, 'refreshed timer pauses');
  setGameFocused(true);
  advance(duration - 1);
  assert.equal(powers.getActivePower(), mode);
  advance(1);
  assert.equal(powers.getActivePower(), null);
  assert.equal(powers.hasPowerSpeedBoost(), false);
  assert.equal(powers.getPowerStatus(mode), 'EMPTY');
}
// Requested Fire -> Wind -> Fire example, plus repeated switching and single-power cycling.
powers.resetTemporaryPowers();
powers.collectFixPower('power'); powers.selectFixPower('power'); powers.activateSelectedPower();
advance(7000);
powers.collectFixPower('standard');
assert.equal(powers.handlePowerShortcut('KeyG'), true);
assert.equal(powers.getSelectedPower(), 'standard');
assert.equal(powers.getPowerRemainingMs('power'), 8000);
assert.equal(powers.getActivePower(), null);
assert.equal(powers.activateSelectedPower(), true);
advance(500);
assert.equal(powers.handlePowerShortcut('KeyG'), true);
assert.equal(powers.getSelectedPower(), 'power');
assert.equal(powers.getPowerRemainingMs('power'), 8000);
assert.equal(powers.getPowerStatus('power'), 'PAUSED');
assert.equal(powers.activateSelectedPower(), true);
assert.equal(powers.getPowerRemainingMs(), 8000);
for (let i=0; i<20; i++) powers.handlePowerShortcut('KeyG');
advance(20000);
assert.equal(powers.getPowerRemainingMs('power'), 8000);
assert.equal(powers.getPowerRemainingMs('standard'), 5500);
assert.equal(powers.getActivePower(), null);
powers.resetTemporaryPowers();
assert.deepEqual(inventory(), empty);
for (const mode of Object.keys(empty)) assert.equal(powers.getPowerRemainingMs(mode), 0);
advance(20000);
assert.equal(powers.getActivePower(), null, 'reset cancels saved and active timers');
powers.collectFixPower('rapid');
assert.equal(powers.handlePowerShortcut('KeyG'), true);
assert.equal(powers.getSelectedPower(), 'rapid', 'G skips empty powers');
powers.activateSelectedPower(); advance(500);
powers.handlePowerShortcut('KeyG');
assert.equal(powers.getActivePower(), 'rapid', 'cycling the only collected power does not pause itself');
assert.equal(powers.getPowerRemainingMs(), 9500);
powers.resetTemporaryPowers();
powers.collectFixPower('standard'); powers.selectFixPower('standard'); powers.activateSelectedPower();
wall += 6001; // Model a throttled event loop with an expiry callback not delivered yet.
assert.equal(powers.getPowerStatus('standard'), 'EMPTY');
assert.equal(powers.collectFixPower('standard'), true);
advance(0);
assert.equal(powers.getPowerRemainingMs('standard'), 6000, 'late old expiry cannot erase a fresh pickup');
assert.equal(powers.getActivePower(), null);
powers.resetTemporaryPowers();
// Refills preserve activation/selection state and immediately restore each duration.
for (const mode of ['standard', 'rapid', 'power']) {
  powers.resetTemporaryPowers();
  powers.collectFixPower(mode);
  assert.equal(powers.collectFixPower(mode), true);
  assert.equal(powers.getPowerStatus(mode), 'READY');
  powers.selectFixPower(mode);
  assert.equal(powers.collectFixPower(mode), true);
  assert.equal(powers.getPowerStatus(mode), 'SELECTED');
  powers.activateSelectedPower(); advance(1234.5);
  const other = mode === 'standard' ? 'rapid' : 'standard';
  powers.collectFixPower(other); powers.selectFixPower(other); powers.activateSelectedPower();
  advance(100);
  const otherRemaining = powers.getPowerRemainingMs(other);
  assert.equal(powers.getPowerStatus(mode), 'PAUSED');
  assert.equal(powers.collectFixPower(mode), true);
  assert.equal(powers.getPowerStatus(mode), 'PAUSED');
  assert.equal(powers.getActivePower(), other, 'refill must not switch or activate');
  assert.equal(powers.getPowerRemainingMs(other), otherRemaining);
  assert.equal(powers.getPowerRemainingMs(mode), powers.powerDurations[mode]);
  powers.selectFixPower(mode);
  assert.equal(powers.collectFixPower(mode), true);
  assert.equal(powers.getPowerStatus(mode), 'PAUSED', 'selected paused power stays paused after refill');
  advance(20000);
  assert.equal(powers.getPowerRemainingMs(mode), powers.powerDurations[mode]);
  powers.activateSelectedPower();
  assert.equal(powers.getPowerRemainingMs(), powers.powerDurations[mode]);
}
powers.resetTemporaryPowers();
console.log('Power tests passed: exact saved timers, active switching, manual resume, Fire/Wind example, inventory/status, independent draining, refill, expiry, global pause, effects and reset.');

// Guide opening pauses the production clock and remembers whether closing should resume.
const { createGuidePauseSession } = load('src/player/guidePauseSession.ts', { './gameFocus': focus });
const guide = createGuidePauseSession();
powers.collectFixPower('standard'); powers.selectFixPower('standard'); powers.activateSelectedPower();
advance(250);
assert.equal(guide.open(), true);
assert.equal(focus.isGameFocused(), false);
assert.equal(guide.open(), false, 'reopening cannot overwrite the saved playing state');
advance(60000);
assert.equal(powers.getPowerRemainingMs(), 5750);
assert.equal(guide.close(), true);
setGameFocused(true);
advance(250);
assert.equal(powers.getPowerRemainingMs(), 5500);
setGameFocused(false);
guide.open(); assert.equal(guide.close(), false, 'already paused stays paused');
setGameFocused(true);
guide.open(); guide.cancelResume(); assert.equal(guide.close(), false, 'blur/hidden tab cancels automatic resume');
assert.equal(guide.isOpen(), false);
assert.equal(guide.close(), false, 'closing twice cannot resume again');
powers.resetTemporaryPowers();
console.log('Guide pause tests passed: exact timer freeze, restore playing state, preserve prior pause and cancel resume after blur.');

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
