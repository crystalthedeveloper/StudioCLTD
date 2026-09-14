import { DoubleSide, MeshDepthMaterial, MeshStandardMaterial, RGBADepthPacking, type Texture } from 'three';

function snow(material: MeshStandardMaterial, amount: number) {
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vSceneryPosition; varying float vSceneryUp;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvSceneryPosition=position; vSceneryUp=normal.y;');
    shader.fragmentShader='varying vec3 vSceneryPosition; varying float vSceneryUp;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float snowPatchNoise=sin(vSceneryPosition.x*8.3+sin(vSceneryPosition.z*5.7))*sin(vSceneryPosition.z*6.4+vSceneryPosition.y*9.1);
      float cover=smoothstep(0.25,0.8,vSceneryUp)*smoothstep(-0.05,0.65,snowPatchNoise)*${amount.toFixed(2)};
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.64,.71,.76),cover);
    `);
  };
  material.customProgramCacheKey=()=>`scenery-snow-v2-${amount}`;
  return material;
}
export function createSceneryMaterials(textures: Texture[]) {
  const [needles,alpha,bark,rock,normal]=textures;
  const foliage=snow(new MeshStandardMaterial({map:needles,alphaMap:alpha,alphaTest:.42,side:DoubleSide,color:'#819d95',roughness:1,metalness:0}),.72);
  const wood=snow(new MeshStandardMaterial({map:bark,color:'#72797b',roughness:1}),.22);
  const stone=snow(new MeshStandardMaterial({map:rock,normalMap:normal,color:'#69757f',roughness:1}),.76);
  const bank=new MeshStandardMaterial({color:'#b4c5cf',roughness:1});
  const depth=new MeshDepthMaterial({alphaMap:alpha,alphaTest:.42,side:DoubleSide,depthPacking:RGBADepthPacking});
  return {foliage,wood,stone,bank,depth};
}
