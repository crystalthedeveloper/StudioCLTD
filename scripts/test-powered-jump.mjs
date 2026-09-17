import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(path, deps = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, require: id => deps[id] });
  return exports;
}
let now = 0, focused = true, grounded = true, launches = 0, hits = 0;
const jump = load('src/player/poweredJump.ts');
const power = load('src/player/temporaryPowers.ts', {
  './poweredJump': jump,
  './gameFocus': { gameNow: () => now, isGameFocused: () => focused,
    gameTimers: { setTimeout: () => 1, clearTimeout: () => {} } },
});
const unregister = jump.registerPoweredJump({
  launch: () => { if (!grounded) return false; launches++; return true; },
  airborne: () => !grounded,
});
assert.equal(power.handlePowerShortcut('Space'), false);
assert.equal(power.resolvePowerContact(true,'a',()=>hits++),false,'unpowered collision');
power.collectFixPower('standard');
assert.equal(power.handlePowerShortcut('Space'),true);
assert.equal(launches,1,'pickup activates; first press jumps');
jump.resetPoweredJump();
assert.equal(power.resolvePowerContact(false,'a',()=>hits++),false,'contact required');
assert.equal(power.resolvePowerContact(true,'a',()=>hits++),true,'grounded powered collision');
assert.equal(power.resolvePowerContact(true,'a',()=>hits++),false,'only one defeat');
assert.equal(power.handlePowerShortcut('Space'),true);
assert.equal(power.handlePowerShortcut('Space'),false,'no repeat launch');
grounded=false;
assert.equal(power.handlePowerShortcut('Space'),false,'no flying');
assert.equal(power.resolvePowerContact(true,'b',()=>hits++),true,'airborne powered collision');
assert.equal(power.resolvePowerContact(true,'a',()=>hits++),false,'jump cannot repeat defeat');
now=500;assert.equal(power.getPowerRemainingMs('standard'),5500,'timer runs during jump');
focused=false;assert.equal(power.resolvePowerContact(true,'c',()=>hits++),false);
focused=true;grounded=true;jump.resetPoweredJump();
assert.equal(power.handlePowerShortcut('Space'),true,'jump again after landing');
power.resetPowerContact('a');
assert.equal(power.resolvePowerContact(true,'a',()=>hits++),true,'respawned villain can be defeated again');
assert.equal(power.resolvePowerContact(true,'a',()=>hits++),false);
now=6001;assert.equal(power.resolvePowerContact(true,'c',()=>hits++),false,'expired power cannot defeat');
power.resetTemporaryPowers();
assert.equal(power.handlePowerShortcut('Space'),false);
power.collectFixPower('power');
assert.equal(power.resolvePowerContact(true,'a',()=>hits++),true,'restart resets defeated lives');
power.collectFixPower('standard');power.collectFixPower('rapid');
let reward=0;
assert.equal(power.resolvePowerContact(true,'reward',(_,amount)=>reward+=amount),true);
assert.equal(reward,33);
assert.equal(power.resolvePowerContact(true,'reward',(_,amount)=>reward+=amount),false);
assert.equal(reward,33);
unregister();assert.equal(jump.requestPoweredJump(),false);
assert.equal(hits,4);
console.log('Powered contact/jump passed: unpowered protection, ground/air contact, duplicate guard, respawn, expiry, pause and launch lock.');
