import { powerModes, type PowerMode, isPowerActive, resolvePowerContact } from "../../player/temporaryPowers";
import { createVillainCombat, villainClips } from "../../villain/villainCombat";
import { useVillainNavigation } from "../../villain/useVillainNavigation";
import { reactToVillainHit, useVillainHitReaction } from "../../villain/useVillainHitReaction";
import { LocalLightSpill } from "./LocalLightSpill";
import { useGameFrame } from "../../player/useGameFrame";
import { useGameAnimations } from "../../player/useGameFrame";
import { gameNow } from "../../player/gameFocus";
import { gameTimers } from "../../player/gameFocus";
import { useGLTF } from "@react-three/drei";
import { CylinderCollider, IntersectionEnterPayload, IntersectionExitPayload } from "@react-three/rapier";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AdditiveBlending, Box3, Group, Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from "three";
import { SkeletonUtils } from "three-stdlib";
import { applyCharacterMaterials, villainMaterialProfile } from "../../characters/characterMaterials";
import { applyNaturalMaterials } from "../../characters/naturalMaterials";
import {
  hasVillainVoice,
  playVillainDefeatSound,
  playVillainVoice,
  preloadVillainAudio,
  stopAllVillainAudio,
  stopVillainVoice,
} from "../../audio/villainAudio";
import { BillboardLabel } from "../../ui/BillboardLabel";
import { triggerFixHaptic } from "../../ui/haptics";
import { VillainCharacter, VillainStatus } from "../../villain/VillainCharacter";
import { hideVillainMask } from "../../villain/hideVillainMask";
import { destinationPlatformRadius, hubSections, sectionRampApproachLength, sectionRampWidth } from "../hubSections";
import { isPlayerObject } from "../playerCollision";
import { playerWorldState } from "../playerWorldState";
import { padVisualStyle } from "../padVisualStyle";
import { triggerPopupLayout } from "../triggerPopupLayout";
import { fixPulseGeometry, fixRingGeometry, useTriggerPadVisuals } from "../useTriggerPadVisuals";

const cooldownMs = 1800;
const triggerPadRadius = 1.33;
const padActivationCooldownMs = 900;
const encounterSectionIds = ["quick-fix", "urgent-fix", "performance", "site-improvement"];
const defeatDurationMs = 1700;
const villainFrontOffset = 2.8;
const villainSideOffset = 5.1;
const triggerPadFrontOffset = 5.8;
const triggerPadSideOffset = 3.6;
const bonusVillainContactRadiusSq = 1 * 1;
const bonusVillainDetectionRadiusSq = 8 * 8;
const bonusVillainChaseReleaseRadiusSq = 11 * 11;
const bonusVillainMoveSpeed = 2.1;
const bonusVillainSteeringAngles = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI] as const;

const fixPadVisualConfig = {
  pulseBaseScale: 1.05,
  pulseScaleAmount: 0.2,
  ringColor: padVisualStyle.color,
  ringOpacity: (_active: boolean, activationGlow: number) => 0.54 + activationGlow * 0.32,
  pulseOpacity: (_active: boolean, activationGlow: number) => activationGlow * 0.17,
};

type SectionEncounterConfig = {
  id: string;
  infoPadPosition: Vector3;
  name: string;
  padPosition: Vector3;
  platformPosition: Vector3;
  villainPosition: Vector3;
};

function createSectionEncounters(): SectionEncounterConfig[] {
  return hubSections
    .filter((section) => encounterSectionIds.includes(section.id))
    .map((section) => {
      const sectionPosition = new Vector3(...section.position);
      const towardEntrance = new Vector3(section.entrance[0], 0, section.entrance[1]);
      const tangent = new Vector3(-towardEntrance.z, 0, towardEntrance.x);
      const villainPosition = sectionPosition.clone().add(towardEntrance.clone().multiplyScalar(villainFrontOffset)).add(tangent.clone().multiplyScalar(villainSideOffset));
      const padPosition = sectionPosition
        .clone()
        .add(towardEntrance.clone().multiplyScalar(triggerPadFrontOffset))
        .add(tangent.clone().multiplyScalar(triggerPadSideOffset));
      const infoPadPosition = sectionPosition
        .clone()
        .add(towardEntrance.clone().multiplyScalar(triggerPadFrontOffset))
        .add(tangent.clone().multiplyScalar(-triggerPadSideOffset));

      villainPosition.y = section.position[1];
      padPosition.y = section.position[1] + 0.07;
      infoPadPosition.y = section.position[1] + 0.07;

      return {
        id: section.id,
        infoPadPosition,
        name: section.name,
        padPosition,
        platformPosition: sectionPosition,
        villainPosition,
      };
    });
}

const sectionEncounters = createSectionEncounters();
const bonusSpawnSpots = [
  new Vector3(-18, 0.1, 12),
  new Vector3(18, 0.1, 12),
  new Vector3(-16, 0.1, -16),
  new Vector3(16, 0.1, -16),
  new Vector3(0, 0.1, 15),
];
const bonusRoamingLimit = 18;
const bonusRampClearance = 2;

function distanceToBonusRamp(
  x: number,
  z: number,
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
) {
  const segmentX = endX - startX;
  const segmentZ = endZ - startZ;
  const lengthSq = segmentX * segmentX + segmentZ * segmentZ;
  const projection = lengthSq === 0
    ? 0
    : Math.max(0, Math.min(1, ((x - startX) * segmentX + (z - startZ) * segmentZ) / lengthSq));
  return Math.hypot(x - (startX + segmentX * projection), z - (startZ + segmentZ * projection));
}

function isSafeBonusRoamingPosition(x: number, z: number) {
  return getBonusRoamingClearance(x, z) >= 0;
}

function getBonusRoamingClearance(x: number, z: number) {
  let clearance = bonusRoamingLimit - Math.max(Math.abs(x), Math.abs(z));

  for (const section of hubSections) {
    const [sectionX, , sectionZ] = section.position;
    const [directionX, directionZ] = section.entrance;
    const rampStartX = sectionX + directionX * destinationPlatformRadius;
    const rampStartZ = sectionZ + directionZ * destinationPlatformRadius;
    const rampEndX = rampStartX + directionX * sectionRampApproachLength;
    const rampEndZ = rampStartZ + directionZ * sectionRampApproachLength;
    const rampClearance = distanceToBonusRamp(x, z, rampStartX, rampStartZ, rampEndX, rampEndZ)
      - (sectionRampWidth / 2 + bonusRampClearance);
    clearance = Math.min(clearance, rampClearance);
  }

  return clearance;
}

function canBonusVillainMove(fromX: number, fromZ: number, toX: number, toZ: number) {
  const nextClearance = getBonusRoamingClearance(toX, toZ);
  if (nextClearance >= 0) return true;

  // A legacy spawn point may begin inside the conservative clearance margin.
  // Permit only steps that move it outward until it is back in valid ground.
  return nextClearance > getBonusRoamingClearance(fromX, fromZ) + 0.0001;
}
const powerDefeatHandlers = new Map<string, () => void>();
const powerImpactListeners = new Set<(position: Vector3, mode: PowerMode) => void>();
function poweredContact(id: string, basePosition: Vector3) {
  return resolvePowerContact(true, (mode) => {
    const direction = basePosition.clone().sub(playerWorldState.position).setY(0).normalize();
    const point = basePosition.clone().add(new Vector3(0, 1, 0)).addScaledVector(direction, -0.25);
    reactToVillainHit(id, mode, direction);
    powerDefeatHandlers.get(id)?.();
    powerImpactListeners.forEach(listener => listener(point, mode));
  });
}
const maxContactImpacts = 8;
const impactMaterials = Object.fromEntries(Object.entries(powerModes).map(([mode, config]) => [mode,
  new MeshBasicMaterial({ color: config.color, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
])) as Record<PowerMode, MeshBasicMaterial>;
const effectSphereGeometry = new SphereGeometry(1, 8, 6);

type CombatPrototypeProps = {
  onBonusCollect: () => void;
  onInfoChange: (sectionId: string | null) => void;
  onPlayerDamage: () => void;
  onPlayerDialogue: (text: string) => void;
  onSectionResolved: (sectionId: string) => void;
  onSectionTrigger: (sectionId: string, triggerId: string) => void;
  restartKey: number | string;
};

export function CombatPrototype({
  onBonusCollect,
  onInfoChange,
  onPlayerDamage,
  onPlayerDialogue,
  onSectionResolved,
  onSectionTrigger,
  restartKey,
}: CombatPrototypeProps) {
  const contactDamage = () => { if (!isPowerActive()) onPlayerDamage(); };
  const [visibleEncounterCount, setVisibleEncounterCount] = useState(1);

  useEffect(() => {
    preloadVillainAudio();
    return stopAllVillainAudio;
  }, []);

  useEffect(() => stopAllVillainAudio(), [restartKey]);

  useEffect(() => {
    onInfoChange(null);
    setVisibleEncounterCount(1);
  }, [onInfoChange, restartKey]);

  useEffect(() => {
    if (visibleEncounterCount >= sectionEncounters.length) return undefined;

    const timeout = gameTimers.setTimeout(() => {
      setVisibleEncounterCount((current) => Math.min(sectionEncounters.length, current + 1));
    }, 220);

    return () => gameTimers.clearTimeout(timeout);
  }, [visibleEncounterCount]);

  return (
    <group name="SectionPortalEncounters">
      <PowerContactEffects key={`contact-effects:${restartKey}`} />
      <BonusVillainSystem
        key={`bonus-villains:${restartKey}`}
        onDefeat={onBonusCollect}
        onPlayerDamage={contactDamage}
      />
      {sectionEncounters.slice(0, visibleEncounterCount).map((encounter) => (
        <SectionPortalEncounter
          key={`${encounter.id}:${restartKey}`}
          encounter={encounter}
          onInfoClose={() => onInfoChange(null)}
          onInfoOpen={() => {
            onInfoChange(encounter.id);
            onSectionTrigger(encounter.id, "info");
          }}
          onPlayerDialogue={onPlayerDialogue}
          onPlayerDamage={contactDamage}
          onSectionResolved={onSectionResolved}
        />
      ))}
    </group>
  );
}

function BonusVillainSystem({
  onDefeat,
  onPlayerDamage,
}: {
  onDefeat: () => void;
  onPlayerDamage: () => void;
}) {
  return (
    <group name="BonusVillains">
      <BonusVillain id="bonus:1" initialSpot={0} onDefeat={onDefeat} onPlayerDamage={onPlayerDamage} />
      <BonusVillain id="bonus:2" initialSpot={2} onDefeat={onDefeat} onPlayerDamage={onPlayerDamage} />
    </group>
  );
}

function BonusVillain({
  id,
  initialSpot,
  onDefeat,
  onPlayerDamage,
}: {
  id: string;
  initialSpot: number;
  onDefeat: () => void;
  onPlayerDamage: () => void;
}) {
  const model = useGLTF("/characters/char-optimized.glb", false, true);
  const scene = useMemo(() => {
    const villainScene = SkeletonUtils.clone(model.scene);
    hideVillainMask(villainScene);
    return villainScene;
  }, [model.scene]);
  const groupRef = useRef<Group>(null);
  const positionRef = useRef(bonusSpawnSpots[initialSpot].clone());
  const lastSpawnSpotRef = useRef(initialSpot);
  const targetSpotRef = useRef((initialSpot + 1) % bonusSpawnSpots.length);
  const aliveRef = useRef(true);
  const chasingPlayerRef = useRef(false);
  const respawnTimerRef = useRef(0);
  const pointsTimerRef = useRef(0);
  const [alive, setAlive] = useState(true);
  const [showPoints, setShowPoints] = useState(false);
  const pointsPositionRef = useRef(new Vector3());
  const clips = useMemo(() => villainClips(model.animations), [model.animations]);
  const { actions } = useGameAnimations(clips, groupRef, "idleV");
  const combat = useMemo(() => createVillainCombat(actions), [actions]);
  const navigation = useVillainNavigation();
  const deathTimer = useRef(0);
  useLayoutEffect(() => { combat.setMotion("idle"); }, [combat]);

  useEffect(() => {
    applyCharacterMaterials(scene, model.materials, villainMaterialProfile);
    applyNaturalMaterials(scene);
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = false;
    });
  }, [model.materials, scene]);

  useEffect(() => {
    return () => {
      gameTimers.clearTimeout(deathTimer.current);
      gameTimers.clearTimeout(respawnTimerRef.current);
      gameTimers.clearTimeout(pointsTimerRef.current);
    };
  }, [id]);

  useEffect(() => {
    const defeat = () => {
      if (!aliveRef.current) return;
      aliveRef.current = false;
      chasingPlayerRef.current = false;
      combat.setMotion("dead");
      deathTimer.current = gameTimers.setTimeout(() => setAlive(false), (actions.dieV?.getClip().duration ?? 1) * 1000);
      const bounds = new Box3().setFromObject(scene, true);
      bounds.getCenter(pointsPositionRef.current);
      pointsPositionRef.current.y = bounds.max.y + 0.4;
      setShowPoints(true);
      onDefeat();
      pointsTimerRef.current = gameTimers.setTimeout(() => setShowPoints(false), 1100);

      const delay = 8000 + Math.random() * 2000;
      respawnTimerRef.current = gameTimers.setTimeout(() => {
        const nextSpot = bonusSpawnSpots.findIndex((spot, index) =>
          index !== lastSpawnSpotRef.current
          && isSafeBonusRoamingPosition(spot.x, spot.z)
          && spot.distanceToSquared(playerWorldState.position) > 14 * 14
        );
        const spawnIndex = nextSpot >= 0 ? nextSpot : (lastSpawnSpotRef.current + 2) % bonusSpawnSpots.length;
        lastSpawnSpotRef.current = spawnIndex;
        positionRef.current.copy(bonusSpawnSpots[spawnIndex]);
        targetSpotRef.current = (spawnIndex + 1 + initialSpot) % bonusSpawnSpots.length;
        chasingPlayerRef.current = false;
        groupRef.current?.position.copy(positionRef.current);
        aliveRef.current = true;
        combat.setMotion("idle");
        setAlive(true);
      }, delay);
    };
    powerDefeatHandlers.set(id, defeat);
    return () => { powerDefeatHandlers.delete(id); };
  }, [id, initialSpot, onDefeat, combat, actions, scene]);

  const reaction = useVillainHitReaction(id, scene);

  useGameFrame((_, delta) => {
    const group = groupRef.current;
    if (!group || !aliveRef.current) {
        return;
    }
    if (reaction.active()) { combat.setMotion("idle"); return; }
    const playerDx = playerWorldState.position.x - positionRef.current.x;
    const playerDz = playerWorldState.position.z - positionRef.current.z;
    const playerDistanceSq = playerDx * playerDx + playerDz * playerDz;
    const sameLevel = Math.abs(playerWorldState.position.y - (positionRef.current.y + 1)) < 1.5;
    const inRange = sameLevel && playerDistanceSq <= bonusVillainContactRadiusSq && navigation.sight(positionRef.current, playerWorldState.position);
    if (inRange && poweredContact(id, positionRef.current)) return;
    if (combat.updateAttack(inRange, true, onPlayerDamage)) {
      group.rotation.y = Math.atan2(playerDx, playerDz);
      return;
    }
    combat.setMotion("running");
    if (!sameLevel) chasingPlayerRef.current = false;

    if (chasingPlayerRef.current) {
      if (playerDistanceSq > bonusVillainChaseReleaseRadiusSq) chasingPlayerRef.current = false;
    } else if (sameLevel && playerDistanceSq <= bonusVillainDetectionRadiusSq) {
      chasingPlayerRef.current = true;
    }

    if (chasingPlayerRef.current) {
      const distance = Math.sqrt(playerDistanceSq);
      if (distance === 0) return;

      const directionX = playerDx / distance;
      const directionZ = playerDz / distance;
      const step = Math.min(distance, Math.min(delta, 1 / 30) * bonusVillainMoveSpeed);
      const playerHeading = Math.atan2(directionX, directionZ);
      const safeHeading = bonusVillainSteeringAngles
        .map((angle) => playerHeading + angle)
        .find((candidateHeading) => navigation.clear(positionRef.current.x + Math.sin(candidateHeading) * step, positionRef.current.y, positionRef.current.z + Math.cos(candidateHeading) * step) && canBonusVillainMove(
          positionRef.current.x,
          positionRef.current.z,
          positionRef.current.x + Math.sin(candidateHeading) * step,
          positionRef.current.z + Math.cos(candidateHeading) * step,
        ));

      if (safeHeading === undefined) combat.setMotion("idle");
      if (safeHeading !== undefined) {
        positionRef.current.x += Math.sin(safeHeading) * step;
        positionRef.current.z += Math.cos(safeHeading) * step;
        group.position.copy(positionRef.current);
        const turnDelta = Math.atan2(
          Math.sin(safeHeading - group.rotation.y),
          Math.cos(safeHeading - group.rotation.y),
        );
        group.rotation.y += turnDelta * Math.min(1, delta * 10);
      }

      return;
    }

    const target = bonusSpawnSpots[targetSpotRef.current];
    const dx = target.x - positionRef.current.x;
    const dz = target.z - positionRef.current.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.7) {
      targetSpotRef.current = (targetSpotRef.current + 2) % bonusSpawnSpots.length;
      return;
    }
    if (distance === 0) return;

    const step = Math.min(distance, Math.min(delta, 1 / 30) * bonusVillainMoveSpeed);
    const heading = Math.atan2(dx, dz);
    const nextX = positionRef.current.x + Math.sin(heading) * step;
    const nextZ = positionRef.current.z + Math.cos(heading) * step;
    if (!navigation.clear(nextX, positionRef.current.y, nextZ) || !canBonusVillainMove(positionRef.current.x, positionRef.current.z, nextX, nextZ)) {
      combat.setMotion("idle");
      targetSpotRef.current = (targetSpotRef.current + 1 + initialSpot) % bonusSpawnSpots.length;
      return;
    }

    positionRef.current.x = nextX;
    positionRef.current.z = nextZ;
    group.position.copy(positionRef.current);
    group.rotation.y = heading;
  });

  return (
    <>
      <group ref={groupRef} position={positionRef.current} visible={alive}>
        <group ref={reaction.group}><primitive object={scene} scale={0.68} position={[0, 0.18, 0]} /></group>
      </group>
      {showPoints && (
        <BillboardLabel
          color="#3f7d3a"
          fontSize={0.38}
          position={[pointsPositionRef.current.x, pointsPositionRef.current.y, pointsPositionRef.current.z]}
          maxWidth={2}
        >
          +3
        </BillboardLabel>
      )}
    </>
  );
}

type ContactImpact = { mode: PowerMode; id: number; position: Vector3 };

function PowerContactEffects() {
  const [impacts, setImpacts] = useState<ContactImpact[]>([]);
  const nextId = useRef(0);
  useEffect(() => {
    const impact = (position: Vector3, mode: PowerMode) => {
      const id = nextId.current++;
      setImpacts(current => [...current.slice(-(maxContactImpacts - 1)), { id, mode, position }]);
    };
    powerImpactListeners.add(impact);
    return () => { powerImpactListeners.delete(impact); };
  }, []);
  return <group name="PowerContactEffects">
    {impacts.map(impact => <ImpactBurst key={impact.id} impact={impact}
      onComplete={() => setImpacts(current => current.filter(({ id }) => id !== impact.id))} />)}
  </group>;
}

function ImpactBurst({ onComplete, impact }: { onComplete: () => void; impact: ContactImpact }) {
  const { position, mode } = impact;
  const groupRef = useRef<Group>(null);
  const elapsedRef = useRef(0);
  const sparkDirections = useMemo(() => [
    new Vector3(0.8, 0.5, 0.2),
    new Vector3(-0.55, 0.75, 0.35),
    new Vector3(0.25, 0.9, -0.65),
    new Vector3(-0.4, 0.35, -0.8),
  ].map((direction) => direction.normalize()), []);

  useGameFrame((_, delta) => {
    elapsedRef.current += delta;
    const progress = Math.min(elapsedRef.current / powerModes[mode].impactDuration, 1);
    const group = groupRef.current;
    if (group) {
      group.scale.setScalar(0.12 * (1 - progress) * powerModes[mode].impactSize);
      group.children.forEach((child, index) => {
        if (index === 0) return;
        child.position.copy(sparkDirections[index - 1]).multiplyScalar(progress * 2);
      });
    }
    if (progress >= 1) onComplete();
  });

  return (
    <group ref={groupRef} position={position} scale={0.12 * powerModes[mode].impactSize}>
      <mesh geometry={effectSphereGeometry} material={impactMaterials[mode]} />
      {sparkDirections.map((_, index) => (
        <mesh key={index} geometry={effectSphereGeometry} material={impactMaterials[mode]} scale={0.12} />
      ))}
    </group>
  );
}

function SectionPortalEncounter({
  encounter,
  onInfoClose,
  onInfoOpen,
  onPlayerDialogue,
  onPlayerDamage,
  onSectionResolved,
}: {
  encounter: SectionEncounterConfig;
  onInfoClose: () => void;
  onInfoOpen: () => void;
  onPlayerDialogue: (text: string) => void;
  onPlayerDamage: () => void;
  onSectionResolved: (sectionId: string) => void;
}) {
  const villainPosition = useMemo(() => encounter.villainPosition.clone(), [encounter]);
  const [villainStatus, setVillainStatus] = useState<VillainStatus>("idle");
  const [portalActive, setPortalActive] = useState(false);
  const [infoPortalActive, setInfoPortalActive] = useState(false);
  const [defeatActive, setDefeatActive] = useState(false);
  const [villainVisible, setVillainVisible] = useState(true);
  const voiceEnabled = hasVillainVoice(encounter.id);
  const lastActivatedRef = useRef(-Infinity);
  const lastInfoActivatedRef = useRef(0);
  const wasOnVoicePlatformRef = useRef(false);
  const sectionResolvedTimerRef = useRef(0);
  const defeatedRef = useRef(false);
  useEffect(() => () => stopVillainVoice(encounter.id), [encounter.id]);

  useEffect(() => {
    return () => {
      gameTimers.clearTimeout(sectionResolvedTimerRef.current);
    };
  }, []);

  const activatePad = () => {
    const now = gameNow();
    if (defeatedRef.current) return;
    if (now - lastActivatedRef.current < cooldownMs) return;

    defeatedRef.current = true;
    triggerFixHaptic();
    lastActivatedRef.current = now;
    stopVillainVoice(encounter.id);
    playVillainDefeatSound();
    setPortalActive(true);
    setDefeatActive(true);
    setVillainStatus("dead");
    onPlayerDialogue("FIXED!");
    sectionResolvedTimerRef.current = gameTimers.setTimeout(() => {
      onSectionResolved(encounter.id);
    }, 240);
  };

  useEffect(() => {
    powerDefeatHandlers.set(encounter.id, activatePad);
    return () => { powerDefeatHandlers.delete(encounter.id); };
  });

  const activateInfoPad = () => {
    const now = gameNow();
    if (now - lastInfoActivatedRef.current < 350) return;

    lastInfoActivatedRef.current = now;
    setInfoPortalActive(true);
    onInfoOpen();
  };

  const deactivateInfoPad = () => {
    setInfoPortalActive(false);
    onInfoClose();
  };

  useEffect(() => {
    if (!portalActive) return;

    const timeout = gameTimers.setTimeout(() => {
      setPortalActive(false);
    }, 1000);

    return () => gameTimers.clearTimeout(timeout);
  }, [portalActive]);

  useEffect(() => {
    if (!defeatActive) return;

    const timeout = gameTimers.setTimeout(() => {
      setDefeatActive(false);
      setVillainVisible(false);
    }, defeatDurationMs);

    return () => gameTimers.clearTimeout(timeout);
  }, [defeatActive]);

  useGameFrame(() => {
    const onVoicePlatform =
      voiceEnabled &&
      Math.abs(playerWorldState.position.x - encounter.platformPosition.x) <= destinationPlatformRadius &&
      Math.abs(playerWorldState.position.z - encounter.platformPosition.z) <= destinationPlatformRadius;

    if (onVoicePlatform !== wasOnVoicePlatformRef.current) {
      if (onVoicePlatform && !defeatedRef.current) playVillainVoice(encounter.id);
      else stopVillainVoice(encounter.id);
    }

    wasOnVoicePlatformRef.current = onVoicePlatform;
  });

  return (
    <group name={`PortalEncounter:${encounter.id}`}>
      <TriggerPad label="More Info" position={encounter.infoPadPosition} active={infoPortalActive} onActivate={activateInfoPad} onDeactivate={deactivateInfoPad} />
      {defeatActive && <BillboardLabel color="#ffffff" fontSize={0.28} position={[villainPosition.x, villainPosition.y + 2.8, villainPosition.z]} maxWidth={2}>FIXED!</BillboardLabel>}
      {villainVisible && (
        <VillainCharacter
          id={encounter.id}
          basePosition={villainPosition}
          platformPosition={encounter.platformPosition}
          onPowerContact={() => !defeatedRef.current && poweredContact(encounter.id, villainPosition)}
          onPlayerDamage={() => { if (!defeatedRef.current) onPlayerDamage(); }}
          dialogue={null}
          villainStatus={villainStatus}
        />
      )}
    </group>
  );
}

type TriggerPadProps = {
  active: boolean;
  label?: string;
  onActivate: () => void;
  onDeactivate?: () => void;
  position: Vector3;
};

export function TriggerPad({ active, label, onActivate, onDeactivate, position }: TriggerPadProps) {
  const { pulseRef, ringRef } = useTriggerPadVisuals(active, fixPadVisualConfig);
  const playerInsideRef = useRef(false);
  const lastTriggeredAtRef = useRef(-Infinity);

  const isPlayerEvent = (event: IntersectionEnterPayload | IntersectionExitPayload) => {
    return isPlayerObject(event.other.rigidBodyObject) || isPlayerObject(event.other.colliderObject);
  };

  const handleEnter = (event: IntersectionEnterPayload) => {
    if (!isPlayerEvent(event) || playerInsideRef.current) return;
    playerInsideRef.current = true;

    const now = gameNow();
    if (now - lastTriggeredAtRef.current < padActivationCooldownMs) return;
    lastTriggeredAtRef.current = now;
    onActivate();
  };

  const handleExit = (event: IntersectionExitPayload) => {
    if (!isPlayerEvent(event)) return;
    playerInsideRef.current = false;
    onDeactivate?.();
  };

  return (
    <group position={position}>
      <CylinderCollider
        sensor
        args={[0.28, triggerPadRadius]}
        position={[0, 0.32, 0]}
        onIntersectionEnter={handleEnter}
        onIntersectionExit={handleExit}
      />
      <LocalLightSpill intensity={active ? 2.2 : 0.6} distance={4} />
      <mesh ref={ringRef} geometry={fixRingGeometry} rotation-x={-Math.PI / 2} position={[0, 0.045, 0]} dispose={null}>
        <meshBasicMaterial color={padVisualStyle.color} transparent opacity={0.5} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={pulseRef} geometry={fixPulseGeometry} rotation-x={-Math.PI / 2} position={[0, 0.05, 0]} visible={false} dispose={null}>
        <meshBasicMaterial color={padVisualStyle.color} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      {label && (
        <BillboardLabel
          color={padVisualStyle.labelColor}
          fontSize={label === "More Info" ? 0.24 : 0.28}
          position={[0, triggerPopupLayout.labelHeight, 0]}
          maxWidth={2.5}
        >
          {label}
        </BillboardLabel>
      )}
    </group>
  );
}
