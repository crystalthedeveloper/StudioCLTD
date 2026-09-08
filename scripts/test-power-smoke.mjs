import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';

const exports = {};
const code = ts.transpileModule(readFileSync('src/player/powerSmoke.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
vm.runInNewContext(code, { exports, require: () => THREE });
const { createPowerSmoke, powerSmokeStrength } = exports;
for (const duration of [6000, 10000, 15000]) {
  const ignition = powerSmokeStrength(duration, duration);
  const sustained = powerSmokeStrength(duration - 1500, duration);
  assert(ignition > sustained * 1.6, 'activation briefly strengthens the smoke');
  assert(sustained > 0.2 && ignition <= 0.600001, 'sustained smoke stays light and ignition remains translucent');
  assert(powerSmokeStrength(900, duration) < powerSmokeStrength(1800, duration));
  assert(powerSmokeStrength(100, duration) < powerSmokeStrength(900, duration));
  assert.equal(powerSmokeStrength(0, duration), 0, 'expiry is fully invisible');
  assert.equal(powerSmokeStrength(-1, duration), 0);
  assert.equal(powerSmokeStrength(duration, duration), ignition, 'timer refill restores ignition');
}
for (const color of ['#339DFF', '#FFD60A', '#FF3838']) {
  const desktop = createPowerSmoke(color, false), mobile = createPowerSmoke(color, true);
  assert.equal(desktop.geometry.instanceCount, 18);
  assert.equal(mobile.geometry.instanceCount, 10, 'mobile reduces overlapping smoke');
  for (const smoke of [desktop, mobile]) {
    assert.equal(smoke.geometry.index.count, 6, 'each wisp is just two triangles');
    assert.equal(smoke.material.depthWrite, false, 'transparent smoke does not hide geometry behind it');
    assert.equal(smoke.material.depthTest, true, 'smoke respects world occlusion');
    assert(smoke.material.uniforms.uColor.value.equals(new THREE.Color(color)));
    assert.equal(smoke.material.uniforms.uStrength.value, 0, 'new material cannot render a full-opacity first frame');
    const texture = smoke.material.uniforms.uSmoke.value;
    assert.equal(texture.image.data[3], 0, 'texture corners are transparent');
    assert.equal(texture.image.data[(127 * 128 + 127) * 4 + 3], 0);
    let geometryDisposed = false, materialDisposed = false;
    smoke.geometry.addEventListener('dispose', () => { geometryDisposed = true; });
    smoke.material.addEventListener('dispose', () => { materialDisposed = true; });
    smoke.geometry.dispose(); smoke.material.dispose();
    assert(geometryDisposed && materialDisposed);
  }
  assert.equal(desktop.material.uniforms.uSmoke.value, mobile.material.uniforms.uSmoke.value, 'all instances reuse one baked texture');
}
console.log('Smoke aura tests passed: ignition, sustained translucency, expiry fade, refill, colours, mobile budget, occlusion and resource cleanup.');
