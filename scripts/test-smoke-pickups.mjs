import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import RAPIER from '@dimforge/rapier3d-compat';
await RAPIER.init();
const world=new RAPIER.World({x:0,y:0,z:0}), events=new RAPIER.EventQueue(true);
let hits=0,respawn,frame,cleanup,enabled=true;
const refs=[];
const jsx=(type,props)=>({type,props});
const deps={
 '@react-three/rapier':{BallCollider:'collider',RigidBody:'body'},
 react:{useMemo:fn=>fn(),useRef:current=>{const ref={current};refs.push(ref);return ref;},useState:initial=>[initial,()=>{}],useEffect:fn=>{cleanup=fn();}},
 'react/jsx-runtime':{jsx,jsxs:jsx},
 '../visualQuality':{isCompactVisualBudget:()=>false},
 './PickupSmokeGlow':{PickupSmokeGlow:'glow'},
 '../pickupSurface':{pickupSurfaceGap:.015},'../worldLayout':{routePowerPositions:[]},'../hubSections':{hubSections:[]},'./HomeBase':{homeBaseCenter:[0,0,0]},
 '../playerCollision':{isPlayerObject:object=>object?.name==='StudioCLTDPlayer'},
 '../../audio/collectibleSounds':{playCollectibleSound:()=>{}},
 '../../player/temporaryPowers':{powerOrder:['standard','rapid','power'],powerModes:{standard:{color:'#009B3A'}},collectFixPower:()=>{hits++;return true;},fixPowerRespawnMs:20000},
 '../../player/powerSmoke':{createPowerSmoke:()=>({geometry:{dispose(){}},material:{uniforms:{uTime:{value:0},uStrength:{value:0}},dispose(){}}})},
 '../../player/gameFocus':{gameNow:()=>0,gameTimers:{setTimeout:fn=>{respawn=fn;return 1;},clearTimeout(){}}},
 '../../player/useGameFrame':{useGameFrame:fn=>{frame=fn;}},
};
const exports={};
vm.runInNewContext(ts.transpileModule(readFileSync('src/world/systems/FixPowerPickups.tsx','utf8')+'\nexport { SmokePickup };',{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:id=>deps[id]});
const tree=exports.SmokePickup({x:0,z:0,surface:{y:0},mode:'standard'});
const props=tree.props.children[0].props;
const pickup=world.createCollider(RAPIER.ColliderDesc.ball(props.args[0]).setTranslation(0,.255,0).setSensor(true).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),world.createRigidBody(RAPIER.RigidBodyDesc.fixed()));
refs[0].current=pickup;
const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(.6,.3,0));
const player=world.createCollider(RAPIER.ColliderDesc.ball(.3),body);
function step(){world.step(events);events.drainCollisionEvents((a,b,started)=>{
 if(![a,b].includes(player.handle))return;
 const event={other:{collider:player,rigidBodyObject:{name:'StudioCLTDPlayer'}}};
 (started?props.onIntersectionEnter:props.onIntersectionExit)(event);
});frame();}
step();assert.equal(hits,0,'nearby without overlap is not collected');
body.setTranslation({x:.45,y:.3,z:0},true);step();assert.equal(hits,1,'actual collider overlap collects');
step();step();assert.equal(hits,1,'one collection per spawn');
body.setTranslation({x:2,y:.3,z:0},true);step();respawn();step();assert.equal(hits,1,'no stale overlap on respawn');
body.setTranslation({x:.45,y:.3,z:0},true);step();assert.equal(hits,2,'respawn can be collected again');
step();respawn();step();assert.equal(hits,3,'standing inside a respawned sensor creates a fresh overlap');
cleanup();world.free();events.free();
console.log('Smoke pickup physics passed: no nearby collection, overlap activation, duplicate guard and respawn.');
