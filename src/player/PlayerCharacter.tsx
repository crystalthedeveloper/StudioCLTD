import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { MutableRefObject, useEffect, useMemo, useRef, useState } from "react";
import { AnimationAction, Group, LoopOnce, LoopRepeat, Material, Mesh, Object3D, PointLight } from "three";
import { SkeletonUtils } from "three-stdlib";
import {
  applyCharacterMaterials,
  playerBodyMaterialName,
  playerMaskMaterialName,
  playerMaterialProfile,
} from "../characters/characterMaterials";
import { DialogueBubble, DialogueMessage } from "../ui/DialogueBubble";
import { isSpeedBoostActive, subscribeSpeedBoostChange } from "./speedBoost";
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
const playerPoweredMaterialName = "HWhiteClown_material";
const playerLightingLayer = 2;

type PlayerMaterialSlot = {
  index: number | null;
  material: Material;
  mesh: Mesh;
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
  const model = useGLTF("/characters/char-optimized.glb", false, true);
  const scene = useMemo(() => SkeletonUtils.clone(model.scene), [model.scene]);
  const group = useRef<Group>(null);
  const playerFrontLightRef = useRef<PointLight>(null);
  const playerBackLightRef = useRef<PointLight>(null);
  const { actions } = useAnimations(model.animations, group);
  const fixedRequestRef = useRef(0);
  const fixedActionRef = useRef<AnimationAction | null>(null);
  const activeLocomotionStateRef = useRef<CharacterAnimationState | null>(null);
  const onFixedAnimationCompleteRef = useRef(onFixedAnimationComplete);
  const materialSlotsRef = useRef<PlayerMaterialSlot[]>([]);
  const poweredBodyMaterialRef = useRef<Material | null>(null);
  const activeMaterialModeRef = useRef<"default" | "powered">("default");
  const speedBoostActiveRef = useRef(isSpeedBoostActive());
  const [speedBoostActive, setSpeedBoostActive] = useState(() => isSpeedBoostActive());

  useEffect(() => {
    onFixedAnimationCompleteRef.current = onFixedAnimationComplete;
  }, [onFixedAnimationComplete]);

  useEffect(() => {
    applyCharacterMaterials(scene, model.materials, playerMaterialProfile);

    scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = false;
        object.layers.enable(playerLightingLayer);
      }
    });

    const poweredBodyMaterial = model.materials?.[playerPoweredMaterialName] ?? findMaterialByName(scene, playerPoweredMaterialName);
    poweredBodyMaterialRef.current = poweredBodyMaterial ?? null;
    materialSlotsRef.current = collectBodyMaterialSlots(scene);
    activeMaterialModeRef.current = "default";
  }, [scene]);

  useEffect(() => {
    playerFrontLightRef.current?.layers.set(playerLightingLayer);
    playerBackLightRef.current?.layers.set(playerLightingLayer);
  }, []);

  useEffect(() => {
    const updateSpeedBoostActive = () => {
      const nextActive = isSpeedBoostActive();
      speedBoostActiveRef.current = nextActive;
      setSpeedBoostActive(nextActive);
    };

    updateSpeedBoostActive();
    return subscribeSpeedBoostChange(updateSpeedBoostActive);
  }, []);

  useEffect(() => {
    speedBoostActiveRef.current = speedBoostActive;

    if (speedBoostActive) {
      applyPoweredMaterial();
      return;
    }

    restoreDefaultMaterialIfIdle();
  }, [speedBoostActive]);

  const applyPoweredMaterial = () => {
    const poweredMaterial = poweredBodyMaterialRef.current;
    if (!poweredMaterial || activeMaterialModeRef.current === "powered") return;

    materialSlotsRef.current.forEach((slot) => {
      if (slot.index === null) {
        slot.mesh.material = poweredMaterial;
        return;
      }

      if (!Array.isArray(slot.mesh.material)) return;
      slot.mesh.material[slot.index] = poweredMaterial;
    });
    activeMaterialModeRef.current = "powered";
  };

  const restoreDefaultMaterialIfIdle = () => {
    if (speedBoostActiveRef.current || fixedActionRef.current || activeMaterialModeRef.current === "default") return;

    materialSlotsRef.current.forEach((slot) => {
      if (slot.index === null) {
        slot.mesh.material = slot.material;
        return;
      }

      if (!Array.isArray(slot.mesh.material)) return;
      slot.mesh.material[slot.index] = slot.material;
    });
    activeMaterialModeRef.current = "default";
  };

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
    applyPoweredMaterial();
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
      restoreDefaultMaterialIfIdle();

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
      <pointLight
        ref={playerFrontLightRef}
        color="#fff8ec"
        intensity={15}
        distance={9}
        decay={2}
        position={[1.8, 3.2, 2.8]}
      />
      <pointLight
        ref={playerBackLightRef}
        color="#edf7ff"
        intensity={10}
        distance={8}
        decay={2}
        position={[-1.6, 2.5, -2.2]}
      />
      <DialogueBubble message={dialogue} position={[0, 2.65, 0]} />
      <primitive object={scene} rotation-y={Math.PI} scale={1.05} />
    </group>
  );
}

function findMaterialByName(root: Object3D, materialName: string) {
  let found: Material | null = null;

  root.traverse((object) => {
    if (found || !(object instanceof Mesh)) return;

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    found = materials.find((material) => material?.name === materialName) ?? null;
  });

  return found;
}

function collectBodyMaterialSlots(root: Object3D) {
  const slots: PlayerMaterialSlot[] = [];

  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material, index) => {
      if (!material || material.name === playerMaskMaterialName) return;
      if (object.name !== "WhiteClown" && material.name !== playerBodyMaterialName) return;

      slots.push({
        index: Array.isArray(object.material) ? index : null,
        material,
        mesh: object,
      });
    });
  });

  return slots;
}
