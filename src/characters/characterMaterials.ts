import { Material, Mesh, Object3D } from "three";

export const playerBodyMaterialName = "WhiteClown_material";
export const playerMaskMaterialName = "LogoMaterial";
export const villainBodyMaterialName = "VWhiteClown_material";
export const villainMaskMaterialName = "LogoVMaterial";

type MaterialMap = Record<string, Material> | undefined;
type CharacterMaterialProfile = {
  body: string;
  mask: string;
};

export const playerMaterialProfile: CharacterMaterialProfile = {
  body: playerBodyMaterialName,
  mask: playerMaskMaterialName,
};

export const villainMaterialProfile: CharacterMaterialProfile = {
  body: villainBodyMaterialName,
  mask: villainMaskMaterialName,
};

function getMeshMaterials(mesh: Mesh) {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

function findMaterial(root: Object3D, materialName: string) {
  let found: Material | null = null;

  root.traverse((object) => {
    if (found || !(object instanceof Mesh)) return;

    found = getMeshMaterials(object).find((material) => material?.name === materialName) ?? null;
  });

  return found;
}

function getMaterial(root: Object3D, materials: MaterialMap, materialName: string, fallbackName?: string) {
  const material = materials?.[materialName] ?? findMaterial(root, materialName);
  if (material) return material;

  const fallback = fallbackName ? materials?.[fallbackName] ?? findMaterial(root, fallbackName) : null;
  if (!fallback) return null;

  const clone = fallback.clone();
  clone.name = materialName;
  return clone;
}

function isBodyMaterial(material: Material | null | undefined) {
  return material?.name === playerBodyMaterialName || material?.name === villainBodyMaterialName;
}

function isMaskMaterial(material: Material | null | undefined) {
  return material?.name === playerMaskMaterialName || material?.name === villainMaskMaterialName;
}

export function applyCharacterMaterials(root: Object3D, materials: MaterialMap, profile: CharacterMaterialProfile) {
  const bodyMaterial = getMaterial(root, materials, profile.body, playerBodyMaterialName);
  const maskMaterial = getMaterial(root, materials, profile.mask, playerMaskMaterialName);

  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;

    const currentMaterials = getMeshMaterials(object);
    const nextMaterials = currentMaterials.map((material) => {
      if (maskMaterial && isMaskMaterial(material)) return maskMaterial;
      if (bodyMaterial && (object.name === "WhiteClown" || isBodyMaterial(material))) return bodyMaterial;

      return material;
    });

    object.material = Array.isArray(object.material) ? nextMaterials : nextMaterials[0];
  });
}
