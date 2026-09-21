import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the real power store and meter together with deterministic game time.
let now = 0, focused = true, timerId = 0, frameId = 0, rendering;
const amounts = {}, mounted = new Set();

const timers = new Map(), frames = new Map(), focusListeners = new Set(), effects = [];
const focus = {
  gameNow: () => now,
  isGameFocused: () => focused,
  subscribeGameFocus: listener => { focusListeners.add(listener); return () => focusListeners.delete(listener); },
  gameTimers: {
    setTimeout: (callback, delay) => { timers.set(++timerId, { callback, due: now + delay }); return timerId; },
    clearTimeout: id => timers.delete(id),
  },
};
function load(path, dependencies) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    fileName: path, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, require: id => id === './effectColors' ? load('src/player/effectColors.ts', {}) : dependencies[id], window: {
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
  } });
  return exports;
}
const jump = load('src/player/poweredJump.ts', {});
const powers = load('src/player/temporaryPowers.ts', { './gameFocus': focus, './poweredJump': jump });
const runtime = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const { PowerMeter: render } = load('src/ui/PowerMeter.tsx', {
  react: {
    useSyncExternalStore: (_, get) => get(),
    useState: initial => { const mode = rendering; return [amounts[mode] ?? initial(), value => { amounts[mode] = value; }]; },
    useEffect: effect => { if (!mounted.has(rendering)) { mounted.add(rendering); effects.push(effect); } },
  },
  'react/jsx-runtime': runtime,
  '../player/powerIcons': load('src/player/powerIcons.ts', {}),
  '../player/gameFocus': focus,
  '../player/temporaryPowers': powers,
});
function advance(ms) {
  if (!focused) return;
  now += ms;
  for (const [id, timer] of timers) if (timer.due <= now) { timers.delete(id); timer.callback(); }
  for (const [id, callback] of [...frames]) { frames.delete(id); callback(); }
}
function setFocus(value) { focused = value; focusListeners.forEach(listener => listener()); }
function treeFor(mode) { rendering = mode; return render({mode}); }
function check(mode, amount, draining) {
  if (mode === null) {
    for (const key of Object.keys(powers.powerModes)) check(key, powers.getPowerRemainingMs(key), false);
    return;
  }
  const tree = treeFor(mode);
  const duration = powers.powerDurations[mode];
  assert.equal(tree.props.style['--power-color'], powers.powerModes[mode].color);
  assert.equal(tree.props.children[0].props.style.transform, `scaleX(${amount / duration})`);
  assert.equal(tree.props.children[2].props['aria-valuenow'], Math.round(amount / duration * 100));
  assert.equal(tree.props['aria-pressed'], amount > 0);
  assert.equal(frames.size, focused ? powers.getActivePowers().length : 0, 'every active bar updates independently');
}
for (const mode of Object.keys(powers.powerModes)) treeFor(mode);
const cleanups = effects.map(effect => effect());
check(null, 0, false);
for (const mode of Object.keys(powers.powerModes)) powers.collectFixPower(mode);
check('standard',6000,true);check('rapid',10000,true);check('power',15000,true);
advance(1250.5);check('standard',4749.5,true);check('rapid',8749.5,true);check('power',13749.5,true);
powers.collectFixPower('standard');check('standard',6000,true);check('power',13749.5,true);
setFocus(false);advance(60000);check('standard',6000,false);check('rapid',8749.5,false);
setFocus(true);advance(6000);check('standard',0,false);check('rapid',2749.5,true);
advance(7749.5);check('power',0,false);
powers.resetTemporaryPowers();check(null,0,false);
cleanups.forEach(cleanup => cleanup());
assert.equal(focusListeners.size, 0);
assert.equal(frames.size, 0);
powers.collectFixPower('standard');
assert.equal(frames.size, 0, 'unmount unsubscribes from the power store');
powers.resetTemporaryPowers();
console.log('Power meter integration passed: concurrent bars, independent refill/expiry, pause and cleanup.');
