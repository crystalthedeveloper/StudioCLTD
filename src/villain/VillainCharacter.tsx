import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useMemo, useRef } from "react";
import { Group, Mesh, Vector3 } from "three";
import { SkeletonUtils } from "three-stdlib";

export type VillainStatus = "idle" | "dead";

type VillainCharacterProps = {
  basePosition: Vector3;
  villainStatus: VillainStatus;
};

const animationByStatus: Record<VillainStatus, string> = {
  idle: "idle",
  dead: "die",
};

export function VillainCharacter({ basePosition, villainStatus }: VillainCharacterProps) {
  const model = useGLTF("/models/temp-villain.gltf");
  const scene = useMemo(() => SkeletonUtils.clone(model.scene), [model.scene]);
  const groupRef = useRef<Group>(null);
  const lastStatusRef = useRef<VillainStatus>(villainStatus);
  const { actions } = useAnimations(model.animations, groupRef);

  useEffect(() => {
    scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
  }, [scene]);

  useEffect(() => {
    if (lastStatusRef.current !== villainStatus) {
      lastStatusRef.current = villainStatus;
      console.log("[StudioCLTD villain] State changed", villainStatus);
    }

    const action = actions[animationByStatus[villainStatus]];
    if (!action) return;

    action.reset().fadeIn(0.14).play();

    return () => {
      action.fadeOut(0.14);
    };
  }, [actions, villainStatus]);

  useFrame(() => {
    if (!groupRef.current) return;

    const defeatedLean = villainStatus === "dead" ? -Math.PI * 0.46 : 0;
    groupRef.current.position.set(0, 0, 0);
    groupRef.current.rotation.y = Math.PI * 0.22;
    groupRef.current.rotation.z = defeatedLean;
  });

  return (
    <RigidBody type="fixed" colliders={false} position={[basePosition.x, basePosition.y, basePosition.z]}>
      <CuboidCollider args={[0.5, 1.25, 0.5]} position={[0, 1.2, 0]} />
      <group ref={groupRef}>
        <primitive object={scene} scale={1.16} />
        <pointLight color="#ff273a" intensity={8} distance={8} position={[0, 1.8, 0]} />
      </group>
    </RigidBody>
  );
}

useGLTF.preload("/models/temp-villain.gltf");
