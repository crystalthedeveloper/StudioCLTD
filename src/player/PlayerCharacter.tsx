import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { MutableRefObject, useEffect, useRef } from "react";
import { Group, Mesh } from "three";
import { CharacterAnimationState } from "./playerTypes";
import { markPlayerRotationUpdate } from "../debug/controllerDebug";

type PlayerCharacterProps = {
  animationState: CharacterAnimationState;
  yawRef: MutableRefObject<number>;
};

export function PlayerCharacter({ animationState, yawRef }: PlayerCharacterProps) {
  const model = useGLTF("/models/temp-player.gltf");
  const group = useRef<Group>(null);
  const { actions } = useAnimations(model.animations, group);

  useEffect(() => {
    const action = actions[animationState];
    if (!action) return;

    action.reset().fadeIn(0.16).play();

    return () => {
      action.fadeOut(0.16);
    };
  }, [actions, animationState]);

  useFrame(({ clock }) => {
    if (!group.current) return;

    const t = clock.elapsedTime;
    const moving = animationState === "walk" || animationState === "run";
    const airborne = animationState === "jump" || animationState === "fall";
    const stride = animationState === "run" ? 13 : 8;

    markPlayerRotationUpdate(Math.floor(clock.elapsedTime * 60), "PlayerCharacter");
    group.current.rotation.y = yawRef.current;
    group.current.position.y = moving ? Math.abs(Math.sin(t * stride)) * 0.035 - 1.05 : -1.05;
    group.current.rotation.z = moving ? Math.sin(t * stride) * 0.025 : 0;
    group.current.rotation.x = airborne ? -0.08 : 0;
  });

  model.scene.traverse((object) => {
    if (object instanceof Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  return (
    <group ref={group}>
      <pointLight color="#fff1d0" intensity={3.6} distance={5.6} position={[0, 1.7, -0.8]} />
      <pointLight color="#ccd9ff" intensity={1.8} distance={4.8} position={[0.8, 1.4, 0.9]} />
      <primitive object={model.scene} scale={1.05} />
    </group>
  );
}

useGLTF.preload("/models/temp-player.gltf");
