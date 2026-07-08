import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { MutableRefObject, useEffect, useMemo, useRef } from "react";
import { AnimationAction, Group, LoopOnce, LoopRepeat, Mesh } from "three";
import { SkeletonUtils } from "three-stdlib";
import { applyCharacterMaterials, playerMaterialProfile } from "../characters/characterMaterials";
import { DialogueBubble, DialogueMessage } from "../ui/DialogueBubble";
import { CharacterAnimationState } from "./playerTypes";

type PlayerCharacterProps = {
  animationStateRef: MutableRefObject<CharacterAnimationState>;
  dialogue: DialogueMessage | null;
  fixedAnimationRequest: number;
  onFixedAnimationComplete: () => void;
  yawRef: MutableRefObject<number>;
};

const playerAnimationByState: Record<CharacterAnimationState, string> = {
  idle: "idleH",
  run: "runH",
};

function fadeOutOtherActions(actions: Record<string, AnimationAction | null>, activeAction: AnimationAction) {
  Object.values(actions).forEach((action) => {
    if (!action || action === activeAction) return;

    action.fadeOut(0.08);
  });
}

export function PlayerCharacter({
  animationStateRef,
  dialogue,
  fixedAnimationRequest,
  onFixedAnimationComplete,
  yawRef,
}: PlayerCharacterProps) {
  const model = useGLTF("/characters/char.glb");
  const scene = useMemo(() => SkeletonUtils.clone(model.scene), [model.scene]);
  const group = useRef<Group>(null);
  const { actions } = useAnimations(model.animations, group);
  const fixedRequestRef = useRef(0);
  const fixedActionRef = useRef<AnimationAction | null>(null);
  const activeLocomotionStateRef = useRef<CharacterAnimationState | null>(null);
  const onFixedAnimationCompleteRef = useRef(onFixedAnimationComplete);

  useEffect(() => {
    onFixedAnimationCompleteRef.current = onFixedAnimationComplete;
  }, [onFixedAnimationComplete]);

  useEffect(() => {
    applyCharacterMaterials(scene, model.materials, playerMaterialProfile);

    scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
  }, [scene]);

  const playLocomotionAction = (nextState: CharacterAnimationState) => {
    if (fixedActionRef.current || activeLocomotionStateRef.current === nextState) return;

    const action = actions[playerAnimationByState[nextState]];
    if (!action) return;

    activeLocomotionStateRef.current = nextState;
    fadeOutOtherActions(actions, action);
    action.setLoop(LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    action.reset().fadeIn(0.16).play();
  };

  useEffect(() => {
    activeLocomotionStateRef.current = null;
    playLocomotionAction(animationStateRef.current);
  }, [actions]);

  useEffect(() => {
    if (fixedAnimationRequest === fixedRequestRef.current) return;
    fixedRequestRef.current = fixedAnimationRequest;

    const action = actions.fixedH;
    if (!action) {
      onFixedAnimationCompleteRef.current();
      return;
    }

    fixedActionRef.current = action;
    fadeOutOtherActions(actions, action);
    action.reset();
    action.setLoop(LoopOnce, 1);
    action.clampWhenFinished = true;
    action.fadeIn(0.08).play();

    const mixer = action.getMixer();
    let completed = false;
    let fallbackTimer = 0;

    const completeFixedAnimation = () => {
      if (completed) return;
      completed = true;
      fixedActionRef.current = null;
      action.fadeOut(0.08);
      onFixedAnimationCompleteRef.current();

      activeLocomotionStateRef.current = null;
      playLocomotionAction(animationStateRef.current);
      mixer.removeEventListener("finished", handleFinished);
    };

    const handleFinished = (event: { action: AnimationAction }) => {
      if (event.action !== action) return;
      completeFixedAnimation();
    };

    mixer.addEventListener("finished", handleFinished);
    fallbackTimer = window.setTimeout(
      completeFixedAnimation,
      Math.max(1200, action.getClip().duration * 1000 + 350)
    );

    return () => {
      mixer.removeEventListener("finished", handleFinished);
      window.clearTimeout(fallbackTimer);
    };
  }, [actions, fixedAnimationRequest]);

  useFrame(() => {
    if (!group.current) return;

    playLocomotionAction(animationStateRef.current);

    group.current.rotation.y = yawRef.current;
    group.current.position.y = -1.05;
    group.current.rotation.z = 0;
    group.current.rotation.x = 0;
  });

  return (
    <group ref={group}>
      <pointLight color="#fff1d0" intensity={3.6} distance={5.6} position={[0, 1.7, -0.8]} />
      <pointLight color="#ccd9ff" intensity={1.8} distance={4.8} position={[0.8, 1.4, 0.9]} />
      <DialogueBubble message={dialogue} position={[0, 2.65, 0]} />
      <primitive object={scene} rotation-y={Math.PI} scale={1.05} />
    </group>
  );
}

useGLTF.preload("/characters/char.glb");
