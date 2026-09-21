import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
function load(path,deps={}){
 const exports={};
 vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:id=>id==='three'?THREE:deps[id]});return exports;
}
const rolling=load('src/player/rollingMotion.ts');
const motion=rolling.createRollingMotion(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0),r=.3;
motion.update(new THREE.Vector3(),up,r,1/60,q);
let distance=0;
for(let i=1;i<=60;i++)distance+=motion.update(new THREE.Vector3(i*Math.PI*r/60,0,0),up,r,1/60,q);
assert(Math.abs(distance-Math.PI*r)<1e-10);
assert(Math.abs(q.angleTo(new THREE.Quaternion())-Math.PI)<1e-7,'half circumference gives half revolution');
const before=q.clone();motion.update(new THREE.Vector3(Math.PI*r,0,0),up,r,1/60,q);assert(q.equals(before),'no rotation at rest');
assert.equal(motion.update(new THREE.Vector3(100,0,0),up,r,1/60,q),-1);assert(q.equals(before),'teleport does not spin');
motion.reset();q.identity();
const slope=new THREE.Vector3(-1,1,0).normalize();
motion.update(new THREE.Vector3(),slope,r,1/60,q);
const traveled=motion.update(new THREE.Vector3(.1,.1,0),slope,r,1/60,q);
assert(Math.abs(traveled-Math.sqrt(.02))<1e-10,'ramp uses full surface distance');
assert(Math.abs(q.angleTo(new THREE.Quaternion())-traveled/r)<1e-7);
await RAPIER.init();
const world=new RAPIER.World({x:0,y:-20,z:0});
world.createCollider(RAPIER.ColliderDesc.cuboid(20,.1,20).setTranslation(0,-.1,0),world.createRigidBody(RAPIER.RigidBodyDesc.fixed()));
world.updateSceneQueries();
const frames=[],effects=[],meshes=[];let focused=true;
const scene=new THREE.Scene();
function jsx(type,props){
 if(props?.ref){const object=type==='instancedMesh'?new THREE.InstancedMesh(...props.args):new THREE.Mesh(props.geometry,props.material);props.ref.current=object;meshes.push(object);}
 return {type,props};
}
const visual=load('src/player/PlayerRollingEffects.tsx',{
 react:{useMemo:fn=>fn(),useRef:current=>({current}),useEffect:cb=>effects.push(cb)},
 'react/jsx-runtime':{jsx,jsxs:jsx},
 '@react-three/fiber':{useThree:fn=>fn({scene}),useFrame:cb=>frames.push(cb),createPortal:tree=>tree},
 '@react-three/rapier':{useRapier:()=>({world,rapier:RAPIER})},
 './gameFocus':{isGameFocused:()=>focused,subscribeGameFocus:()=>()=>{}},
 './playerDimensions':{playerSphereRadius:r},'./rollingMotion':rolling,
 '../world/winterTheme':{WINTER_THEME_ENABLED:true},'../world/visualQuality':{isCompactVisualBudget:()=>false},
});
const ball=new THREE.Mesh();ball.position.y=r;scene.add(ball);
visual.PlayerRollingEffects({sphere:{current:ball}});
const dispose=effects.map(cb=>cb());
const camera=new THREE.PerspectiveCamera();
const frame=()=>frames.forEach(cb=>cb({camera},1/60));
frame();
const [shadow,trail,puffs]=meshes;
assert(shadow.visible);assert(Math.abs(shadow.position.y-.009)<1e-5);
ball.position.x+=.2;frame();
const active=mesh=>Array.from(mesh.geometry.attributes.instanceOpacity.array).filter(v=>v>0).length;
assert(active(trail)>0 && active(puffs)>0,'movement leaves trail and puffs');
const emitted = active(puffs); frame(); assert(active(puffs) <= emitted, 'stopping emits no new particles');
assert(active(puffs) > 0, 'existing particles fade naturally after stopping');
for (let i = 0; i < 40; i++) frame();
assert.equal(active(trail),0); assert.equal(active(puffs),0,'short trail fully fades after stopping');
ball.position.y=1;ball.position.x+=.2;frame();assert.equal(active(puffs),0,'no emission airborne');
ball.position.y=r;ball.position.x+=.2;frame();assert(active(puffs)>=3,'moving landing adds burst');
focused=false;frame();assert.equal(active(puffs),0);assert.equal(active(trail),0);
dispose.forEach(cb=>cb());world.free();
console.log('Rolling effects passed: radius/distance rotation, ramps, rest, teleport, contact shadow, movement emission, airborne suppression, landing burst and stop-emission, natural fade and pause cleanup.');
