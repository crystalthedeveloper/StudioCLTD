import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useMemo, useRef } from "react";
import { AnimationAction, Color, Group, LoopOnce, LoopRepeat, Material, MathUtils, Mesh, Object3D, Vector3 } from "three";
import { SkeletonUtils } from "three-stdlib";
import {
  applyCharacterMaterials,
  villainBodyMaterialName,
  villainMaterialProfile,
} from "../characters/characterMaterials";
import { applyNaturalMaterials } from "../characters/naturalMaterials";
import { DialogueBubble, DialogueMessage } from "../ui/DialogueBubble";
import { playerWorldState } from "../world/playerWorldState";
import { hideVillainMask } from "./hideVillainMask";

export type VillainStatus = "idle" | "running" | "dead";

type VillainCharacterProps = {
  basePosition: Vector3;
  dialogue: DialogueMessage | null;
  dialogueVariant?: "default" | "danger";
  villainStatus: VillainStatus;
};

const animationByStatus: Record<VillainStatus, string> = {
  idle: "idleV",
  running: "runV",
  dead: "dieV",
};
const lookDirection = new Vector3();
const rotationDamping = 5.5;
const modelFacingOffset = 0;
const modelYOffset = 0.28;
const villainMaterialTuningVersion = 3;

type HighlightableMaterial = Material & {
  color?: Color;
  emissive?: Color;
  emissiveIntensity?: number;
  envMapIntensity?: number;
  metalness?: number;
  roughness?: number;
};

function fadeOutOtherActions(actions: Record<string, AnimationAction | null>, activeAction: AnimationAction) {
  Object.values(actions).forEach((action) => {
    if (!action || action === activeAction) return;

    action.fadeOut(0.08);
  });
}

export function VillainCharacter({ basePosition, dialogue, dialogueVariant = "danger", villainStatus }: VillainCharacterProps) {
  const model = useGLTF("/characters/char-optimized.glb", false, true);
  const scene = useMemo(() => {
    const villainScene = SkeletonUtils.clone(model.scene);
    hideVillainMask(villainScene);
    return villainScene;
  }, [model.scene]);
  const rootRef = useRef<Group>(null);
  const modelRef = useRef<Group>(null);
  const frozenDeathYawRef = useRef<number | null>(null);
  const { actions } = useAnimations(model.animations, modelRef);

  useEffect(() => {
    applyCharacterMaterials(scene, model.materials, villainMaterialProfile);
    applyNaturalMaterials(scene);

    scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = false;
        object.layers.enable(1);
      }
    });

    enhanceVillainSuitMaterial(findVillainSuitMaterial(scene));
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
          <DialogueBubble
            message={dialogue}
            persistent={dialogueVariant === "danger"}
            position={dialogueVariant === "danger" ? [0, 3.75, 0] : [0, 3.25, 0]}
            variant={dialogueVariant}
          />
          <primitive object={scene} scale={1.16} />
        </group>
      </group>
    </RigidBody>
  );
}

function findVillainSuitMaterial(root: Object3D) {
  let found: Material | null = null;

  root.traverse((object) => {
    if (found || !(object instanceof Mesh)) return;

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    found = materials.find((material) => material?.name === villainBodyMaterialName) ?? null;
  });

  return found;
}

function enhanceVillainSuitMaterial(material: Material | null | undefined) {
  if (!material || material.userData.villainMaterialTuningVersion === villainMaterialTuningVersion) return;

  const suitMaterial = material as HighlightableMaterial;

  // Preserve the villain artwork baked into the GLB texture without tinting it.
  if (suitMaterial.color) suitMaterial.color.set("#ffffff");

  if (suitMaterial.emissive) {
    suitMaterial.emissive.set("#050505");
    suitMaterial.emissiveIntensity = 0.025;
  }

  if (typeof suitMaterial.envMapIntensity === "number") {
    suitMaterial.envMapIntensity = 0.08;
  }

  if (typeof suitMaterial.roughness === "number") {
    suitMaterial.roughness = 0.9;
  }

  if (typeof suitMaterial.metalness === "number") {
    suitMaterial.metalness = 0;
  }

  suitMaterial.needsUpdate = true;
  suitMaterial.userData.villainMaterialTuningVersion = villainMaterialTuningVersion;
}
