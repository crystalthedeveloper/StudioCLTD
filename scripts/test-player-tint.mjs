import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
const colors=['#2F6FAF','#6B3A8E','#B63A3A'];
const order=['standard','rapid','power'];
const exports={};
const deps={three:THREE,'./temporaryPowers':{powerOrder:order,powerModes:Object.fromEntries(order.map((key,i)=>[key,{color:colors[i]}]))},'./speedBoost':{speedBoostColor:'#facc15'},'./playerDimensions':{playerSphereRadius:.3}};
vm.runInNewContext(ts.transpileModule(readFileSync('src/player/powerAppearance.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:id=>deps[id]});
const appearance=exports.createPowerAppearance();
const shader={uniforms:{},vertexShader:THREE.ShaderLib.physical.vertexShader,fragmentShader:THREE.ShaderLib.physical.fragmentShader};
appearance.compile(shader);
assert(shader.fragmentShader.includes('latitude >= 0.5'));
assert(shader.vertexShader.includes('vPowerHeight = position.y'));
for(let mask=0;mask<8;mask++)for(const speed of [false,true]){
 appearance.update(mask,speed);
 const expected=colors.filter((_,i)=>mask&(1<<i));
 assert.equal(shader.uniforms.powerCount.value,expected.length);
 assert.equal(shader.uniforms.speedActive.value,Number(speed));
 expected.forEach((color,i)=>assert(shader.uniforms.powerColors.value[i].equals(new THREE.Color(color))));
}
const player=readFileSync('src/player/PlayerCharacter.tsx','utf8');
for(const property of ['roughness={0.18}','metalness={0.15}','transmission={0.35}','thickness={0.8}','ior={1.35}','clearcoat={0.7}','clearcoatRoughness={0.2}'])assert(player.includes(property));
console.log('Crystal appearance passed: all 16 power/speed combinations, reusable uniforms, hemisphere split and unchanged crystal settings.');
