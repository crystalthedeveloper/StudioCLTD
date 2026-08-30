import { useTexture } from "@react-three/drei";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useMemo } from "react";
import { HomeBaseVideoScreen } from "./HubSections";
import {
  concreteTexturePaths,
  configureConcreteTextures,
  createConcreteBoxGeometry,
  createConcreteMaterial,
} from "./ModularTerrain";

// Keep the hub beyond the camera's 10,000-unit far plane so the main world and
// Home Base can never render at the same time. Its playable elevation remains
// above the controller's fall-reset threshold.
export const homeBaseCenter = [12000, 0.6, 12000] as const;

export function HomeBase() {
  const concreteTextures = useTexture(concreteTexturePaths);
  const resources = useMemo(() => {
    configureConcreteTextures(concreteTextures);

    return {
      geometry: createConcreteBoxGeometry(26, 0.6, 26),
      material: createConcreteMaterial(concreteTextures, "#3f4953"),
    };
  }, [concreteTextures]);

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
