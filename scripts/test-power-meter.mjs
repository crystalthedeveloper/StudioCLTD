import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the real power store and meter together with deterministic game time.
let now = 0, focused = true, timerId = 0, frameId = 0, remaining = 0;
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
  vm.runInNewContext(code, { exports, require: id => dependencies[id], window: {
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
  } });
  return exports;
}
const powers = load('src/player/temporaryPowers.ts', { './gameFocus': focus });
const runtime = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const { PowerMeter: render } = load('src/ui/PowerMeter.tsx', {
  react: {
    useSyncExternalStore: (_, get) => get(),
    useState: () => [remaining, value => { remaining = value; }],
    useEffect: effect => { if (effects.length === 0) effects.push(effect); },
  },
  'react/jsx-runtime': runtime,
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
function check(mode, amount, draining) {
  const tree = render();
  const duration = mode ? powers.powerDurations[mode] : 1;
  assert.equal(tree.props.style['--power-color'], mode ? powers.powerModes[mode].color : '#777');
  const track = tree.props.children[1];
  assert.equal(track.props.children.props.style.transform, `scaleX(${amount / duration})`);
  assert.equal(track.props['aria-valuenow'], Math.round(amount / duration * 100));
  assert.equal(frames.size, draining ? 1 : 0, 'only selected active power schedules frames');
}
render();
const cleanup = effects[0]();
check(null, 0, false);
for (const mode of Object.keys(powers.powerModes)) powers.collectFixPower(mode);
check(null, 0, false);
powers.selectFixPower('power'); check('power', 15000, false);
powers.activateSelectedPower(); check('power', 15000, true);
advance(7000); check('power', 8000, true);
powers.cycleFixPower(); check('standard', 6000, false);
assert.equal(powers.getPowerStatus('power'), 'PAUSED');
advance(30000); check('standard', 6000, false);
powers.activateSelectedPower(); advance(1250.5); check('standard', 4749.5, true);
powers.cycleFixPower(); check('rapid', 10000, false);
powers.cycleFixPower(); check('power', 8000, false);
advance(50000); check('power', 8000, false);
powers.collectFixPower('power'); check('power', 15000, false);
assert.equal(powers.getPowerStatus('power'), 'PAUSED');
powers.activateSelectedPower(); check('power', 15000, true);
setFocus(false); advance(60000); check('power', 15000, false);
setFocus(true); check('power', 15000, true);
advance(1000); check('power', 14000, true);
powers.collectFixPower('power'); check('power', 15000, true);
advance(15000); check('power', 0, false);
assert.equal(powers.getPowerStatus('power'), 'EMPTY');
assert.equal(powers.canActivatePower(), false);
powers.cycleFixPower(); check('standard', 4749.5, false);
assert.equal(powers.getPowerStatus('standard'), 'PAUSED');
powers.activateSelectedPower(); advance(4749.5); check('standard', 0, false);
powers.cycleFixPower(); check('rapid', 10000, false);
powers.activateSelectedPower(); advance(2500); check('rapid', 7500, true);
powers.resetTemporaryPowers(); check(null, 0, false);
cleanup();
assert.equal(focusListeners.size, 0);
assert.equal(frames.size, 0);
powers.collectFixPower('standard'); powers.selectFixPower('standard'); powers.activateSelectedPower();
assert.equal(frames.size, 0, 'unmount unsubscribes from the power store');
powers.resetTemporaryPowers();
console.log('Power meter integration passed: all colours, immediate G selection, READY/full, PAUSED/saved, ACTIVE/draining, EMPTY/zero, refill, global pause and cleanup.');
