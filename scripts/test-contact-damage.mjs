import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
let now = 0, focused = true, protectedByPower = false;
function load(path, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { exports, require: id => dependencies[id] });
  return exports;
}
const { createContactDamageGate, contactDamageCooldownMs } = load('src/player/contactDamage.ts', {
  './gameFocus': { gameNow: () => now, isGameFocused: () => focused },
  './temporaryPowers': { isPowerActive: () => protectedByPower },
});
const { createVillainContact } = load('src/villain/villainContact.ts');
const gate = createContactDamageGate();
const villain = createVillainContact(), otherVillain = createVillainContact();
let hearts = 3, hits = 0;
function contactDamage() { if (hearts > 0 && gate.claim() !== null) { hearts--; hits++; } }
villain.enter(1, contactDamage);
assert.equal(hearts, 2, 'first collider entry immediately removes exactly one heart');
villain.enter(1, contactDamage); villain.enter(2, contactDamage);
otherVillain.enter(1, contactDamage);
for (let frame = 0; frame < 100; frame++) { villain.update(contactDamage); otherVillain.update(contactDamage); }
assert.equal(hearts, 2, 'duplicate events, multiple colliders and villains share one cooldown');
now = contactDamageCooldownMs - 1; villain.update(contactDamage); assert.equal(hearts, 2);
now++; villain.update(contactDamage); otherVillain.update(contactDamage);
assert.equal(hearts, 1, 'sustained contact hits at cooldown expiry without a new collision event');
villain.exit(1); assert.equal(villain.touching(), true, 'other collider still touching');
villain.exit(2); otherVillain.exit(1);
now += contactDamageCooldownMs; villain.update(contactDamage); otherVillain.update(contactDamage);
assert.equal(hearts, 1, 'no damage after separation');
otherVillain.enter(9, contactDamage); assert.equal(hearts, 0, 'different villain applies same one-heart rule');
now += contactDamageCooldownMs; otherVillain.update(contactDamage); assert.equal(hearts, 0, 'health does not underflow');
hearts = 3; gate.reset(); protectedByPower = true;
otherVillain.update(contactDamage); assert.equal(hearts, 3, 'active power prevents contact damage');
protectedByPower = false; otherVillain.update(contactDamage);
assert.equal(hearts, 2, 'protected contact does not consume a cooldown');
focused = false; now += 5000; otherVillain.update(contactDamage); assert.equal(hearts, 2, 'paused events cannot damage');
focused = true; gate.reset(); hearts = 3;
otherVillain.update(contactDamage); assert.equal(hearts, 2, 'respawn/reset clears old cooldown');
// Bonus enemies call the same health callback directly from geometric contact.
now += contactDamageCooldownMs; contactDamage(); villain.enter(5, contactDamage);
assert.equal(hearts, 1, 'bonus and platform contact cannot double-hit');
console.log('Contact damage tests passed: immediate hit, continuous contact, separation, multiple villains/colliders, power protection, pause, reset and zero-health guard.');
