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
assert.equal(shooter.fireFixShot(), true, 'restart clears capacity and cooldown');
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
