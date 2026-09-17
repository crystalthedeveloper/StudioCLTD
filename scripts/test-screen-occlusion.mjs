import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';

// Exercise the real surface dimensions and occluder collector without a WebGL context.
const source = readFileSync('src/world/systems/HubSections.tsx', 'utf8');
const ast = ts.createSourceFile('HubSections.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ['screenContentScale', 'screenContentSize', 'screenBackingZ', 'screenContentZ', 'screenTextZ', 'screenControlZ', 'screenContentGeometry', 'tvFrameGeometry', 'tvBackingGeometry'];
const declarations = ast.statements.filter(node =>
  ts.isVariableStatement(node) && node.declarationList.declarations.some(d => names.includes(d.name.getText(ast))) ||
  ts.isFunctionDeclaration(node) && ['collectScreenOccluders', 'screenGroupHeight'].includes(node.name?.text)
).map(node => node.getText(ast)).join('\n');
const context = { ...THREE, result: null };
vm.runInNewContext(ts.transpileModule(`${declarations}\nresult = { ${names.join(', ')}, collectScreenOccluders, screenGroupHeight };`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020 },
}).outputText, context);
const surface = context.result;
const sectionContext = { exports: {} };
vm.runInNewContext(ts.transpileModule(readFileSync('src/world/hubSections.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, sectionContext);
const sections = [...sectionContext.exports.hubSections, { id: 'home-base', position: [12000, 4.9, 12007], entrance: [0, -1] }];
let views = 0;
for (const section of sections) for (const scale of [1, .78]) {
  const scene = new THREE.Scene();
  const tv = new THREE.Group();
  tv.position.fromArray(section.position);
  tv.rotation.y = Math.atan2(...section.entrance);
  tv.scale.setScalar(scale);
  scene.add(tv);
  const frame = new THREE.Mesh(surface.tvFrameGeometry, new THREE.MeshBasicMaterial());
  frame.position.z = -.08;
  const backing = new THREE.Mesh(surface.tvBackingGeometry, new THREE.MeshBasicMaterial());
  backing.position.set(0, .1, surface.screenBackingZ);
  const media = new THREE.Mesh(surface.screenContentGeometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  media.position.set(0, -.03, surface.screenContentZ);
  tv.add(frame, backing, media);
  scene.updateMatrixWorld(true);
  const target = media.getWorldPosition(new THREE.Vector3());
  // Derive the viewing side from each actual entrance, independently of the media offset.
  const front = new THREE.Vector3(section.entrance[0], 0, section.entrance[1]);
  const sideways = new THREE.Vector3(front.z, 0, -front.x);
  for (const distance of [2, 10, 45]) for (const angle of [-.5, 0, .5]) {
    const camera = target.clone().addScaledVector(front, distance).addScaledVector(sideways, angle * distance);
    const ray = new THREE.Raycaster(camera, target.clone().sub(camera).normalize());
    assert.equal(ray.intersectObject(tv)[0]?.object, media, `${section.id}: media visible from entrance at ${distance}, angle ${angle}`);
    const rock = new THREE.Mesh(new THREE.SphereGeometry(.4), new THREE.MeshBasicMaterial());
    rock.position.copy(camera).lerp(target, .5);
    scene.add(rock); scene.updateMatrixWorld(true);
    assert.equal(ray.intersectObject(scene)[0]?.object, rock, `${section.id}: foreground rock hides media`);
    const refs = [];
    surface.collectScreenOccluders(scene, tv, refs, new WeakMap());
    assert.equal(refs.length, 1, 'only the foreground rock is an HTML occluder');
    rock.raycast = () => {}; // Match scenery, which disables gameplay raycasting.
    assert.equal(ray.intersectObjects(refs.map(ref => ref.current))[0]?.object, rock, 'HTML still detects scenery with gameplay raycasting disabled');
    rock.position.copy(target).addScaledVector(front, -2);
    scene.updateMatrixWorld(true);
    assert.equal(ray.intersectObject(scene)[0]?.object, media, 'scenery behind TV does not hide media');
    rock.visible = false;
    refs.length = 0; surface.collectScreenOccluders(scene, tv, refs, new WeakMap());
    assert.equal(refs.length, 0, 'hidden scenery and the TV are excluded');
    scene.remove(rock); rock.geometry.dispose(); rock.material.dispose();
    views++;
  }
  const back = target.clone().addScaledVector(front, -10);
  assert.equal(new THREE.Raycaster(back, front).intersectObject(tv)[0]?.object, frame, 'solid back of TV hides media');
}
// Instanced winter scenery deliberately disables its own raycast handler.
const scene = new THREE.Scene(), ownTV = new THREE.Group();
const trees = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 4, 1), new THREE.MeshBasicMaterial(), 1);
trees.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, 0, 3));
trees.raycast = () => {};
scene.add(ownTV, trees); scene.updateMatrixWorld(true);
const refs = [], proxies = new WeakMap();
surface.collectScreenOccluders(scene, ownTV, refs, proxies);
const treeRay = new THREE.Raycaster(new THREE.Vector3(0, 0, 10), new THREE.Vector3(0, 0, -1));
assert.equal(treeRay.intersectObjects(refs.map(ref => ref.current))[0]?.object, trees);
const cachedProxy = refs[0];
refs.length = 0; surface.collectScreenOccluders(scene, ownTV, refs, proxies);
assert.equal(refs[0], cachedProxy, 'reuse occlusion proxies across frames');
trees.material.opacity = 0;
refs.length = 0; surface.collectScreenOccluders(scene, ownTV, refs, proxies);
assert.equal(refs.length, 0, 'invisible effects do not occlude HTML');
for (const [path] of source.matchAll(/\/images\/[^"\s]+\.(?:jpg|webp|png)/g)) {
  assert(existsSync(`public${path}`), `screen image exists: ${path}`);
}
// The offset emissive backing must stay under the media, with enough inset
// for the depth gap when viewed up to 60 degrees above or below the screen.
const mediaTop = -.03 + surface.screenContentSize[1] / 2;
const mediaBottom = -.03 - surface.screenContentSize[1] / 2;
const backingTop = .1 + surface.tvBackingGeometry.parameters.height / 2;
const backingBottom = .1 - surface.tvBackingGeometry.parameters.height / 2;
const obliqueInset = (surface.screenContentZ - surface.screenBackingZ) * Math.tan(Math.PI / 3);
assert(backingTop + obliqueInset < mediaTop, 'no exposed emissive line above the media');
assert(backingBottom - obliqueInset > mediaBottom, 'backing stays beneath the media at the bottom');
assert(surface.screenBackingZ > -.08 + .32 / 2);
assert(surface.screenContentZ > surface.screenBackingZ);
assert(surface.screenTextZ > surface.screenContentZ);
assert(surface.screenControlZ > surface.screenTextZ);
assert(surface.screenContentSize[0] < 10.4 && surface.screenContentSize[1] < 5.8, 'media fits within TV bezel');
assert(!/depthTest=\{false\}|renderOrder=|zIndexRange=/.test(source));
console.log(`Screen occlusion regression passed: ${views} entrance-side views across 8 world TVs and Home Base, desktop/mobile scales, foreground/background scenery, rear views, and HTML self-exclusion.`);

for (const floor of [0, 0.6, 1.5, 2.1, 4.2]) for (const [scale, offset] of [[1, 0], [.78, -.55]]) {
  const height = surface.screenGroupHeight(scale, offset);
  const bottom = floor + height + offset - surface.tvFrameGeometry.parameters.height * scale / 2;
  assert(Math.abs(bottom - floor - .5) < 1e-9, 'consistent half-unit frame clearance on all platforms and screen sizes');
}
console.log('Screen floor clearance passed for desktop/mobile and raised platforms.');
