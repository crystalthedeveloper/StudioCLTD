import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

let now = 0, focused = true, active = null, until = 0, frameId = 0, remaining = 0;
const frames = new Map(), powerListeners = new Set(), focusListeners = new Set();
const effects = [];
const powerModes = { standard: { color: '#339DFF' }, rapid: { color: '#FFD60A' }, power: { color: '#FF3838' } };
const powerDurations = { standard: 6000, rapid: 10000, power: 15000 };
const subscribe = set => listener => { set.add(listener); return () => set.delete(listener); };
const runtime = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const dependencies = {
  react: {
    useSyncExternalStore: (_, get) => get(),
    useState: () => [remaining, value => { remaining = value; }],
    useEffect: effect => { if (effects.length === 0) effects.push(effect); },
  },
  'react/jsx-runtime': runtime,
  '../player/gameFocus': { isGameFocused: () => focused, subscribeGameFocus: subscribe(focusListeners) },
  '../player/temporaryPowers': {
    getActivePower: () => active,
    getPowerRemainingMs: () => Math.max(0, until - now),
    subscribePowers: subscribe(powerListeners), powerDurations, powerModes,
  },
};
const exports = {};
const code = ts.transpileModule(readFileSync('src/ui/PowerMeter.tsx', 'utf8'), {
  fileName: 'PowerMeter.tsx', compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
vm.runInNewContext(code, {
  exports, require: id => dependencies[id], window: {
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
  },
});
const render = exports.PowerMeter;
render();
const cleanup = effects[0]();
assert.equal(frames.size, 0, 'empty meter schedules no animation');
for (const mode of Object.keys(powerModes)) {
  active = mode; until = now + powerDurations[mode];
  powerListeners.forEach(listener => listener());
  let tree = render();
  assert.equal(tree.props.style['--power-color'], powerModes[mode].color);
  assert.equal(tree.props.children[1].props.children.props.style.transform, 'scaleX(1)', 'activation/refill is immediately full');
  assert.equal(frames.size, 1);
  now += powerDurations[mode] / 2;
  const [id, frame] = [...frames][0]; frames.delete(id); frame();
  tree = render();
  assert.equal(tree.props.children[1].props.children.props.style.transform, 'scaleX(0.5)', 'bar renders current game-time fraction each frame');
  focused = false; focusListeners.forEach(listener => listener());
  assert.equal(frames.size, 0, 'pause cancels the animation loop');
  assert.equal(remaining, powerDurations[mode] / 2);
  focused = true; focusListeners.forEach(listener => listener());
  assert.equal(frames.size, 1, 'resume starts exactly one loop');
  until = now + powerDurations[mode]; powerListeners.forEach(listener => listener());
  assert.equal(remaining, powerDurations[mode], 'matching refresh updates immediately even when active type is unchanged');
  assert.equal(frames.size, 1, 'refresh replaces the pending frame instead of multiplying loops');
  active = null; until = now; powerListeners.forEach(listener => listener());
  assert.equal(frames.size, 0);
  assert.equal(render().props.children[1].props.children.props.style.transform, 'scaleX(0)');
}
cleanup();
assert.equal(powerListeners.size, 0);
assert.equal(focusListeners.size, 0);
assert.equal(frames.size, 0);
console.log('Power meter tests passed: active colours, smooth frame updates, instant refill, pause/resume, expiry and cleanup.');
