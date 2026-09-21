import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(path, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => dependencies[name] ?? {} });
  return exports;
}
const formatter = load('src/ui/formatCash.ts');
const { GameHud } = load('src/ui/GameHud.tsx', {
  './formatCash': formatter,
  react: { useEffect() {}, useSyncExternalStore: (_, snapshot) => snapshot() },
  'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
  '../player/gameFocus': { useGameFocus: () => false },
  '../player/temporaryPowers': { powerModes: {}, getFixCharges: () => ({}), getSelectedPower: () => null, getActivePower: () => null, isPowerActive: () => false },
  '../audio/gameAudio': { useGameAudioEnabled: () => true },
  '../audio/villainAudio': { getActiveVillainVoiceId: () => null },
});
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props?.children)];
}
for (const [cash, expected] of [[0, '$0'], [500, '$500'], [1000, '$1,000'], [10000, '$10,000'], [1234567, '$1,234,567'], [Number.MAX_SAFE_INTEGER, '$9,007,199,254,740,991']]) {
  assert.equal(formatter.formatCash(cash), expected);
  const tree = GameHud({ cash, completedSectionCount: 0, health: 3, guideOpen: false });
  const stat = nodes(tree).find(node => node.props?.className?.includes('game-hud__stat--cash'));
  assert.equal(stat.props['aria-label'], `Cash: ${expected}`);
  assert.equal(stat.props.children[0].props.children, 'Cash');
  assert.equal(stat.props.children[1].props.children, expected);
  assert.equal(stat.props.children[1].props.title, expected);
  assert.equal(stat.props.style['--cash-characters'], expected.length, 'responsive sizing accounts for dollar sign and separators');
}
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]);
}
for (const path of files('src').filter(p => /\.(tsx?|css)$/.test(p))) {
  assert(!/\bscore\b/i.test(readFileSync(path, 'utf8')), `Legacy label/reference in ${path}`);
}
console.log('Cash tests passed: actual HUD label/value/accessibility, whole-dollar grouping through max-safe integer, sizing length and no legacy source labels.');
