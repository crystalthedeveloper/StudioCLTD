import { createVillainContact } from "./villainContact";
import { isPlayerObject } from "../world/playerCollision";
import { assetForDevice } from "../world/mobileAssets";
import { createVillainCombat, villainClips } from "./villainCombat";
import { useVillainNavigation } from "./useVillainNavigation";
import { destinationPlatformRadius } from "../world/hubSections";
import { useGameFrame } from "../player/useGameFrame";
import { useGameAnimations } from "../player/useGameFrame";
import { useGLTF } from "@react-three/drei";
import { CuboidCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Color, Group, Material, MathUtils, Mesh, Object3D, Vector3 } from "three";
import { SkeletonUtils } from "three-stdlib";
import {
  applyCharacterMaterials,
  villainBodyMaterialName,
  villainMaterialProfile,
} from "../characters/characterMaterials";
import { applyNaturalMaterials } from "../characters/naturalMaterials";
import { DialogueBubble, DialogueMessage } from "../ui/DialogueBubble";
import { playerWorldState } from "../world/playerWorldState";
import { isPowerActive } from "../player/temporaryPowers";
import { hideVillainMask } from "./hideVillainMask";

export type VillainStatus = "idle" | "running" | "dead";

type VillainCharacterProps = {
  id: string;
  basePosition: Vector3;
  platformPosition: Vector3;
  onPlayerDamage: () => void;
  onPowerContact: () => boolean;
  dialogue: DialogueMessage | null;
  dialogueVariant?: "default" | "danger";
  villainStatus: VillainStatus;
};

const lookDirection = new Vector3();
const rotationDamping = 5.5;
const modelFacingOffset = 0;
const modelYOffset = 0.28;
const villainMaterialTuningVersion = 3;
const poweredContactRadiusSq = 1.35 * 1.35;

type HighlightableMaterial = Material & {
  color?: Color;
  emissive?: Color;
  emissiveIntensity?: number;
  envMapIntensity?: number;
  metalness?: number;
  roughness?: number;
};

export function VillainCharacter({ id, basePosition, platformPosition, onPlayerDamage, onPowerContact, dialogue, dialogueVariant = "danger", villainStatus }: VillainCharacterProps) {
  const model = useGLTF(assetForDevice("/characters/char-optimized.glb"), false, true);
  const scene = useMemo(() => {
    const villainScene = SkeletonUtils.clone(model.scene);
    hideVillainMask(villainScene);
    return villainScene;
  }, [model.scene]);
  const rootRef = useRef<Group>(null);
  const modelRef = useRef<Group>(null);
  const frozenDeathYawRef = useRef<number | null>(null);
  const clips = useMemo(() => villainClips(model.animations), [model.animations]);
  const { actions } = useGameAnimations(clips, modelRef, "idleV");
  const combat = useMemo(() => createVillainCombat(actions), [actions]);
  const bodyRef = useRef<RapierRigidBody>(null);
  const deathRequestedRef = useRef(false);
  const home = useMemo(() => basePosition.clone(), []);
  const navigation = useVillainNavigation();
  const destination = useMemo(() => new Vector3(), []);
  useLayoutEffect(() => { combat.setMotion("idle"); }, [combat]);

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

  const contact = useMemo(createVillainContact, []);
  const handleContact = () => {
    if (villainStatus === "dead" || deathRequestedRef.current) return;
    if (onPowerContact()) {
      deathRequestedRef.current = true;
      combat.setMotion("dead");
      return;
    }
    onPlayerDamage();
  };

  useGameFrame((_, delta) => {
    const root = rootRef.current;
    const modelGroup = modelRef.current;
    if (!root || !modelGroup) return;

    modelGroup.position.set(0, modelYOffset, 0);
    modelGroup.rotation.set(0, 0, 0);
    root.rotation.x = 0;
    root.rotation.z = 0;

    // Rapier stay callbacks can be missed while a kinematic villain and a
    // stationary player are already overlapping. Keep a deterministic body
    // overlap check so power contact never depends on movement or impact.
    const dx = playerWorldState.position.x - basePosition.x;
    const dz = playerWorldState.position.z - basePosition.z;
    const sameHeight = playerWorldState.position.y >= basePosition.y - 0.2
      && playerWorldState.position.y <= basePosition.y + 2.8;
    const poweredBodyOverlap = isPowerActive() && sameHeight && dx * dx + dz * dz <= poweredContactRadiusSq;
    if (poweredBodyOverlap && !deathRequestedRef.current && villainStatus !== "dead") {
      handleContact();
    }

    contact.update(handleContact);
    if (villainStatus === "dead" || deathRequestedRef.current) {
      combat.setMotion("dead");
      if (frozenDeathYawRef.current === null) {
        frozenDeathYawRef.current = root.rotation.y;
      }
      root.rotation.y = frozenDeathYawRef.current;
      return;
    }

    // A powered overlap must never reach the villain attack state machine.
    // This explicit stay check also covers a power activating while colliders
    // are already touching, including a completely stationary Player.
    if (isPowerActive() && contact.touching()) {
      if (onPowerContact()) deathRequestedRef.current = true;
      return;
    }

    frozenDeathYawRef.current = null;
    const player = playerWorldState.position;
    const onPlatform = Math.abs(player.x - platformPosition.x) <= destinationPlatformRadius
      && Math.abs(player.z - platformPosition.z) <= destinationPlatformRadius
      && Math.abs(player.y - (platformPosition.y + 1)) < 1.6;
    const chasing = onPlatform;
    // Powered attacks require actual collider contact, handled above.
    const attacking = combat.updateAttack(contact.touching(), true);
    if (attacking) destination.copy(player);
    else {
      if (chasing) destination.copy(player);
      else {
        destination.copy(home);
        // Once home, remain at the exact original position instead of patrolling.
        if (basePosition.distanceToSquared(home) <= 0.0001) {
          basePosition.copy(home);
          bodyRef.current?.setNextKinematicTranslation(home);
          combat.setMotion("idle");
          return;
        }
      }
      const heading = Math.atan2(destination.x - basePosition.x, destination.z - basePosition.z);
      const step = Math.min(Math.hypot(destination.x - basePosition.x, destination.z - basePosition.z), Math.min(delta, 1 / 30) * 2.1);
      const limit = destinationPlatformRadius - 0.8;
      const safe = [0, 0.5, -0.5, 1, -1, 1.57, -1.57].map((angle) => heading + angle).find((angle) => {
        const x = basePosition.x + Math.sin(angle) * step, z = basePosition.z + Math.cos(angle) * step;
        return Math.abs(x - platformPosition.x) <= limit && Math.abs(z - platformPosition.z) <= limit && navigation.clear(x, platformPosition.y, z, bodyRef.current);
      });
      if (safe !== undefined && step > 0.005) {
        basePosition.x += Math.sin(safe) * step;
        basePosition.z += Math.cos(safe) * step;
        basePosition.y = platformPosition.y;
        bodyRef.current?.setNextKinematicTranslation(basePosition);
        destination.set(basePosition.x + Math.sin(safe), basePosition.y, basePosition.z + Math.cos(safe));
        combat.setMotion("running");
      } else combat.setMotion("idle");
    }

    lookDirection.subVectors(destination, basePosition);
    lookDirection.y = 0;
    if (lookDirection.lengthSq() < 0.0001) return;

    const targetYaw = Math.atan2(lookDirection.x, lookDirection.z) + modelFacingOffset;
    root.rotation.y = MathUtils.damp(
      root.rotation.y,
      root.rotation.y + Math.atan2(Math.sin(targetYaw - root.rotation.y), Math.cos(targetYaw - root.rotation.y)),
      rotationDamping,
      Math.min(delta, 1 / 30)
    );
  });

  return (
    <RigidBody ref={bodyRef} type="kinematicPosition" colliders={false} position={[basePosition.x, basePosition.y, basePosition.z]}>
      {villainStatus !== "dead" && <CuboidCollider args={[0.5, 1.25, 0.5]} position={[0, 1.2, 0]}
        onCollisionEnter={({ other }) => {
          if (isPlayerObject(other.rigidBodyObject) || isPlayerObject(other.colliderObject)) {
            contact.enter(other.collider.handle, handleContact);
          }
        }}
        onCollisionExit={({ other }) => contact.exit(other.collider.handle)}
      />}
      <group ref={rootRef}>
        <group ref={modelRef} position={[0, modelYOffset, 0]}>
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
