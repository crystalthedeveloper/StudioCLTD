import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
const colors=['#009B3A','#FED100','#CE1126'];
const order=['standard','rapid','power'];
const exports={};
const deps={three:THREE,'./temporaryPowers':{powerOrder:order,powerModes:Object.fromEntries(order.map((key,i)=>[key,{color:colors[i]}]))},'./playerDimensions':{playerSphereRadius:.3}};
vm.runInNewContext(ts.transpileModule(readFileSync('src/player/powerAppearance.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:id=>deps[id]});
const appearance=exports.createPowerAppearance();
const shader={uniforms:{},vertexShader:THREE.ShaderLib.physical.vertexShader,fragmentShader:THREE.ShaderLib.physical.fragmentShader};
appearance.compile(shader);
assert(!('speedActive' in shader.uniforms));
assert(!('speedColor' in shader.uniforms));
assert(shader.vertexShader.includes('vPowerHeight = position.y'));
for(let mask=0;mask<8;mask++){
 appearance.update(mask);
 const expected=colors.filter((_,i)=>mask&(1<<i));
 assert.equal(shader.uniforms.powerCount.value,expected.length);
 expected.forEach((color,i)=>assert(shader.uniforms.powerColors.value[i].equals(new THREE.Color(color))));
}
console.log('Power appearance passed: all eight three-Power combinations, reusable uniforms and no separate boost colour.');
