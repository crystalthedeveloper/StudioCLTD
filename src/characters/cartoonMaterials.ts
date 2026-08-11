import {
  DataTexture,
  Material,
  Mesh,
  MeshStandardMaterial,
  MeshToonMaterial,
  NearestFilter,
  Object3D,
  RGBAFormat,
} from "three";

export const comicToneGradient = new DataTexture(
  new Uint8Array([
    92, 92, 92, 255,
    178, 178, 178, 255,
    255, 255, 255, 255,
  ]),
  3,
  1,
  RGBAFormat,
);
comicToneGradient.minFilter = NearestFilter;
comicToneGradient.magFilter = NearestFilter;
comicToneGradient.generateMipmaps = false;
comicToneGradient.needsUpdate = true;

const toonMaterialCache = new WeakMap<Material, Material>();

export function createCartoonMaterial(source: Material) {
  if (!(source instanceof MeshStandardMaterial)) return source;

  const cached = toonMaterialCache.get(source);
  if (cached) return cached;

  const toon = new MeshToonMaterial({
    alphaMap: source.alphaMap,
    alphaTest: source.alphaTest,
    aoMap: source.aoMap,
    aoMapIntensity: source.aoMapIntensity,
    color: source.color,
    emissive: source.emissive,
    emissiveIntensity: source.emissiveIntensity,
    emissiveMap: source.emissiveMap,
    gradientMap: comicToneGradient,
    lightMap: source.lightMap,
    lightMapIntensity: source.lightMapIntensity,
    map: source.map,
    normalMap: source.normalMap,
    normalScale: source.normalScale,
    opacity: source.opacity,
    side: source.side,
    transparent: source.transparent,
    vertexColors: source.vertexColors,
  });
  toon.name = source.name;
  toon.depthTest = source.depthTest;
  toon.depthWrite = source.depthWrite;
  toon.toneMapped = source.toneMapped;
  toonMaterialCache.set(source, toon);
  return toon;
}

export function applyCartoonMaterials(root: Object3D) {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.material = Array.isArray(object.material)
      ? object.material.map(createCartoonMaterial)
      : createCartoonMaterial(object.material);
  });
}
