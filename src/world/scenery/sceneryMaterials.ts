import { DoubleSide, MeshDepthMaterial, MeshStandardMaterial, RGBADepthPacking, type Texture } from 'three';

function snow(material: MeshStandardMaterial, _amount: number) {
  // Keep scenery on the same simple, stable material path across devices.
  return material;
}
export function createSceneryMaterials(textures: Texture[]) {
  const [needles,alpha,bark,rock,normal]=textures;
  const foliage=snow(new MeshStandardMaterial({map:needles,alphaMap:alpha,alphaTest:.42,side:DoubleSide,color:'#526b6d',roughness:.92,metalness:0}),.72);
  const wood=snow(new MeshStandardMaterial({map:bark,color:'#4b555d',roughness:.9}),.22);
  const stone=snow(new MeshStandardMaterial({map:rock,normalMap:normal,color:'#3c4650',roughness:.82,metalness:.04,envMapIntensity:.18}),.76);
  const bank=new MeshStandardMaterial({color:'#647585',roughness:.96});
  const depth=new MeshDepthMaterial({alphaMap:alpha,alphaTest:.42,side:DoubleSide,depthPacking:RGBADepthPacking});
  return {foliage,wood,stone,bank,depth};
}
