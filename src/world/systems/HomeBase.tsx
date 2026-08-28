import { useTexture } from "@react-three/drei";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useMemo } from "react";
import { BoxGeometry, MeshStandardMaterial, SRGBColorSpace } from "three";
import { HomeBaseVideoScreen } from "./HubSections";

// Keep the hub beyond the camera's 10,000-unit far plane so the main world and
// Home Base can never render at the same time. Its playable elevation remains
// above the controller's fall-reset threshold.
export const homeBaseCenter = [12000, 0.6, 12000] as const;

export function HomeBase() {
  const [marbleMap, marbleBumpMap, marbleRoughnessMap] = useTexture([
    "/textures/home-base/black-marble.webp",
    "/textures/home-base/black-marble-bump.webp",
    "/textures/home-base/black-marble-roughness.webp",
  ]);
  const resources = useMemo(() => {
    marbleMap.colorSpace = SRGBColorSpace;
    [marbleMap, marbleBumpMap, marbleRoughnessMap].forEach((texture) => {
      texture.anisotropy = 4;
      texture.needsUpdate = true;
    });

    return {
      geometry: new BoxGeometry(26, 0.6, 26),
      material: new MeshStandardMaterial({
        bumpMap: marbleBumpMap,
        bumpScale: 0.075,
        color: "#ffffff",
        map: marbleMap,
        metalness: 0.06,
        roughness: 0.48,
        roughnessMap: marbleRoughnessMap,
      }),
    };
  }, [marbleBumpMap, marbleMap, marbleRoughnessMap]);

  useEffect(() => () => {
    resources.geometry.dispose();
    resources.material.dispose();
  }, [resources]);

  return (
    <group name="HomeBase" position={homeBaseCenter}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[13, 0.3, 13]} position={[0, -0.3, 0]} friction={0.35} />
        <mesh geometry={resources.geometry} material={resources.material} position={[0, -0.3, 0]} receiveShadow />
      </RigidBody>
      <HomeBaseVideoScreen />
    </group>
  );
}
