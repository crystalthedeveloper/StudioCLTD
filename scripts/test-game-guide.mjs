import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

let open = 'How to Play', refIndex = 0, closed = 0;
const refs = [], effects = [], listeners = new Map();
const document = { body: {}, activeElement: null };
class Element {
  isConnected = true;
  focus() { document.activeElement = this; }
}
const previousFocus = new Element(); previousFocus.focus();
const runtime = {
  jsx: (type, props) => typeof type === 'function' ? type(props) : ({ type, props }),
  jsxs: (type, props) => typeof type === 'function' ? type(props) : ({ type, props }),
};
const dependencies = {
  react: {
    useState: () => [open, next => { open = typeof next === 'function' ? next(open) : next; }],
    useRef: () => refs[refIndex++] ?? (refs[refIndex - 1] = { current: null }),
    useEffect: effect => { if (!effects.length) effects.push(effect); },
  },
  'react-dom': { createPortal: tree => tree },
  'react/jsx-runtime': runtime,
  '../player/powerIcons': { powerIcons: { standard: { worldSrc: 'wind.svg' }, rapid: { worldSrc: 'lightning.svg' }, power: { worldSrc: 'fire.svg' } } },
};
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync('src/ui/GameGuide.tsx', 'utf8'), {
  fileName: 'GameGuide.tsx', compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports, require: id => dependencies[id], document, HTMLElement: Element,
  window: { addEventListener: (name, fn, capture) => listeners.set(name, {fn, capture}), removeEventListener: name => listeners.delete(name) },
});
const render = () => { refIndex = 0; return exports.GameGuide({ onClose: () => closed++ }); };
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props?.children)];
}
let tree = render();
const all = () => nodes(tree);
const toggles = () => all().filter(n => n.type === 'button' && 'aria-expanded' in n.props);
const regions = () => all().filter(n => n.props?.role === 'region');
assert.equal(toggles().length, 4);
assert.deepEqual(toggles().map(n => n.props['aria-expanded']), [true, false, false, false]);
assert.equal(regions().filter(n => !n.props.hidden).length, 1);
for (let i = 0; i < 4; i++) {
  toggles()[i].props.onClick(); tree = render();
  assert.ok(regions().filter(n => !n.props.hidden).length <= 1);
  if (!toggles()[i].props['aria-expanded']) { toggles()[i].props.onClick(); tree = render(); }
  assert.equal(regions()[i].props.hidden, false);
  assert.equal(regions().filter(n => !n.props.hidden).length, 1);
  assert.ok(nodes(toggles()[i]).some(n => n.type === 'svg'), 'every section has a chevron');
}
const buttons = Array.from({length:5}, () => new Element());
refs[0].current = { querySelectorAll: () => buttons, contains: element => buttons.includes(element) };
refs[1].current = buttons[0];
const cleanup = effects[0]();
assert.equal(document.activeElement, buttons[0], 'close button receives opening focus');
assert.equal(listeners.get('keydown').capture, true, 'ESC handled before gameplay key listeners');
function key(key, shiftKey=false) {
  const event = { key, shiftKey, prevented:false, stopped:false, preventDefault(){this.prevented=true;}, stopImmediatePropagation(){this.stopped=true;} };
  listeners.get('keydown').fn(event); return event;
}
buttons.at(-1).focus(); assert.equal(key('Tab').prevented, true); assert.equal(document.activeElement, buttons[0]);
assert.equal(key('Tab', true).prevented, true); assert.equal(document.activeElement, buttons.at(-1));
const escape = key('Escape'); assert.ok(escape.prevented && escape.stopped); assert.equal(closed, 1);
cleanup(); assert.equal(document.activeElement, previousFocus); assert.equal(listeners.size, 0);
console.log('Game Guide tests passed: four sections, default/open exclusivity, chevrons, keyboard focus trap, ESC interception and focus restoration.');
