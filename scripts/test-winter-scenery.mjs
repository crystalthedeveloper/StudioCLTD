import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
function load(path,deps={}){
 const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:id=>deps[id]});return exports;
}
const sections=load('src/world/hubSections.ts');
const world=load('src/world/worldLayout.ts',{'./hubSections':sections});
const models=load('src/world/scenery/sceneryModels.ts',{three:THREE,'three/examples/jsm/utils/BufferGeometryUtils.js':{mergeGeometries}});
const layout=load('src/world/scenery/sceneryLayout.ts',{'../hubSections':sections,'../worldLayout':world,'./sceneryModels':models});
const items=layout.createSceneryLayout();
const counts=Object.fromEntries(['pine','rock','snowbank'].map(kind=>[kind,items.filter(i=>i.kind===kind).length]));
console.log('Scenery counts:',counts);
for(const [kind,count] of Object.entries(counts))assert(count>0,`missing ${kind}`);
assert.deepEqual(items,layout.createSceneryLayout(),'deterministic placement');
assert.equal(counts.pine,34,'reuse original pine count');
assert.equal(counts.rock,43,'reuse original rock count');
assert(items.filter(i=>i.featured&&i.kind==='pine').length>=4,'foreground pines');
assert(items.filter(i=>i.featured&&i.kind==='rock').length>=2,'foreground rocks');
assert(items.filter(i=>i.featured&&i.kind==='snowbank').length===2,'two visible outer-path banks');
const mobile=layout.selectSceneryItems(items,layout.scenerySettings.mobile.density);
assert.equal(mobile.length,Math.floor(items.length*.55));
assert(mobile.filter(i=>i.featured).length===items.filter(i=>i.featured).length);
for(const item of items)assert(layout.sceneryClearance(item.x,item.z,item.radius,item.kind==='pine',item.featured),'path/platform/pickup/sightline clearance');
for(let variant=0;variant<3;variant++){
 const near=models.createPineModel(variant),far=models.createPineModel(variant,true);
 const triangles=model=>[model.wood,model.needles].reduce((n,g)=>n+g.index.count/3,0);
 assert(triangles(far)<triangles(near)*.6,'distant trees reduce geometry');
 for(const model of [near,far])for(const g of Object.values(model)){
  assert(g.boundingSphere.radius<5,'bounded canopy');
  assert([...g.getAttribute('position').array].every(Number.isFinite));g.dispose();
 }
 const rock=models.createRockModel(variant),low=models.createRockModel(variant,true);
 assert(low.getAttribute('position').count<rock.getAttribute('position').count);
 rock.dispose();low.dispose();
}
assert(layout.scenerySettings.mobile.distance<layout.scenerySettings.desktop.distance);
assert(layout.scenerySettings.mobile.density<layout.scenerySettings.desktop.density);
console.log('Winter scenery tests passed: reusable models, lower LOD geometry, deterministic placement, route/platform/pickup/sightline clearances and mobile budgets.');
// Exercise the actual shader patches; GLSL reserved identifiers must not return.
const {createSceneryMaterials}=load('src/world/scenery/sceneryMaterials.ts',{three:THREE});
const textures=Array.from({length:5},()=>new THREE.Texture());
const materials=createSceneryMaterials(textures);
for(const material of [materials.foliage,materials.wood,materials.stone]){
 const shader={vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>'};
 material.onBeforeCompile(shader,{});
 assert(shader.fragmentShader.includes('snowPatchNoise'));
 assert(!/\bpatch\b/.test(shader.fragmentShader),'reserved GLSL identifier breaks actual rendering');
}
Object.values(materials).forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
console.log('Scenery shader regression passed.');
