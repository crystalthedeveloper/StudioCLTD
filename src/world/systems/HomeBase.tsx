import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useMemo } from "react";
import type { MeshStandardMaterial } from "three";
import { HomeBaseVideoScreen } from "./HubSections";
import { createConcreteBoxGeometry } from "./ModularTerrain";

// Keep the hub beyond the camera's 10,000-unit far plane so the main world and
// Home Base can never render at the same time. Its playable elevation remains
// above the controller's fall-reset threshold.
export const homeBaseCenter = [12000, 0.6, 12000] as const;

export function HomeBase({ material }: { material: MeshStandardMaterial }) {
  // Give the return hub a little more turning room without changing its
  // elevation or the surrounding world layout.
  const geometry = useMemo(() => createConcreteBoxGeometry(31.2, 0.6, 31.2), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group name="HomeBase" position={homeBaseCenter}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[15.6, 0.3, 15.6]} position={[0, -0.3, 0]} friction={0.35} />
        <mesh geometry={geometry} material={material} position={[0, -0.3, 0]} castShadow receiveShadow />
      </RigidBody>
      <HomeBaseVideoScreen />
    </group>
  );
}
