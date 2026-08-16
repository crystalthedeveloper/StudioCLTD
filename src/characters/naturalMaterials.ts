import { Material, Mesh, MeshStandardMaterial, Object3D } from "three";

const naturalMaterialCache = new WeakMap<Material, Material>();

export function createNaturalMaterial(source: Material) {
  const cached = naturalMaterialCache.get(source);
  if (cached) return cached;

  if (!(source instanceof MeshStandardMaterial)) return source;

  const material = source.clone();
  material.roughness = Math.max(material.roughness, 0.78);
  material.metalness = Math.min(material.metalness, 0.08);
  material.envMapIntensity = Math.min(material.envMapIntensity, 0.42);
  material.needsUpdate = true;
  naturalMaterialCache.set(source, material);
  return material;
}

export function applyNaturalMaterials(root: Object3D) {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.material = Array.isArray(object.material)
      ? object.material.map(createNaturalMaterial)
      : createNaturalMaterial(object.material);
  });
}
