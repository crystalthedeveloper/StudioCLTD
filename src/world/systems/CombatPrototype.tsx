import { fixModes, type FixMode, recordFixHit, releaseFixShot, subscribeFixShot, maxFixShots } from "../../player/fixShooter";
import { segmentEllipsoidHit } from "../projectileCollision";
import { LocalLightSpill } from "./LocalLightSpill";
import { useGameFrame } from "../../player/useGameFrame";
import { useGameAnimations } from "../../player/useGameFrame";
import { gameNow } from "../../player/gameFocus";
import { gameTimers } from "../../player/gameFocus";
import { useGLTF } from "@react-three/drei";
import { CylinderCollider, IntersectionEnterPayload, IntersectionExitPayload } from "@react-three/rapier";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdditiveBlending, CylinderGeometry, Group, InstancedMesh, LoopRepeat, Mesh, MeshBasicMaterial, Object3D, PointLight, Quaternion, Raycaster, SphereGeometry, Vector2, Vector3 } from "three";
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
import { playEnergyBlastSound } from "../../audio/shootSound";
import { triggerFixHaptic } from "../../ui/haptics";
import { VillainCharacter, VillainStatus } from "../../villain/VillainCharacter";
import { hideVillainMask } from "../../villain/hideVillainMask";
import { destinationPlatformRadius, hubSections, sectionRampApproachLength, sectionRampWidth } from "../hubSections";
import { isPlayerObject } from "../playerCollision";
import { playerWorldState } from "../playerWorldState";
import { padVisualStyle } from "../padVisualStyle";
import { triggerPopupLayout } from "../triggerPopupLayout";
import { crosshairNdcY } from "../aiming";
import { fixPulseGeometry, fixRingGeometry, useTriggerPadVisuals } from "../useTriggerPadVisuals";

const cooldownMs = 1800;
const triggerPadRadius = 1.33;
const padActivationCooldownMs = 900;
const encounterSectionIds = ["quick-fix", "urgent-fix", "performance", "site-improvement"];
const smokeDurationMs = 1700;
const villainFrontOffset = 2.8;
const villainSideOffset = 5.1;
const triggerPadFrontOffset = 5.8;
const triggerPadSideOffset = 3.6;
const mainVillainContactRadiusSq = 1.2 * 1.2;
const bonusVillainContactRadiusSq = 1 * 1;
const bonusVillainDetectionRadiusSq = 8 * 8;
const bonusVillainChaseReleaseRadiusSq = 11 * 11;
const bonusVillainMoveSpeed = 2.1;
const bonusVillainSteeringAngles = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI] as const;

const smokeGeometry = new SphereGeometry(1, 8, 8);
const fireGeometry = new SphereGeometry(1, 8, 6);
const fireDurationSeconds = 0.8;
const fireExpansionSeconds = 0.4;
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
const bonusProjectileHitbox = {
  centerY: 1.05,
  horizontalRadius: 1.2,
  verticalRadius: 2.25,
} as const;
const energyBallRadius = 0.46;
const mainVillainHitRadius = 1.45;
const projectileMaxDistance = 48;
const fixHitHandlers = new Map<string, (position: Vector3, damage: number) => void>();
const resolvedTargets = new Set<string>();
const crosshairNdc = new Vector2(0, crosshairNdcY);
const bonusTargets = new Map<string, {
  alive: boolean;
  hitbox: typeof bonusProjectileHitbox;
  position: Vector3;
}>();
const tracerGeometry = new CylinderGeometry(0.025, 0.025, 1.35, 6);
const tracerGlowGeometry = new CylinderGeometry(0.07, 0.07, 1.35, 6);
const tracerMaterial = new MeshBasicMaterial({
  blending: AdditiveBlending,
  color: "#fff9cf",
  depthWrite: false,
  toneMapped: false,
});
const tracerGlowMaterial = new MeshBasicMaterial({
  blending: AdditiveBlending,
  color: "#f4c928",
  depthWrite: false,
  opacity: 0.2,
  toneMapped: false,
  transparent: true,
});
const shotMaterials = Object.fromEntries(Object.entries(fixModes).map(([mode, config]) => {
  const core = tracerMaterial.clone(); core.color.set(config.color);
  const glow = tracerGlowMaterial.clone(); glow.color.set(config.glow);
  return [mode, { core, glow }];
})) as Record<FixMode, { core: MeshBasicMaterial; glow: MeshBasicMaterial }>;
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
      <EnergyProjectileSystem key={`projectiles:${restartKey}`} />
      <BonusVillainSystem
        key={`bonus-villains:${restartKey}`}
        onDefeat={onBonusCollect}
        onPlayerDamage={onPlayerDamage}
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
          onPlayerDamage={onPlayerDamage}
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
  const healthRef = useRef(1);
  const chasingPlayerRef = useRef(false);
  const touchingPlayerRef = useRef(false);
  const respawnTimerRef = useRef(0);
  const pointsTimerRef = useRef(0);
  const [alive, setAlive] = useState(true);
  const [showPoints, setShowPoints] = useState(false);
  const pointsPositionRef = useRef(new Vector3());
  const { actions } = useGameAnimations(model.animations, groupRef, "idleV");

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
    const action = actions.runV;
    if (!action) return undefined;
    action.reset().setLoop(LoopRepeat, Infinity).play();
    return () => {
      action.stop();
    };
  }, [actions]);

  useEffect(() => {
    bonusTargets.set(id, { alive: true, hitbox: bonusProjectileHitbox, position: positionRef.current });
    return () => {
      gameTimers.clearTimeout(respawnTimerRef.current);
      gameTimers.clearTimeout(pointsTimerRef.current);
      bonusTargets.delete(id);
    };
  }, [id]);

  useEffect(() => {
    const hit = (position: Vector3, damage: number) => {
    if (!aliveRef.current) return;
    healthRef.current -= damage;
    if (healthRef.current > 0) return;
    aliveRef.current = false;
    chasingPlayerRef.current = false;
    touchingPlayerRef.current = false;
    const target = bonusTargets.get(id);
    if (target) target.alive = false;
    setAlive(false);
    pointsPositionRef.current.copy(position);
    pointsPositionRef.current.y += 0.55;
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
      healthRef.current = 1;
      const respawnTarget = bonusTargets.get(id);
      if (respawnTarget) respawnTarget.alive = true;
      setAlive(true);
    }, delay);
    };
    fixHitHandlers.set(id, hit);
    return () => { fixHitHandlers.delete(id); };
  }, [id, initialSpot, onDefeat]);

  useGameFrame((_, delta) => {
    const group = groupRef.current;
    if (!group || !aliveRef.current) {
      touchingPlayerRef.current = false;
      return;
    }
    const playerDx = playerWorldState.position.x - positionRef.current.x;
    const playerDz = playerWorldState.position.z - positionRef.current.z;
    const playerDistanceSq = playerDx * playerDx + playerDz * playerDz;
    const touchingPlayer = playerDistanceSq <= bonusVillainContactRadiusSq;
    if (touchingPlayer && !touchingPlayerRef.current) onPlayerDamage();
    touchingPlayerRef.current = touchingPlayer;

    if (chasingPlayerRef.current) {
      if (playerDistanceSq > bonusVillainChaseReleaseRadiusSq) chasingPlayerRef.current = false;
    } else if (playerDistanceSq <= bonusVillainDetectionRadiusSq) {
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
        .find((candidateHeading) => canBonusVillainMove(
          positionRef.current.x,
          positionRef.current.z,
          positionRef.current.x + Math.sin(candidateHeading) * step,
          positionRef.current.z + Math.cos(candidateHeading) * step,
        ));

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
    if (!canBonusVillainMove(positionRef.current.x, positionRef.current.z, nextX, nextZ)) {
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
        <primitive object={scene} scale={0.68} position={[0, 0.18, 0]} />
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

type EnergyProjectile = {
  mode: FixMode;
  obstacles: Object3D[];
  direction: Vector3;
  id: number;
  maxDistance: number;
  position: Vector3;
};

type EnergyImpact = {
  mode: FixMode;
  hit: boolean;
  id: number;
  position: Vector3;
};

function belongsToAimExcludedObject(object: Object3D) {
  let current: Object3D | null = object;
  while (current) {
    if (current.name === "StudioCLTDPlayer" || current.name === "PlayerEnergyProjectiles") return true;
    current = current.parent;
  }
  return false;
}

function EnergyProjectileSystem() {
  const [projectiles, setProjectiles] = useState<EnergyProjectile[]>([]);
  const [impacts, setImpacts] = useState<EnergyImpact[]>([]);
  const activeIds = useRef(new Set<number>());
  const raycasterRef = useRef(new Raycaster());
  const { camera, scene } = useThree();

  useEffect(() => {
    const unsubscribe = subscribeFixShot((id, mode) => {
      if (activeIds.current.size >= maxFixShots) { releaseFixShot(id); return; }
      const playerYaw = playerWorldState.yaw;
      const forward = new Vector3(-Math.sin(playerYaw), 0, -Math.cos(playerYaw));
      const right = new Vector3(-forward.z, 0, forward.x);
      const position = playerWorldState.position.clone().addScaledVector(forward, 0.75).addScaledVector(right, 0.34);
      position.y += 1.35;
      const obstacles: Object3D[] = [];
      scene.traverse((object) => { if (isProjectileObstacle(object)) obstacles.push(object); });
      const raycaster = raycasterRef.current;
      raycaster.setFromCamera(crosshairNdc, camera);
      const rayHit = raycaster.intersectObjects(obstacles, false)[0];
      const target = rayHit?.point.clone() ?? raycaster.ray.at(projectileMaxDistance, new Vector3());
      const direction = target.sub(position).normalize();
      activeIds.current.add(id);
      playEnergyBlastSound();
      setProjectiles((current) => [...current, { direction, id, mode, maxDistance: projectileMaxDistance, position, obstacles }]);
    });
    return () => {
      unsubscribe();
      activeIds.current.forEach(releaseFixShot);
      activeIds.current.clear();
    };
  }, [camera, scene]);

  return (
    <group name="PlayerEnergyProjectiles">
      {projectiles.map((projectile) => (
        <EnergyBall key={projectile.id} projectile={projectile} onComplete={(hitId, position) => {
          if (!activeIds.current.delete(projectile.id)) return;
          releaseFixShot(projectile.id);
          setProjectiles((current) => current.filter(({ id }) => id !== projectile.id));
          setImpacts((current) => [...current.slice(-(maxFixShots - 1)), { id: projectile.id, mode: projectile.mode, position, hit: Boolean(hitId) }]);
          if (hitId) { recordFixHit(projectile.mode); fixHitHandlers.get(hitId)?.(position, fixModes[projectile.mode].damage); }
        }} />
      ))}
      {impacts.map((impact) => (
        <ImpactBurst key={impact.id} position={impact.position} hit={impact.hit} mode={impact.mode}
          onComplete={() => setImpacts((current) => current.filter(({ id }) => id !== impact.id))} />
      ))}
    </group>
  );
}

// Only physical scenery blocks a shot: labels, transparent effects, characters,
// sky and the player's own meshes must not shorten its trajectory.
function isProjectileObstacle(object: Object3D) {
  if (!(object instanceof Mesh) || belongsToAimExcludedObject(object)) return false;
  let parent: Object3D | null = object;
  let solid = false;
  while (parent) {
    if (!parent.visible) return false;
    if (parent.name === "CinematicSky" || parent.name === "SectionPortalEncounters") return false;
    if (parent.name === "WeatheredConcreteTerrain" || parent.name === "HomeBase" || parent.name.startsWith("BillboardVisual:")) solid = true;
    parent = parent.parent;
  }
  return solid && (object.castShadow || object.receiveShadow) && !(Array.isArray(object.material) ? object.material : [object.material]).some((material) => material.transparent);
}

function EnergyBall({ onComplete, projectile }: { onComplete: (hitId: string | undefined, position: Vector3) => void; projectile: EnergyProjectile }) {
  const collisionRay = useRef(new Raycaster());
  const groupRef = useRef<Group>(null);
  const travelledRef = useRef(0);
  const completedRef = useRef(false);
  const orientation = useMemo(
    () => new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), projectile.direction),
    [projectile.direction],
  );

  useGameFrame((_, delta) => {
    const group = groupRef.current;
    if (!group || completedRef.current) return;
    const distance = Math.min(Math.max(0, delta) * fixModes[projectile.mode].speed, projectile.maxDistance - travelledRef.current);
    const start = group.position.clone();
    const end = start.clone().addScaledVector(projectile.direction, distance);
    let earliest = 1;
    let hitId: string | undefined;
    const shotRadius = energyBallRadius * fixModes[projectile.mode].size;
    const radius = mainVillainHitRadius + shotRadius;
    for (const encounter of sectionEncounters) {
      if (!fixHitHandlers.has(encounter.id) || resolvedTargets.has(encounter.id)) continue;
      const center = encounter.villainPosition.clone(); center.y += 1.25;
      const t = segmentEllipsoidHit(start, end, center, radius, radius, radius);
      if (t !== null && t <= earliest) { earliest = t; hitId = encounter.id; }
    }
    for (const [id, target] of bonusTargets) {
      if (!target.alive) continue;
      const center = target.position.clone(); center.y += target.hitbox.centerY;
      const t = segmentEllipsoidHit(start, end, center, target.hitbox.horizontalRadius + shotRadius, target.hitbox.verticalRadius + shotRadius, target.hitbox.horizontalRadius + shotRadius);
      if (t !== null && t <= earliest) { earliest = t; hitId = id; }
    }
    const ray = collisionRay.current;
    ray.set(start, projectile.direction);
    ray.near = 0;
    ray.far = distance * earliest;
    const obstacle = ray.intersectObjects(projectile.obstacles, false)[0];
    if (obstacle && distance > 0) { earliest = obstacle.distance / distance; hitId = undefined; }
    group.position.lerpVectors(start, end, earliest);
    travelledRef.current += distance * earliest;
    if (!hitId && !obstacle && travelledRef.current < projectile.maxDistance) return;
    completedRef.current = true;
    onComplete(hitId, group.position.clone());
  });

  return (
    <>
      <MuzzleFlash position={projectile.position} mode={projectile.mode} />
      <group ref={groupRef} position={projectile.position} quaternion={orientation} scale={fixModes[projectile.mode].size}>
        <mesh geometry={tracerGeometry} material={shotMaterials[projectile.mode].core} position={[0, -0.675, 0]} />
        <mesh geometry={tracerGlowGeometry} material={shotMaterials[projectile.mode].glow} position={[0, -0.675, 0]} />
      </group>
    </>
  );
}

function MuzzleFlash({ position, mode }: { position: Vector3; mode: FixMode }) {
  const groupRef = useRef<Group>(null);
  const elapsedRef = useRef(0);

  useGameFrame((_, delta) => {
    elapsedRef.current += delta;
    const group = groupRef.current;
    if (!group) return;
    const progress = Math.min(elapsedRef.current / fixModes[mode].flashDuration, 1);
    group.visible = progress < 1;
    group.scale.setScalar((0.18 + progress * 0.22) * fixModes[mode].size);
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh geometry={effectSphereGeometry} material={shotMaterials[mode].core} scale={[1, 0.65, 1]} />
      <mesh geometry={effectSphereGeometry} material={shotMaterials[mode].glow} scale={1.7} />
    </group>
  );
}

function ImpactBurst({ onComplete, position, hit, mode }: { onComplete: () => void; position: Vector3; hit: boolean; mode: FixMode }) {
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
    const progress = Math.min(elapsedRef.current / (hit ? fixModes[mode].impactDuration : fixModes[mode].impactDuration * 0.6), 1);
    const group = groupRef.current;
    if (group) {
      group.scale.setScalar(((hit ? 0.24 : 0.12) + progress * (hit ? 0.55 : 0.25)) * fixModes[mode].size);
      group.children.forEach((child, index) => {
        if (index < 2) return;
        child.position.copy(sparkDirections[index - 2]).multiplyScalar(progress * 0.7);
      });
    }
    if (progress >= 1) onComplete();
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh geometry={effectSphereGeometry} material={shotMaterials[mode].core} />
      <mesh geometry={effectSphereGeometry} material={shotMaterials[mode].glow} scale={1.65} />
      {sparkDirections.map((_, index) => (
        <mesh key={index} geometry={effectSphereGeometry} material={shotMaterials[mode].core} scale={0.12} />
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
  const [villainStatus, setVillainStatus] = useState<VillainStatus>("idle");
  const [portalActive, setPortalActive] = useState(false);
  const [infoPortalActive, setInfoPortalActive] = useState(false);
  const [smokeActive, setSmokeActive] = useState(false);
  const [villainVisible, setVillainVisible] = useState(true);
  const voiceEnabled = hasVillainVoice(encounter.id);
  const lastActivatedRef = useRef(-Infinity);
  const lastInfoActivatedRef = useRef(0);
  const wasOnVoicePlatformRef = useRef(false);
  const touchingPlayerRef = useRef(false);
  const sectionResolvedTimerRef = useRef(0);
  const defeatedRef = useRef(false);
  const healthRef = useRef(1);
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
    resolvedTargets.add(encounter.id);
    triggerFixHaptic();
    lastActivatedRef.current = now;
    stopVillainVoice(encounter.id);
    playVillainDefeatSound();
    setPortalActive(true);
    setSmokeActive(true);
    setVillainStatus("dead");
    onPlayerDialogue("FIXED!");
    sectionResolvedTimerRef.current = gameTimers.setTimeout(() => {
      onSectionResolved(encounter.id);
    }, 240);
  };

  useEffect(() => {
    fixHitHandlers.set(encounter.id, (_position, damage) => {
      if (defeatedRef.current) return;
      healthRef.current -= damage;
      if (healthRef.current <= 0) activatePad();
    });
    return () => { fixHitHandlers.delete(encounter.id); };
  });
  useEffect(() => () => { resolvedTargets.delete(encounter.id); }, [encounter.id]);

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
    if (!smokeActive) return;

    const timeout = gameTimers.setTimeout(() => {
      setSmokeActive(false);
      setVillainVisible(false);
    }, smokeDurationMs);

    return () => gameTimers.clearTimeout(timeout);
  }, [smokeActive]);

  useGameFrame(() => {
    const playerDeltaX = playerWorldState.position.x - encounter.villainPosition.x;
    const playerDeltaZ = playerWorldState.position.z - encounter.villainPosition.z;
    const touchingPlayer = !defeatedRef.current
      && playerDeltaX * playerDeltaX + playerDeltaZ * playerDeltaZ <= mainVillainContactRadiusSq;
    if (touchingPlayer && !touchingPlayerRef.current) onPlayerDamage();
    touchingPlayerRef.current = touchingPlayer;

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
      {smokeActive && (
        <>
          <FireBurstEffect position={encounter.villainPosition} />
          <SmokeDeathEffect position={encounter.villainPosition} />
        </>
      )}
      {villainVisible && (
        <VillainCharacter
          basePosition={encounter.villainPosition}
          dialogue={null}
          villainStatus={villainStatus}
        />
      )}
    </group>
  );
}

type FireLayer = "core" | "flame" | "outer";

type FireParticle = {
  angle: number;
  delay: number;
  elevation: number;
  phase: number;
  size: number;
  speed: number;
};

const fireLayerCounts: Record<FireLayer, number> = {
  core: 5,
  flame: 9,
  outer: 11,
};

function createFireParticles(count: number, layerOffset: number): FireParticle[] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  return Array.from({ length: count }, (_, index) => ({
    angle: index * goldenAngle + layerOffset,
    delay: (index % 4) * 0.018,
    elevation: -0.28 + ((index * 7) % 13) / 12,
    phase: index * 1.73 + layerOffset,
    size: 0.72 + ((index * 5) % 7) * 0.07,
    speed: 0.82 + ((index * 3) % 8) * 0.055,
  }));
}

function FireBurstEffect({ position }: { position: Vector3 }) {
  const groupRef = useRef<Group>(null);
  const coreRef = useRef<InstancedMesh>(null);
  const flameRef = useRef<InstancedMesh>(null);
  const outerRef = useRef<InstancedMesh>(null);
  const lightRef = useRef<PointLight>(null);
  const startedAtRef = useRef(0);
  const transform = useMemo(() => new Object3D(), []);
  const particles = useRef<Record<FireLayer, FireParticle[]>>({
    core: createFireParticles(fireLayerCounts.core, 0.35),
    flame: createFireParticles(fireLayerCounts.flame, 1.7),
    outer: createFireParticles(fireLayerCounts.outer, 3.1),
  });
  const materials = useMemo(
    () => ({
      core: new MeshBasicMaterial({
        blending: AdditiveBlending,
        color: "#fffbd1",
        depthWrite: false,
        opacity: 1,
        toneMapped: false,
        transparent: true,
      }),
      flame: new MeshBasicMaterial({
        blending: AdditiveBlending,
        color: "#ff8a0a",
        depthWrite: false,
        opacity: 0.92,
        toneMapped: false,
        transparent: true,
      }),
      outer: new MeshBasicMaterial({
        blending: AdditiveBlending,
        color: "#b51b08",
        depthWrite: false,
        opacity: 0.78,
        toneMapped: false,
        transparent: true,
      }),
    }),
    []
  );

  useEffect(() => () => Object.values(materials).forEach((material) => material.dispose()), [materials]);

  useGameFrame(({ clock }) => {
    if (startedAtRef.current === 0) startedAtRef.current = clock.elapsedTime;
    const elapsed = clock.elapsedTime - startedAtRef.current;
    const group = groupRef.current;
    if (!group) return;

    if (elapsed >= fireDurationSeconds) {
      group.visible = false;
      return;
    }

    const expansionProgress = Math.min(elapsed / fireExpansionSeconds, 1);
    const expansion = 1 - Math.pow(1 - expansionProgress, 3);
    const refs: Record<FireLayer, InstancedMesh | null> = {
      core: coreRef.current,
      flame: flameRef.current,
      outer: outerRef.current,
    };

    (Object.keys(refs) as FireLayer[]).forEach((layer) => {
      const mesh = refs[layer];
      if (!mesh) return;
      const layerRadius = layer === "core" ? 0.62 : layer === "flame" ? 1.35 : 1.85;
      const layerStretch = layer === "core" ? 0.9 : layer === "flame" ? 1.35 : 1.08;

      particles.current[layer].forEach((particle, index) => {
        const localElapsed = Math.max(0, elapsed - particle.delay);
        const localExpansion = Math.min(localElapsed / fireExpansionSeconds, 1);
        const radius = layerRadius * particle.speed * (1 - Math.pow(1 - localExpansion, 3));
        const turbulence = Math.sin(localElapsed * 24 + particle.phase) * 0.13 * expansion;
        const verticalTurbulence = Math.cos(localElapsed * 19 + particle.phase) * 0.1 * expansion;
        const size = particle.size * (0.18 + expansion * 0.82);

        transform.position.set(
          Math.cos(particle.angle) * radius + turbulence,
          particle.elevation * radius + verticalTurbulence,
          Math.sin(particle.angle) * radius - turbulence
        );
        transform.rotation.set(
          particle.elevation * 0.7,
          particle.angle,
          Math.sin(particle.phase) * 0.45
        );
        transform.scale.set(size * 0.72, size * layerStretch, size * 0.72);
        transform.updateMatrix();
        mesh.setMatrixAt(index, transform.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    });

    materials.core.opacity = Math.max(0, 1 - elapsed / 0.36);
    materials.flame.opacity = Math.max(0, Math.min(1, elapsed / 0.045) * (1 - elapsed / 0.68));
    materials.outer.opacity = Math.max(0, Math.min(0.82, elapsed / 0.09) * (1 - elapsed / fireDurationSeconds));

    if (lightRef.current) {
      const ignition = Math.min(elapsed / 0.035, 1);
      lightRef.current.intensity = 70 * ignition * Math.pow(1 - elapsed / fireDurationSeconds, 2);
    }
  });

  return (
    <group
      ref={groupRef}
      name="VillainFireBurstEffect"
      position={[position.x, position.y + 1.15, position.z]}
    >
      <pointLight ref={lightRef} color="#ff9a22" decay={2} distance={12} intensity={0} />
      <instancedMesh ref={outerRef} args={[fireGeometry, materials.outer, fireLayerCounts.outer]} />
      <instancedMesh ref={flameRef} args={[fireGeometry, materials.flame, fireLayerCounts.flame]} />
      <instancedMesh ref={coreRef} args={[fireGeometry, materials.core, fireLayerCounts.core]} />
    </group>
  );
}

function SmokeDeathEffect({ position }: { position: Vector3 }) {
  const groupRef = useRef<Group>(null);
  const startedAtRef = useRef(0);
  const lastSmokeFrameRef = useRef(-1);
  const smokeMaterials = useMemo(
    () =>
      Array.from(
        { length: 8 },
        (_, index) =>
          new MeshBasicMaterial({
            color: index % 3 === 0 ? "#5a0710" : "#070406",
            depthWrite: false,
            opacity: 0.28,
            toneMapped: false,
            transparent: true,
          })
      ),
    []
  );
  const particles = useRef(
    Array.from({ length: 8 }, (_, index) => ({
      angle: (index / 8) * Math.PI * 2,
      delay: (index % 5) * 0.08,
      radius: 0.22 + (index % 4) * 0.13,
      rise: 1.15 + (index % 5) * 0.18,
      scale: 0.34 + (index % 4) * 0.08,
      speed: 0.65 + (index % 3) * 0.12,
    }))
  );

  useEffect(() => () => smokeMaterials.forEach((material) => material.dispose()), [smokeMaterials]);

  useGameFrame(({ clock }) => {
    const frameSlot = Math.floor(clock.elapsedTime * 20);
    if (frameSlot === lastSmokeFrameRef.current) return;
    lastSmokeFrameRef.current = frameSlot;

    const group = groupRef.current;
    if (!group) return;

    if (startedAtRef.current === 0) startedAtRef.current = clock.elapsedTime;
    const elapsed = clock.elapsedTime - startedAtRef.current;
    const progress = Math.min(elapsed / (smokeDurationMs / 1000), 1);
    const fade = 1 - progress;

    group.children.forEach((child, index) => {
      const particle = particles.current[index];
      if (!particle) return;

      const localProgress = Math.max(0, Math.min((elapsed - particle.delay) / 1.35, 1));
      const driftAngle = particle.angle + elapsed * particle.speed;
      child.position.set(
        Math.cos(driftAngle) * particle.radius * (1 + localProgress * 0.85),
        0.55 + localProgress * particle.rise,
        Math.sin(driftAngle) * particle.radius * (1 + localProgress * 0.85)
      );
      child.scale.setScalar(particle.scale * (1 + localProgress * 1.4));

      const material = smokeMaterials[index];
      if (material) material.opacity = Math.max(0, fade * (0.34 - localProgress * 0.12));
    });
  });

  return (
    <group ref={groupRef} name="VillainSmokeDeathEffect" position={[position.x, position.y, position.z]}>
      {particles.current.map((particle, index) => (
        <mesh
          key={index}
          geometry={smokeGeometry}
          material={smokeMaterials[index]}
          position={[0, 0.6, 0]}
          scale={particle.scale}
        />
      ))}
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
