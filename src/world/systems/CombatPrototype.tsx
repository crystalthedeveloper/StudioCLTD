import { playerSphereRadius } from "../../player/playerDimensions";
import { bonusRouteSpots } from "../worldLayout";
import { isCompactVisualBudget } from "../visualQuality";
import { NearbyAsset } from "../NearbyAsset";
import { assetForDevice } from "../mobileAssets";
import { powerModes, type PowerMode, type DefeatEffect, getActivePowers, isPowerActive, resolvePowerContact, resetPowerContact } from "../../player/temporaryPowers";
import { createVillainCombat, villainClips } from "../../villain/villainCombat";
import { useVillainNavigation } from "../../villain/useVillainNavigation";
import { useVillainHitReaction } from "../../villain/useVillainHitReaction";
import { useGameFrame } from "../../player/useGameFrame";
import { useGameAnimations } from "../../player/useGameFrame";
import { gameNow } from "../../player/gameFocus";
import { gameTimers } from "../../player/gameFocus";
import { useGLTF } from "@react-three/drei";
import { useLoader } from "@react-three/fiber";
import { CylinderCollider, IntersectionEnterPayload, IntersectionExitPayload } from "@react-three/rapier";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AdditiveBlending, Box3, CanvasTexture, Group, Mesh, MeshBasicMaterial, Sprite, SpriteMaterial, TextureLoader, Vector3 } from "three";
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
import { clampRoadX, roadCenterX, roadHalfWidth, roadHeight, roadPoint, roadSurfaceY } from "../roadSurface";
import { brandYellow } from "../../player/effectColors";

const cooldownMs = 1800;
const triggerPadRadius = 1.33;
const padActivationCooldownMs = 900;
const encounterSectionIds = ["quick-fix", "urgent-fix", "performance", "site-improvement"];
const defeatDurationMs = 1700;
const villainFrontOffset = 2.8;
const villainSideOffset = 5.1;
// Keep service triggers in the same front-of-TV position as Tips and Value.
const triggerPadFrontOffset = 11.7;
const bonusVillainContactRadiusSq = 1 * 1;
const bonusVillainDetectionRadiusSq = 8 * 8;
const bonusVillainChaseReleaseRadiusSq = 11 * 11;
const bonusVillainMoveSpeed = 1.2;
const unpoweredVillainSpeedMultiplier = 2.7;
const bonusVillainVisualScale = 0.48;
const bonusVillainSteeringAngles = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI] as const;

// Warm the device-specific villain model cache before the loading gate opens.
useGLTF.preload(assetForDevice("/characters/villain.glb"));

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
      // SectionBillboard uses local +X for the right-side group; the road
      // tangent points in the opposite local direction here.
      const triggerPadSideOffset = ["quick-fix", "urgent-fix", "performance", "site-improvement"].includes(section.id) ? -5.4 : 5.4;
      const billboardSide = ["tips", "value", "urgent-fix", "site-improvement"].includes(section.id) ? -1 : 1;
      // Place the main villain on the road just ahead of its roadside TV,
      // leaving the full screen face visible from the approach.
      const villainRoadPoint = roadPoint(0, section.position[2] - 8);
      const villainPosition = new Vector3(...villainRoadPoint);
      const padPosition = sectionPosition
        .clone()
        .add(towardEntrance.clone().multiplyScalar(triggerPadFrontOffset))
        .add(tangent.clone().multiplyScalar(triggerPadSideOffset));
      const infoPadPosition = sectionPosition
        .clone()
        .add(towardEntrance.clone().multiplyScalar(triggerPadFrontOffset))
        .add(tangent.clone().multiplyScalar(-triggerPadSideOffset));

      villainPosition.x = clampRoadX(villainPosition.x, villainPosition.z);
      padPosition.y = roadHeight(padPosition.z) + 0.07;
      infoPadPosition.y = roadHeight(infoPadPosition.z) + 0.07;

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
const bonusSpawnSpots = bonusRouteSpots.map(([x, z]) => new Vector3(...roadPoint(x, z)));
const villainPoolSize = 32;
const activeVillainPoolSize = () => isCompactVisualBudget() ? 14 : 24;
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
  let clearance = Math.min(roadHalfWidth - Math.abs(x - roadCenterX(z)), z + 460, 28 - z);

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
const powerDefeatHandlers = new Map<string, (reward: number) => void>();
const powerImpactListeners = new Set<(position: Vector3, effect: DefeatEffect) => void>();
let impactParticleTexture: CanvasTexture | null = null;
function getImpactParticleTexture() {
  if (impactParticleTexture || typeof document === "undefined") return impactParticleTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 32; canvas.height = 32;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const gradient = context.createRadialGradient(16, 16, 1, 16, 16, 16);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.35, "rgba(255,255,255,.9)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 32, 32);
  impactParticleTexture = new CanvasTexture(canvas);
  impactParticleTexture.needsUpdate = true;
  return impactParticleTexture;
}
let bloodSplatterTexture: CanvasTexture | null = null;
function getBloodSplatterTexture() {
  if (bloodSplatterTexture || typeof document === "undefined") return bloodSplatterTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 96; canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "#8f1724";
  const drops = [[48, 32, 27, 13], [18, 25, 9, 5], [76, 21, 8, 4], [27, 48, 6, 3], [70, 47, 5, 3], [55, 13, 4, 3]];
  drops.forEach(([x, y, rx, ry]) => { context.beginPath(); context.ellipse(x, y, rx, ry, (x - 48) * 0.02, 0, Math.PI * 2); context.fill(); });
  bloodSplatterTexture = new CanvasTexture(canvas);
  bloodSplatterTexture.needsUpdate = true;
  return bloodSplatterTexture;
}
function poweredContact(id: string, basePosition: Vector3, defeatEffect: DefeatEffect) {
  const defeat = powerDefeatHandlers.get(id);
  if (!defeat) return false;
  return resolvePowerContact(true, id, (mode, reward) => {
    const direction = basePosition.clone().sub(playerWorldState.position).setY(0).normalize();
    const point = basePosition.clone().add(new Vector3(0, 1, 0)).addScaledVector(direction, -0.25);
    defeat(reward);
    playVillainDefeatSound();
    // Emit one visual wisp per active power; gameplay still resolves exactly once.
    powerImpactListeners.forEach(listener => listener(point, defeatEffect));
  });
}
type CombatPrototypeProps = {
  onVillainReward: (amount: number) => void;
  onPlayerDamage: () => void;
  onPlayerDialogue: (text: string) => void;
  onSectionResolved: (sectionId: string) => void;
  onSectionTrigger: (sectionId: string, triggerId: string) => void;
  restartKey: number | string;
  level: number;
  roundActive: boolean;
  onVillainDefeated: () => void;
  defeatEffect: DefeatEffect;
};

export function CombatPrototype({
  onVillainReward,
  onPlayerDamage,
  onPlayerDialogue,
  onSectionResolved,
  onSectionTrigger,
  restartKey,
  level,
  roundActive,
  onVillainDefeated,
  defeatEffect,
}: CombatPrototypeProps) {
  const contactDamage = () => { if (!isPowerActive()) onPlayerDamage(); };
  const [visibleEncounterCount, setVisibleEncounterCount] = useState(1);

  useEffect(() => {
    preloadVillainAudio();
    return stopAllVillainAudio;
  }, []);

  useEffect(() => stopAllVillainAudio(), [restartKey]);

  useEffect(() => {
    setVisibleEncounterCount(1);
  }, [restartKey]);

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
        onDefeat={(amount) => { onVillainReward(amount); onVillainDefeated(); }}
        defeatEffect={defeatEffect}
        onPlayerDamage={contactDamage}
        roundActive={roundActive}
        level={level}
      />
      {sectionEncounters.map((encounter) => (
        <NearbyAsset key={`${encounter.id}:${restartKey}`} position={[0, 0, 0]}>
          <SectionPortalEncounter
            encounter={encounter}
            active
            onPlayerDialogue={onPlayerDialogue}
            onPlayerDamage={contactDamage}
            onSectionResolved={onSectionResolved}
            onReward={onVillainReward}
          />
        </NearbyAsset>
      ))}
    </group>
  );
}

function BonusVillainSystem({
  onDefeat,
  onPlayerDamage,
  roundActive,
  level,
  defeatEffect,
}: {
  onDefeat: (amount: number) => void;
  onPlayerDamage: () => void;
  roundActive: boolean;
  level: number;
  defeatEffect: DefeatEffect;
}) {
  return (
    <group name="BonusVillains">
      {Array.from({ length: villainPoolSize }, (_, index) => (
        <BonusVillain key={`bonus-pool:${index + 1}`} id={`bonus:${index + 1}`} initialSpot={index % bonusSpawnSpots.length} initiallyActive={index < activeVillainPoolSize()} onDefeat={onDefeat} onPlayerDamage={onPlayerDamage} roundActive={roundActive} level={level} defeatEffect={defeatEffect} />
      ))}
    </group>
  );
}

function BonusVillain({
  id,
  initialSpot,
  initiallyActive,
  onDefeat,
  onPlayerDamage,
  roundActive,
  level,
  defeatEffect,
}: {
  id: string;
  initialSpot: number;
  initiallyActive: boolean;
  onDefeat: (amount: number) => void;
  onPlayerDamage: () => void;
  roundActive: boolean;
  level: number;
  defeatEffect: DefeatEffect;
}) {
  const model = useGLTF(assetForDevice("/characters/villain.glb"), false, true);
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
  const poolActiveRef = useRef(initiallyActive);
  const chasingPlayerRef = useRef(false);
  const respawnTimerRef = useRef<number | null>(null);
  const cashPopupTimerRef = useRef(0);
  const [alive, setAlive] = useState(initiallyActive);
  const [showCashPopup, setShowCashPopup] = useState(false);
  const [cashReward, setCashReward] = useState(0);
  const roundActiveRef = useRef(roundActive);
  roundActiveRef.current = roundActive;
  const cashPopupPositionRef = useRef(new Vector3());
  const clips = useMemo(() => villainClips(model.animations), [model.animations]);
  const { actions, animationReady } = useGameAnimations(clips, groupRef, "idleV");
  const combat = useMemo(() => createVillainCombat(actions), [actions]);
  const navigation = useVillainNavigation();
  const deathTimer = useRef(0);
  useLayoutEffect(() => { combat.setMotion("idle"); }, [combat]);
  useEffect(() => { combat.setMotion("idle"); }, [combat]);

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
      if (respawnTimerRef.current !== null) gameTimers.clearTimeout(respawnTimerRef.current);
      gameTimers.clearTimeout(cashPopupTimerRef.current);
    };
  }, [id]);

  useEffect(() => {
    const defeat = (reward: number) => {
      if (!aliveRef.current) return;
      aliveRef.current = false;
      chasingPlayerRef.current = false;
      combat.setMotion("dead");
      deathTimer.current = gameTimers.setTimeout(() => setAlive(false), (actions.dieV?.getClip().duration ?? 1) * 1000);
      const bounds = new Box3().setFromObject(scene, true);
      bounds.getCenter(cashPopupPositionRef.current);
      cashPopupPositionRef.current.y = bounds.max.y + 0.4;
      setShowCashPopup(true);
      setCashReward(reward);
      onDefeat(reward);
      cashPopupTimerRef.current = gameTimers.setTimeout(() => setShowCashPopup(false), 1100);

      const delay = 3000 + Math.random() * Math.max(1200, 4000 - level * 180);
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
        resetPowerContact(id);
        if (!roundActiveRef.current) {
          respawnTimerRef.current = gameTimers.setTimeout(() => {
            respawnTimerRef.current = null;
            if (roundActiveRef.current) {
              resetPowerContact(id);
              aliveRef.current = true;
              poolActiveRef.current = true;
              combat.setMotion("idle");
              setAlive(true);
            }
          }, 450);
          return;
        }
        aliveRef.current = true;
        poolActiveRef.current = true;
        combat.setMotion("idle");
        setAlive(true);
      }, delay);
    };
    powerDefeatHandlers.set(id, defeat);
    return () => { powerDefeatHandlers.delete(id); };
  }, [id, initialSpot, onDefeat, combat, actions, scene, level, roundActive]);

  const reaction = useVillainHitReaction(id, scene);

  useGameFrame((_, delta) => {
    const group = groupRef.current;
    if (!group || !roundActive || !poolActiveRef.current || !aliveRef.current) {
        return;
    }
    const playerDx = playerWorldState.position.x - positionRef.current.x;
    const playerDz = playerWorldState.position.z - positionRef.current.z;
    const playerDistanceSq = playerDx * playerDx + playerDz * playerDz;
    const sameLevel = Math.abs(playerWorldState.position.y - (positionRef.current.y + 0.7)) < 1.15;
    // Only nearby pool members receive full chase, collision and attack work.
    // Distant active members stay rendered but idle until the Player approaches.
    if (playerDistanceSq > 65 * 65) {
      chasingPlayerRef.current = false;
      combat.setMotion("idle");
      return;
    }
    const inRange = sameLevel && playerDistanceSq <= bonusVillainContactRadiusSq && navigation.sight(positionRef.current, playerWorldState.position);
    // Sphere against the bonus villain's body volume, not its chase radius.
    const bodyDx = Math.max(Math.abs(playerDx) - 0.3, 0);
    const bodyDz = Math.max(Math.abs(playerDz) - 0.3, 0);
    const bodyDy = Math.max(positionRef.current.y + 0.12 - playerWorldState.position.y,
      playerWorldState.position.y - (positionRef.current.y + 1.2), 0);
    const touchingBody = bodyDx * bodyDx + bodyDy * bodyDy + bodyDz * bodyDz <= playerSphereRadius ** 2;
    if (touchingBody
      && poweredContact(id, positionRef.current, defeatEffect)) return;
    if (inRange) onPlayerDamage();
    if (reaction.active()) { combat.setMotion("idle"); return; }
    const detected = sameLevel && playerDistanceSq <= bonusVillainDetectionRadiusSq;
    if (!detected) {
      chasingPlayerRef.current = false;
      combat.setMotion("idle");
      return;
    }
    // Powered players must be approached all the way to body contact. The
    // longer melee attack range otherwise leaves an idle player out of reach.
    if (combat.updateAttack(inRange && !isPowerActive(), true)) {
      group.rotation.y = Math.atan2(playerDx, playerDz);
      return;
    }
    combat.setMotion("running");
    chasingPlayerRef.current = true;
    if (chasingPlayerRef.current) {
      const distance = Math.sqrt(playerDistanceSq);
      if (distance === 0) return;

      const awayX = positionRef.current.x - playerWorldState.position.x;
      const awayZ = Math.min(-0.35, positionRef.current.z - playerWorldState.position.z);
      const awayLength = Math.hypot(awayX, awayZ) || 1;
      const directionX = isPowerActive() ? awayX / awayLength : playerDx / distance;
      const directionZ = isPowerActive() ? awayZ / awayLength : playerDz / distance;
      const approachSpeed = bonusVillainMoveSpeed
        * (isPowerActive() ? 1 : unpoweredVillainSpeedMultiplier)
        * (1 + Math.min(0.55, (level - 1) * 0.045));
      const step = Math.min(distance, Math.min(delta, 1 / 30) * approachSpeed);
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
        positionRef.current.y = roadHeight(positionRef.current.z);
        group.position.copy(positionRef.current);
        const turnDelta = Math.atan2(
          Math.sin(safeHeading - group.rotation.y),
          Math.cos(safeHeading - group.rotation.y),
        );
        group.rotation.y += turnDelta * Math.min(1, delta * 10);
      }

      return;
    }

    // Small villains never patrol; they remain idle until detected.
    combat.setMotion("idle");
  });

  return (
    <>
      <group ref={groupRef} position={positionRef.current} visible={alive && animationReady}>
        <group ref={reaction.group}><primitive object={scene} scale={bonusVillainVisualScale} position={[0, 0.3, 0]} /></group>
      </group>
      {showCashPopup && (
        <BillboardLabel
          color={brandYellow}
          fontSize={0.38}
          position={[cashPopupPositionRef.current.x, cashPopupPositionRef.current.y, cashPopupPositionRef.current.z]}
          maxWidth={2}
        >
          {`+$${cashReward}`}
        </BillboardLabel>
      )}
    </>
  );
}

type VillainImpact = { id: number; position: Vector3; effect: DefeatEffect };

function PowerContactEffects() {
  const [impacts, setImpacts] = useState<VillainImpact[]>([]);
  const nextId = useRef(0);
  useEffect(() => {
    const impact = (position: Vector3, effect: DefeatEffect) => {
      const id = nextId.current++;
      setImpacts(current => [...current.slice(-7), { id, position, effect }]);
    };
    powerImpactListeners.add(impact);
    return () => { powerImpactListeners.delete(impact); };
  }, []);
  return <group name="PowerContactEffects">
    {impacts.map(impact => <VillainImpactEffect key={impact.id} impact={impact}
      onComplete={() => setImpacts(current => current.filter(({ id }) => id !== impact.id))} />)}
  </group>;
}

function VillainImpactEffect({ onComplete, impact }: { onComplete: () => void; impact: VillainImpact }) {
  const { position, effect } = impact;
  const elapsedRef = useRef(0);
  const groupRef = useRef<Group>(null);
  const fireSheet = useLoader(TextureLoader, "/vfx/cluster-bomb/sprite-sheet.png");
  const bloodSheet = useLoader(TextureLoader, "/vfx/blood-splat/sprite-sheet.png");
  const stormSheet = useLoader(TextureLoader, "/vfx/lightning-strike/sprite-sheet.png");
  const fireMap = useMemo(() => {
    const map = fireSheet.clone();
    map.needsUpdate = true;
    map.repeat.set(1 / 8, 1 / 4);
    map.magFilter = 1003;
    map.minFilter = 1003;
    return map;
  }, [fireSheet]);
  const bloodMap = useMemo(() => {
    const map = bloodSheet.clone();
    map.needsUpdate = true;
    map.repeat.set(1 / 8, 1 / 2);
    map.magFilter = 1003;
    map.minFilter = 1003;
    return map;
  }, [bloodSheet]);
  const stormMap = useMemo(() => {
    const map = stormSheet.clone();
    map.needsUpdate = true;
    map.repeat.set(1 / 8, 1 / 3);
    map.magFilter = 1003;
    map.minFilter = 1003;
    return map;
  }, [stormSheet]);

  useGameFrame((_, delta) => {
    elapsedRef.current += delta;
    const progress = Math.min(elapsedRef.current / 1.15, 1);
    if (groupRef.current) {
      groupRef.current.scale.setScalar(0.92 + progress * 0.08);
      groupRef.current.traverse((object) => {
        const material = (object as Sprite | Mesh).material;
        if (!material) return;
        const materials = Array.isArray(material) ? material : [material];
        materials.forEach((item) => { if ("opacity" in item) item.opacity = Math.max(0, 0.9 * (1 - progress)); });
      });
    }
    if (effect === "fire") {
      const frame = Math.min(30, Math.floor(elapsedRef.current / 0.07));
      fireMap.offset.x = (frame % 8) / 8;
      fireMap.offset.y = 1 - (Math.floor(frame / 8) + 1) / 4;
      fireMap.needsUpdate = true;
    }
    if (effect === "blood") {
      const frame = Math.min(15, Math.floor(elapsedRef.current / 0.07));
      bloodMap.offset.x = (frame % 8) / 8;
      bloodMap.offset.y = 1 - (Math.floor(frame / 8) + 1) / 2;
      bloodMap.needsUpdate = true;
    }
    if (effect === "shock") {
      const frame = Math.min(17, Math.floor(elapsedRef.current / 0.08));
      stormMap.offset.x = (frame % 8) / 8;
      stormMap.offset.y = 1 - (Math.floor(frame / 8) + 1) / 3;
      stormMap.needsUpdate = true;
    }
    if (progress >= 1) onComplete();
  });

  const texture = getImpactParticleTexture();
  const splatter = getBloodSplatterTexture();
  if (effect === "shock") return <group ref={groupRef} position={position}>
    <sprite position={[0, -0.82, 0]} scale={1.45}><spriteMaterial map={splatter} color="#8f1724" transparent opacity={0.75} depthWrite={false} /></sprite>
    <sprite position={[0, 0.38, 0]} scale={[1.55, 1.65, 1]}><spriteMaterial map={stormMap} color="#d1a914" transparent opacity={0.9} depthWrite={false} blending={AdditiveBlending} /></sprite>
    {[
      [-0.42, 0.55, 0, 0.28], [0.35, 0.72, 0.12, 0.22], [0.02, 1.12, -0.18, 0.18],
      [-0.62, 0.18, 0.08, 0.13], [0.58, 0.3, -0.12, 0.12],
    ].map(([x, y, z, size], index) => <sprite key={index} position={[x, y, z]} scale={size}>
      <spriteMaterial map={texture} color="#d1a914" transparent opacity={0.86} depthWrite={false} blending={AdditiveBlending} />
    </sprite>)}
  </group>;
  if (effect === "fire") return <group ref={groupRef} position={position}>
    <sprite position={[0, -0.82, 0]} scale={1.45}><spriteMaterial map={splatter} color="#8f1724" transparent opacity={0.75} depthWrite={false} /></sprite>
    <sprite position={[0, 0.36, 0]} scale={[1.45, 1.8, 1]}>
      <spriteMaterial map={fireMap} color="#d34a28" transparent opacity={0.88} depthWrite={false} blending={AdditiveBlending} />
    </sprite>
    {[[-0.45, 0.82, 0.08, 0.1], [0.38, 0.95, -0.1, 0.08], [0.12, 1.15, 0.04, 0.06]].map(([x, y, z, size], index) => <sprite key={index} position={[x, y, z]} scale={size}>
      <spriteMaterial map={texture} color="#d34a28" transparent opacity={0.82} depthWrite={false} blending={AdditiveBlending} />
    </sprite>)}
  </group>;
  return (
    <group ref={groupRef} position={position}>
      <sprite position={[0, -0.72, 0]} scale={[1.3, 1.15, 1]}><spriteMaterial map={bloodMap} color="#7b1323" transparent opacity={0.88} depthWrite={false} /></sprite>
      {[
        [-0.48, 0.15, 0.04, 0.13], [-0.32, 0.42, 0.1, 0.09], [-0.12, 0.7, -0.04, 0.075],
        [0.18, 0.52, 0.14, 0.08], [0.42, 0.26, -0.08, 0.065], [0.58, 0.68, 0.04, 0.05],
      ].map(([x, y, z, size], index) => <sprite key={index} position={[x, y, z]} scale={size}><spriteMaterial map={texture} color={index % 2 ? "#a51e2d" : "#6d101d"} transparent opacity={0.8} depthWrite={false} /></sprite>)}
    </group>
  );
}

function SectionPortalEncounter({
  encounter,
  active,
  onPlayerDialogue,
  onPlayerDamage,
  onSectionResolved,
  onReward,
}: {
  encounter: SectionEncounterConfig;
  active: boolean;
  onPlayerDialogue: (text: string) => void;
  onPlayerDamage: () => void;
  onSectionResolved: (sectionId: string) => void;
  onReward: (amount: number) => void;
}) {
  const [resolved, setResolved] = useState(false);
  const voiceNearRef = useRef(false);
  useGameFrame(() => {
    if (resolved) {
      if (voiceNearRef.current) stopVillainVoice(encounter.id);
      voiceNearRef.current = false;
      return;
    }
    const distance = Math.hypot(
      playerWorldState.position.x - encounter.platformPosition.x,
      playerWorldState.position.z - encounter.platformPosition.z,
    );
    const near = distance < 24;
    if (near && !voiceNearRef.current && hasVillainVoice(encounter.id)) playVillainVoice(encounter.id);
    if (!near && voiceNearRef.current) stopVillainVoice(encounter.id);
    voiceNearRef.current = near;
  });
  const activatePad = () => {
    if (resolved || !active) return;
    setResolved(true);
    stopVillainVoice(encounter.id);
    onReward(100);
    triggerFixHaptic();
    onSectionResolved(encounter.id);
  };

  return (
    <group name={`SectionTrigger:${encounter.id}`}>
      <TriggerPad
        active={resolved}
        label={resolved ? `✓ ${encounter.name}` : encounter.name}
        position={encounter.padPosition}
        onActivate={activatePad}
      />
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
  const playerInsideRef = useRef(false);
  const [playerInside, setPlayerInside] = useState(false);
  const lastTriggeredAtRef = useRef(-Infinity);

  const isPlayerEvent = (event: IntersectionEnterPayload | IntersectionExitPayload) => {
    return isPlayerObject(event.other.rigidBodyObject) || isPlayerObject(event.other.colliderObject);
  };

  const handleEnter = (event: IntersectionEnterPayload) => {
    if (!isPlayerEvent(event) || playerInsideRef.current) return;
    playerInsideRef.current = true;
    setPlayerInside(true);

    const now = gameNow();
    if (now - lastTriggeredAtRef.current < padActivationCooldownMs) return;
    lastTriggeredAtRef.current = now;
    onActivate();
  };

  const handleExit = (event: IntersectionExitPayload) => {
    if (!isPlayerEvent(event)) return;
    playerInsideRef.current = false;
    setPlayerInside(false);
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
      {label && !playerInside && (
        <BillboardLabel
          color={brandYellow}
          outlineColor="#6b5310"
          outlineWidth={0.025}
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
