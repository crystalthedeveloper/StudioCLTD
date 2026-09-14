import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
function load(path, deps = {}, extra = '') {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, 'utf8') + extra, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, require: id => deps[id] ?? {} });
  return exports;
}
const sections = load('src/world/hubSections.ts');
const layout = load('src/world/worldLayout.ts', { './hubSections': sections });
const { hubSections, destinationPlatformRadius: radius, sectionRampApproachLength: run, sectionRampWidth: width } = sections;
const { groundCenter, groundSize, walkingRoutes, walkingLoop, rampLanding } = layout;
assert.equal(new Set(hubSections.map(s => s.id)).size, 8);
assert.equal(hubSections.reduce((a,b) => a.position[1] > b.position[1] ? a : b).id, 'showcase');
assert.deepEqual(walkingLoop[0], walkingLoop.at(-1));
await RAPIER.init();
const world = new RAPIER.World({x:0,y:-20,z:0});
world.createCollider(RAPIER.ColliderDesc.cuboid(groundSize[0]/2, .09, groundSize[1]/2).setTranslation(groundCenter[0], -.09, groundCenter[1]));
const obstacles = new RAPIER.World({x:0,y:0,z:0});
for (const section of hubSections) {
  const [x,h,z] = section.position, [dx,dz] = section.entrance;
  assert.equal(Math.hypot(dx,dz), 1);
  for (const other of hubSections) if (other !== section) {
    assert(Math.abs(x-other.position[0]) >= radius*2+6 || Math.abs(z-other.position[2]) >= radius*2+6, `${section.id}: platform gap`);
  }
  assert(Math.abs(x-groundCenter[0])+radius+5 < groundSize[0]/2 && Math.abs(z-groundCenter[1])+radius+5 < groundSize[1]/2, `${section.id}: ground/camera margin`);
  const desc = () => RAPIER.ColliderDesc.cuboid(radius,h/2,radius).setTranslation(x,h/2,z);
  world.createCollider(desc()); obstacles.createCollider(desc());
  const angle = Math.atan2(h,run), length = Math.hypot(h,run), thickness=.36;
  const offset = radius + run/2 - thickness/2*Math.sin(angle);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(angle,Math.atan2(dx,dz),0,'YXZ'));
  world.createCollider(RAPIER.ColliderDesc.cuboid(width/2,thickness/2,length/2)
    .setTranslation(x+dx*offset,h/2-thickness/2*Math.cos(angle),z+dz*offset).setRotation(q));
}
world.step(); obstacles.step();
function groundHeight(x,z) {
  const hit = world.castRay(new RAPIER.Ray({x,y:12,z},{x:0,y:-1,z:0}),20,true);
  assert(hit, `No floor at ${x},${z}`); return 12-hit.timeOfImpact;
}
// Sweep a player-sized capsule across the complete path width, for both control profiles.
for (const profile of ['desktop keyboard', 'mobile touch']) {
  for (const route of walkingRoutes) for (let i=1;i<route.length;i++) {
    const a=route[i-1],b=route[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    for (let d=0;d<=len;d+=.4) for (const side of [-3,0,3]) {
      const x=a[0]+(b[0]-a[0])*d/len-(b[1]-a[1])*side/len;
      const z=a[1]+(b[1]-a[1])*d/len+(b[0]-a[0])*side/len;
      assert(!obstacles.intersectionWithShape({x,y:1.1,z},{x:0,y:0,z:0,w:1},new RAPIER.Capsule(.65,.38)), `${profile}: blocked path at ${x},${z}`);
      assert(groundHeight(x,z)>=-.01);
    }
  }
  for (const section of hubSections) {
    const [x,h,z]=section.position,[dx,dz]=section.entrance;
    const landing=rampLanding(section);
    assert(walkingRoutes.some(route => route.some(p=>Math.hypot(p[0]-landing[0],p[1]-landing[1])<.01)),`${section.id}: path reaches ramp`);
    let previous=0;
    for(let distance=run;distance>=0;distance-=.25){
      const y=groundHeight(x+dx*(radius+distance),z+dz*(radius+distance));
      assert(y>=previous-.04 && y-previous<.15,`${section.id}: walkable ramp gradient`); previous=y;
    }
    assert(Math.abs(previous-h)<.04);
    assert(groundHeight(x+dx*16,z+dz*16)<h+2.2-1.03,`${section.id}: teleport has clearance`);
  }
}
const {createPathGeometry}=load('src/world/pathGeometry.ts', {three:THREE,'./worldLayout':layout});
const geometry=createPathGeometry();
assert(geometry.getAttribute('position').count/3<1000,'single low-triangle paving mesh');
for(const n of geometry.getAttribute('normal').array) assert(Number.isFinite(n));
const logos=load('src/world/systems/LogoLightField.tsx', {
  three:THREE,'../worldLayout':layout,'../hubSections':sections,
  './HomeBase':{homeBaseCenter:[12000,.6,12000]},
  './TransportPads':{transportPadPositions:[[-3,-8],[0,-4],[3,-8],[-3,0],[3,0],[0,4],[-3,8],[3,8]],homeBaseTransportPadPosition:[12,0]},
  '../visualQuality':{isCompactVisualBudget:()=>true},
}, '\nexport { accessiblePlazaLogos };');
assert.equal(logos.accessiblePlazaLogos.length,32);
assert.equal(logos.accessiblePlazaLogos.filter(p=>p.kind==='coin').length,15);
assert.equal(logos.accessiblePlazaLogos.filter(p=>p.kind==='dark').length,3);
for (const [x,y,z] of layout.routePowerPositions) assert(Math.abs(groundHeight(x,z)-y)<.02, 'route powers accessible at ground height');
for (const [x,z] of layout.bonusRouteSpots) assert(groundHeight(x,z)<.02, 'bonus villains spawn on open ground');
for(const logo of logos.accessiblePlazaLogos) assert(groundHeight(...logo.position)<.02,`${logo.id}: pickup is on open ground`);
geometry.dispose();world.free();obstacles.free();
console.log('World layout tests passed: eight destinations, loop and ramp connectivity, desktop/mobile capsule clearance, ramp slopes, teleport landing clearance, pickup ground placement and paving budget.');
