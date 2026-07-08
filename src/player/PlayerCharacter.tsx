import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { MutableRefObject, useEffect, useMemo, useRef } from "react";
import { Group, Mesh } from "three";
import { SkeletonUtils } from "three-stdlib";
import { applyCharacterMaterials, playerMaterialProfile } from "../characters/characterMaterials";
import { CharacterAnimationState } from "./playerTypes";

type PlayerCharacterProps = {
  animationState: CharacterAnimationState;
  yawRef: MutableRefObject<number>;
};

const playerAnimationByState: Record<CharacterAnimationState, string> = {
  idle: "idleH",
  run: "runH",
};

export function PlayerCharacter({ animationState, yawRef }: PlayerCharacterProps) {
  const model = useGLTF("/characters/char.glb");
  const scene = useMemo(() => SkeletonUtils.clone(model.scene), [model.scene]);
  const group = useRef<Group>(null);
  const { actions } = useAnimations(model.animations, group);

  useEffect(() => {
    applyCharacterMaterials(scene, model.materials, playerMaterialProfile);

    scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
  }, [scene]);

  useEffect(() => {
    const action = actions[playerAnimationByState[animationState]];
    if (!action) return;

    action.reset().fadeIn(0.16).play();

    return () => {
      action.fadeOut(0.16);
    };
  }, [actions, animationState]);

  useFrame(() => {
    if (!group.current) return;

    group.current.rotation.y = yawRef.current;
    group.current.position.y = -1.05;
    group.current.rotation.z = 0;
    group.current.rotation.x = 0;
  });

  return (
    <group ref={group}>
      <pointLight color="#fff1d0" intensity={3.6} distance={5.6} position={[0, 1.7, -0.8]} />
      <pointLight color="#ccd9ff" intensity={1.8} distance={4.8} position={[0.8, 1.4, 0.9]} />
      <primitive object={scene} rotation-y={Math.PI} scale={1.05} />
    </group>
  );
}

useGLTF.preload("/characters/char.glb");
