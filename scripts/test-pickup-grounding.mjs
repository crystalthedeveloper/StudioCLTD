import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
await RAPIER.init();
const world = new RAPIER.World({x:0,y:-20,z:0});
function box(x,y,z,hx,hy,hz,kind='fixed',sensor=false,rotation) {
 const desc=kind==='fixed'?RAPIER.RigidBodyDesc.fixed():RAPIER.RigidBodyDesc.dynamic();
 desc.setTranslation(x,y,z); if(rotation)desc.setRotation(rotation);
 return world.createCollider(RAPIER.ColliderDesc.cuboid(hx,hy,hz).setSensor(sensor),world.createRigidBody(desc));
}
box(0,-.1,0,20,.1,20);
box(5,2.8,0,2,.2,2);
box(0,3,0,1,.5,1,'fixed',true);
box(0,4,0,1,.5,1,'dynamic');
const angle=.25;
box(-5,1,0,2,.1,2,'fixed',false,new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),angle));
const frames=[], refs=[]; let state;
const deps={
 'three':THREE,
 '@react-three/fiber':{useFrame:cb=>frames.push(cb)},
 '@react-three/rapier':{useRapier:()=>({world,rapier:RAPIER})},
 'react':{useMemo:fn=>fn(),useRef:current=>{const ref={current};refs.push(ref);return ref;},useState:fn=>[fn(),next=>{state=next;}]},
 'react/jsx-runtime':{jsx:(type,props)=>({type,props})},
};
const exports={};
vm.runInNewContext(ts.transpileModule(readFileSync('src/world/pickupSurface.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:id=>deps[id]});
exports.usePickupSurfaces([[0,0,0],[5,0,0],[-5,0,0]]);frames[0]();
assert(Math.abs(state[0].y)<1e-5,'ignore sensors and dynamic actors');
assert(Math.abs(state[1].y-3)<1e-5,'platform surface');
assert(Math.abs(state[2].y-(1+.1/Math.cos(angle)))<1e-5,'ramp surface');
assert(Math.abs(state[2].normal.y-Math.cos(angle))<1e-5);
box(10,1.8,0,1,.2,1);frames[0]();
const surface=state[2];
exports.GroundedPickupVisual({surface,children:null});
const root=refs.at(-1).current=new THREE.Group();
const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.675,.675));
mesh.rotation.set(-.2,.7,.1);root.add(mesh);
frames.at(-1)();root.updateMatrixWorld(true);
let lowest=Infinity;
for(let i=0;i<mesh.geometry.attributes.position.count;i++){
 const v=new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(mesh.matrixWorld);
 lowest=Math.min(lowest,v.dot(new THREE.Vector3().copy(surface.normal)));
}
assert(Math.abs(lowest-exports.pickupSurfaceGap)<1e-6,'rotated visual rests above slope without clipping');
world.free();
console.log('Pickup grounding passed: floor, platform, ramp, actor/sensor exclusion and rotated visual clearance.');
