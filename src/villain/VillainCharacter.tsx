import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useMemo, useRef } from "react";
import { AnimationAction, Group, LoopOnce, LoopRepeat, MathUtils, Mesh, Vector3 } from "three";
import { SkeletonUtils } from "three-stdlib";
import { applyCharacterMaterials, villainMaterialProfile } from "../characters/characterMaterials";
import { playerWorldState } from "../world/playerWorldState";

export type VillainStatus = "idle" | "running" | "dead";

type VillainCharacterProps = {
  basePosition: Vector3;
  villainStatus: VillainStatus;
};

const animationByStatus: Record<VillainStatus, string> = {
  idle: "idleV",
  running: "runV",
  dead: "dieV",
};
const lookDirection = new Vector3();
const rotationDamping = 5.5;
const modelFacingOffset = Math.PI;
const modelYOffset = 0.28;

function fadeOutOtherActions(actions: Record<string, AnimationAction | null>, activeAction: AnimationAction) {
  Object.values(actions).forEach((action) => {
    if (!action || action === activeAction) return;

    action.fadeOut(0.08);
  });
}

export function VillainCharacter({ basePosition, villainStatus }: VillainCharacterProps) {
  const model = useGLTF("/characters/char.glb");
  const scene = useMemo(() => SkeletonUtils.clone(model.scene), [model.scene]);
  const rootRef = useRef<Group>(null);
  const modelRef = useRef<Group>(null);
  const frozenDeathYawRef = useRef<number | null>(null);
  const { actions } = useAnimations(model.animations, modelRef);

  useEffect(() => {
    applyCharacterMaterials(scene, model.materials, villainMaterialProfile);

    scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
  }, [scene]);

  useEffect(() => {
    const action = actions[animationByStatus[villainStatus]];
    if (!action) return;

    fadeOutOtherActions(actions, action);
    action.reset();
    action.clampWhenFinished = villainStatus === "dead";
    action.setLoop(villainStatus === "dead" ? LoopOnce : LoopRepeat, villainStatus === "dead" ? 1 : Infinity);
    action.fadeIn(0.14).play();

    return () => {
      action.fadeOut(0.14);
    };
  }, [actions, villainStatus]);

  useFrame((_, delta) => {
    const root = rootRef.current;
    const modelGroup = modelRef.current;
    if (!root || !modelGroup) return;

    modelGroup.position.set(0, modelYOffset, 0);
    modelGroup.rotation.set(0, 0, 0);
    root.rotation.x = 0;
    root.rotation.z = 0;

    if (villainStatus === "dead") {
      if (frozenDeathYawRef.current === null) {
        frozenDeathYawRef.current = root.rotation.y;
      }
      root.rotation.y = frozenDeathYawRef.current;
      return;
    }

    frozenDeathYawRef.current = null;

    lookDirection.subVectors(playerWorldState.position, basePosition);
    lookDirection.y = 0;
    if (lookDirection.lengthSq() < 0.0001) return;

    const targetYaw = Math.atan2(lookDirection.x, lookDirection.z) + modelFacingOffset;
    root.rotation.y = MathUtils.damp(
      root.rotation.y,
      targetYaw,
      rotationDamping,
      Math.min(delta, 1 / 30)
    );
  });

  return (
    <RigidBody type="fixed" colliders={false} position={[basePosition.x, basePosition.y, basePosition.z]}>
      <CuboidCollider args={[0.5, 1.25, 0.5]} position={[0, 1.2, 0]} />
      <group ref={rootRef}>
        <group ref={modelRef}>
          <primitive object={scene} scale={1.16} />
        </group>
        <pointLight color="#ff273a" intensity={8} distance={8} position={[0, 1.8, 0]} />
      </group>
    </RigidBody>
  );
}

useGLTF.preload("/characters/char.glb");
