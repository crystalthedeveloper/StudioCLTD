import { triggerPopupLayout } from "../triggerPopupLayout";
import { GroundedPickupVisual, usePickupSurfaces, type PickupSurface } from "../pickupSurface";
import { routePickupPositions, groundSize, groundCenter, isInsideTriggerExclusion } from "../worldLayout";
import { isCompactVisualBudget } from "../visualQuality";
import { assetForDevice } from "../mobileAssets";
import { useGameFrame } from "../../player/useGameFrame";
import { gameNow } from "../../player/gameFocus";
import { gameTimers } from "../../player/gameFocus";
import { useGLTF, useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import {
  BallCollider,
  IntersectionEnterPayload,
  IntersectionExitPayload,
  RapierCollider,
  RigidBody,
} from "@react-three/rapier";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Box3, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, PointLight, SRGBColorSpace, Vector3 } from "three";
import { SkeletonUtils } from "three-stdlib";
import { playCollectibleSound } from "../../audio/collectibleSounds";
import { BillboardLabel } from "../../ui/BillboardLabel";
import { destinationPlatformRadius, hubSections, sectionRampApproachLength, sectionRampWidth } from "../hubSections";
import { roadHomeBaseTransportPadPosition } from "./TransportPads";
import { homeBaseCenter } from "./HomeBase";
import { clampRoadX, roadPoint, roadSurfaceY, roadTangent } from "../roadSurface";
import { brandYellow } from "../../player/effectColors";

const logoPath = "/logo/logo-optimized.glb";
const goldPath = "/pickup/gold.glb";
const logoScale = 1.8;
const floorLogoY = 0.04;
const worldLogoRotation = -0.35;
const decorativeLogoScale = 0.72;
// Keep decorative logos outside the driving line and alternate sides with
// enough longitudinal separation to read as painted road marks, not a cluster.
const pickupColliderRadius = 1.55;
const collectibleRespawnMs = 28000;
const healthGroupRespawnMs = 36000;
const contactCountdownMs = 3000;
const contactCooldownMs = 1200;
const contactUrl = "https://www.crystalthedeveloper.ca/contact";
const platformClearance = 2.4;
const bridgeClearance = 2.5;
const transportPadClearance = 3.8;
const collectibleSpacing = 5;
const placementSearchStep = 1.25;
const placementSearchDirections = 32;

type LogoKind = "coin" | "penalty" | "contact" | "share" | "dark";

type PlazaLogo = {
  height?: number;
  id: string;
  kind: LogoKind;
  position: readonly [number, number];
  rotationOffset?: number;
  scaleMultiplier?: number;
};

const homeBaseLogos: PlazaLogo[] = [
  { id: "home-contact", kind: "contact", position: [homeBaseCenter[0] - 9.5, homeBaseCenter[2] - 2], height: homeBaseCenter[1] + 0.04, rotationOffset: 0.08, scaleMultiplier: 0.9 },
  { id: "home-share", kind: "share", position: [homeBaseCenter[0] + 9.5, homeBaseCenter[2] - 2], height: homeBaseCenter[1] + 0.04, rotationOffset: -0.08, scaleMultiplier: 0.9 },
  { id: "home-coin-1", kind: "coin", position: [homeBaseCenter[0] - 10, homeBaseCenter[2] + 9], height: homeBaseCenter[1] + 0.04, rotationOffset: -0.12 },
  { id: "home-coin-2", kind: "coin", position: [homeBaseCenter[0], homeBaseCenter[2] - 1], height: homeBaseCenter[1] + 0.04, rotationOffset: 0.08 },
  { id: "home-coin-3", kind: "coin", position: [homeBaseCenter[0] + 10, homeBaseCenter[2] - 9], height: homeBaseCenter[1] + 0.04, rotationOffset: 0.14 },
];

const plazaLogos: PlazaLogo[] = [
  { id: "coin-1", kind: "coin", position: [-18, -14] },
  { id: "coin-2", kind: "coin", position: [-31, 18] },
  { id: "coin-3", kind: "coin", position: [7, 34] },
  { id: "coin-4", kind: "coin", position: [43, -41] },
  { id: "coin-5", kind: "coin", position: [55, 31] },
  { id: "coin-6", kind: "coin", position: [-9, -38] },
  { id: "coin-7", kind: "coin", position: [31, 42] },
  { id: "coin-8", kind: "coin", position: [-49, 37] },
  { id: "penalty-1", kind: "penalty", position: [42, -15] },
  { id: "penalty-2", kind: "penalty", position: [-39, -20] },
  { id: "penalty-3", kind: "penalty", position: [48, 4] },
  { id: "dark-1", kind: "dark", position: [-34, 30], rotationOffset: -0.1 },
  { id: "dark-2", kind: "dark", position: [36, -28], rotationOffset: 0.12 },
  { id: "dark-3", kind: "dark", position: [10, 52], rotationOffset: -0.05 },
  { id: "coin-center-1", kind: "coin", position: [-12, 5], rotationOffset: -0.14, scaleMultiplier: 0.94 },
  { id: "coin-center-2", kind: "coin", position: [14, 9], rotationOffset: 0.1, scaleMultiplier: 1.08 },
  { id: "coin-center-3", kind: "coin", position: [-8, -13], rotationOffset: -0.08, scaleMultiplier: 1.02 },
  { id: "coin-center-4", kind: "coin", position: [18, -6], rotationOffset: 0.16, scaleMultiplier: 0.91 },
  { id: "coin-center-5", kind: "coin", position: [-21, 5], rotationOffset: 0.06, scaleMultiplier: 1.06 },
  { id: "coin-center-6", kind: "coin", position: [7, -25], rotationOffset: -0.17, scaleMultiplier: 0.97 },
  { id: "coin-center-7", kind: "coin", position: [23, 13], rotationOffset: 0.13, scaleMultiplier: 1.1 },
  { id: "penalty-center-1", kind: "penalty", position: [-25, -8], rotationOffset: -0.15, scaleMultiplier: 1.04 },
];

function distanceToSegment(
  x: number,
  z: number,
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
) {
  const segmentX = endX - startX;
  const segmentZ = endZ - startZ;
  const segmentLengthSq = segmentX * segmentX + segmentZ * segmentZ;
  const projection = segmentLengthSq === 0
    ? 0
    : Math.max(0, Math.min(1, ((x - startX) * segmentX + (z - startZ) * segmentZ) / segmentLengthSq));
  return Math.hypot(x - (startX + segmentX * projection), z - (startZ + segmentZ * projection));
}

function isOpenCollectiblePosition(position: readonly [number, number], placed: readonly PlazaLogo[]) {
  const [x, z] = position;
  if (isInsideTriggerExclusion(x, z, pickupColliderRadius)) return false;
  if (Math.abs(x - groundCenter[0]) > groundSize[0] / 2 - 6 || Math.abs(z - groundCenter[1]) > groundSize[1] / 2 - 6) return false;

  for (const section of hubSections) {
    const [sectionX, , sectionZ] = section.position;
    if (
      Math.abs(x - sectionX) < destinationPlatformRadius + platformClearance &&
      Math.abs(z - sectionZ) < destinationPlatformRadius + platformClearance
    ) return false;

    const [directionX, directionZ] = section.entrance;
    const rampOuterOffset = destinationPlatformRadius + sectionRampApproachLength;
    const bridgeDistance = distanceToSegment(
      x,
      z,
      sectionX + directionX * destinationPlatformRadius,
      sectionZ + directionZ * destinationPlatformRadius,
      sectionX + directionX * rampOuterOffset,
      sectionZ + directionZ * rampOuterOffset,
    );
    if (bridgeDistance < sectionRampWidth / 2 + bridgeClearance) return false;
  }

  if (Math.hypot(x - roadHomeBaseTransportPadPosition[0], z - roadHomeBaseTransportPadPosition[2]) < transportPadClearance) {
    return false;
  }

  return placed.every((logo) => Math.hypot(x - logo.position[0], z - logo.position[1]) >= collectibleSpacing);
}

function findNearestOpenPosition(position: readonly [number, number], placed: readonly PlazaLogo[]) {
  if (isOpenCollectiblePosition(position, placed)) return position;

  for (let radius = placementSearchStep; radius <= 36; radius += placementSearchStep) {
    for (let index = 0; index < placementSearchDirections; index += 1) {
      const angle = (index / placementSearchDirections) * Math.PI * 2;
      const candidate = [
        position[0] + Math.cos(angle) * radius,
        position[1] + Math.sin(angle) * radius,
      ] as const;
      if (isOpenCollectiblePosition(candidate, placed)) return candidate;
    }
  }

  throw new Error(`No accessible collectible position found near ${position[0]}, ${position[1]}`);
}

function resolveLogoPlacements(logos: readonly PlazaLogo[]) {
  return logos.reduce<PlazaLogo[]>((placed, logo) => {
    placed.push({ ...logo, position: findNearestOpenPosition(logo.position, placed) });
    return placed;
  }, []);
}

const accessiblePlazaLogos = resolveLogoPlacements(plazaLogos.map((logo, index) => ({
  ...logo,
  position: [clampRoadX((index % 5 - 2) * 2.8, -18 - index * 7), -18 - index * 7] as [number, number],
  height: roadSurfaceY + 0.04,
})));

const logoColors: Record<LogoKind, string> = {
  coin: brandYellow,
  penalty: "#991b1b",
  contact: "#2583e8",
  share: "#a855f7",
  dark: "#000",
};

function createSharedMaterial(kind: LogoKind) {
  const color = new Color(logoColors[kind]);
  return new MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: kind === "coin" ? 0.55 : kind === "contact" || kind === "share" ? 0.65 : kind === "dark" ? 0.08 : 0.55,
    metalness: 0.04,
    roughness: 0.72,
    toneMapped: false,
  });
}

function createLogoTemplate(source: Group, material: MeshStandardMaterial) {
  const logo = source.clone(true);

  logo.traverse((object: Object3D) => {
    if (!(object instanceof Mesh)) return;

    object.material = Array.isArray(object.material) ? object.material.map(() => material) : material;
    object.castShadow = false;
    object.receiveShadow = false;
  });

  return logo;
}

type LogoLightFieldProps = {
  onCoinCollect: () => void;
  onHealthCollect: () => boolean;
  onReset: () => void;
  onOpenShare: () => void;
  restartKey: number;
};

export function LogoLightField({ onCoinCollect, onHealthCollect, onOpenShare, onReset, restartKey }: LogoLightFieldProps) {
  const { scene } = useGLTF(assetForDevice(logoPath));
  const { scene: goldScene } = useGLTF(goldPath);
  const pickupTextures = useTexture(["/images/pickups/dollar.svg", "/images/pickups/heart.svg"]);
  const pickupVisuals = useMemo(() => pickupTextures.map((texture) => {
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;
    const geometry = new PlaneGeometry(0.675, 0.675);
    const material = new MeshBasicMaterial({ map: texture, transparent: true,
      alphaTest: 0.005, depthWrite: false, side: DoubleSide, toneMapped: false });
    const template = new Group();
    const mesh = new Mesh(geometry, material);
    mesh.raycast = () => {};
    template.add(mesh);
    return { geometry, material, template };
  }), [pickupTextures]);
  useEffect(() => () => pickupVisuals.forEach(({ geometry, material }) => {
    geometry.dispose();
    material.dispose();
  }), [pickupVisuals]);
  const collectedHealthLogoIdsRef = useRef(new Set<string>());
  const healthRespawnTimerRef = useRef<number | null>(null);
  const [healthRespawnGeneration, setHealthRespawnGeneration] = useState(0);
  const materials = useMemo(
    () => ({
      penalty: createSharedMaterial("penalty"),
      contact: createSharedMaterial("contact"),
      share: createSharedMaterial("share"),
    }),
    [],
  );
  const templates = useMemo(
    () => ({
      coin: pickupVisuals[0].template,
      penalty: createLogoTemplate(scene, materials.penalty),
      contact: createLogoTemplate(scene, materials.contact),
      share: createLogoTemplate(scene, materials.share),
      dark: pickupVisuals[1].template,
    }),
    [materials, scene, pickupVisuals],
  );

  const logos = useMemo(
    () => {
      let roadCoinIndex = 0;
      let roadHealthIndex = 0;
      const healthSectionIndexes = [1, 3, 5] as const;
      const roadMoney = accessiblePlazaLogos.map((logo, index) => {
        const sectionIndex = logo.kind === "dark"
          ? healthSectionIndexes[roadHealthIndex++ % healthSectionIndexes.length]
          : Math.min(hubSections.length - 1, Math.floor(index / 3));
        const section = hubSections[sectionIndex];
        const lane = index % 3;
        const z = section.position[2] - 10 - (logo.kind === "dark" ? 4 : lane * 10);
        // Keep gold pickups out of the centre driving line. Alternate the
        // outer lanes so they remain collectible without forcing a collision
        // course through the player/villain path.
        const lateral = logo.kind === "dark"
          ? (roadHealthIndex % 2 === 0 ? -4.8 : 4.8)
          : logo.kind === "coin"
          ? (roadCoinIndex++ % 2 === 0 ? -5.2 : 5.2)
          : (lane - 1) * 4.2;
        const point = roadPoint(lateral, z, 0.04);
        return { ...logo, position: [point[0], z] as [number, number], height: point[1] };
      });
      let decorativeIndex = 0;
      const restartRelocated = [...roadMoney, ...homeBaseLogos].map((logo, index) => {
        if (logo.kind !== "penalty") return logo;
        // Keep red road logos in the safe road zone, but give them a
        // fresh deterministic spot each full restart instead of reusing the
        // same old-world coordinates.
        let seed = (restartKey + 1) * 1103515245 + (index + 17) * 12345;
        const next = () => {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          return seed / 4294967296;
        };
        const lateral = decorativeIndex % 2 === 0 ? -5.5 : 5.5;
        // Give red penalty logos a small forward nudge so they do not sit
        // directly in the previous road mark's visual band.
        const forwardOffset = logo.kind === "penalty" ? -12 : (next() - 0.5) * 4;
        const z = logo.position[1] + forwardOffset;
        const point = roadPoint(lateral, z, 0.04);
        const tangent = roadTangent(z);
        const tangentRotation = Math.atan2(tangent[0], tangent[1]) + Math.PI;
        const sizeVariation = 0.92 + next() * 0.12;
        const wearRotation = (next() - 0.5) * 0.12;
        decorativeIndex += 1;
        return {
          ...logo,
          position: [point[0], z] as [number, number],
          height: point[1],
          rotationOffset: tangentRotation + wearRotation,
          scaleMultiplier: (logo.scaleMultiplier ?? 1) * decorativeLogoScale * sizeVariation,
        };
      });
      return restartRelocated.map((logo) => ({
        ...logo,
        object: templates[logo.kind].clone(true),
      }));
    },
    [restartKey, templates],
  );
  const surfaceLocations = useMemo(() => logos.map(logo =>
    [logo.position[0], (logo.height ?? floorLogoY) - floorLogoY, logo.position[1]] as const), [logos]);
  const surfaces = usePickupSurfaces(surfaceLocations);
  const healthLogoCount = useMemo(() => logos.filter((logo) => logo.kind === "dark").length, [logos]);

  const handleHealthLogoCollected = useCallback((logoId: string) => {
    collectedHealthLogoIdsRef.current.add(logoId);
    if (collectedHealthLogoIdsRef.current.size < healthLogoCount || healthRespawnTimerRef.current !== null) return;

    healthRespawnTimerRef.current = gameTimers.setTimeout(() => {
      healthRespawnTimerRef.current = null;
      collectedHealthLogoIdsRef.current.clear();
      setHealthRespawnGeneration((current) => current + 1);
    }, healthGroupRespawnMs);
  }, [healthLogoCount]);

  useEffect(() => {
    if (healthRespawnTimerRef.current !== null) {
      gameTimers.clearTimeout(healthRespawnTimerRef.current);
      healthRespawnTimerRef.current = null;
    }
    collectedHealthLogoIdsRef.current.clear();

    return () => {
      if (healthRespawnTimerRef.current !== null) gameTimers.clearTimeout(healthRespawnTimerRef.current);
    };
  }, [restartKey]);

  useEffect(() => () => Object.values(materials).forEach((material) => material.dispose()), [materials]);

  return (
    <group name="PlazaLogoSystem">
      {logos.map((logo, index) => (
        <PlazaLogoInstance
          key={logo.id}
          healthRespawnGeneration={healthRespawnGeneration}
          logo={logo}
          goldScene={goldScene}
          surface={surfaces[index]}
          onCoinCollect={onCoinCollect}
          onHealthCollect={onHealthCollect}
          onHealthLogoCollected={handleHealthLogoCollected}
          onOpenShare={onOpenShare}
          onReset={onReset}
          restartKey={restartKey}
        />
      ))}
    </group>
  );
}

type PlazaLogoInstanceProps = {
  surface: PickupSurface;
  healthRespawnGeneration: number;
  logo: PlazaLogo & { object: Object3D };
  goldScene: Group;
  onCoinCollect: () => void;
  onHealthCollect: () => boolean;
  onHealthLogoCollected: (logoId: string) => void;
  onReset: () => void;
  onOpenShare: () => void;
  restartKey: number;
};

function PlazaLogoInstance({ healthRespawnGeneration, logo, goldScene, surface, onCoinCollect, onHealthCollect, onHealthLogoCollected, onOpenShare, onReset, restartKey }: PlazaLogoInstanceProps) {
  const [available, setAvailable] = useState(true);
  const redLogoLift = useMemo(() => {
    if (logo.kind !== "penalty") return 0;
    const bounds = new Box3().setFromObject(logo.object);
    const modelScale = logoScale * (logo.scaleMultiplier ?? 1);
    // Correct from the actual cloned mesh pivot, then add a deliberate gap.
    // This keeps the entire red model above the road even if its GLB origin
    // is below the visible geometry.
    // Keep the logo low enough for the car to hit while preserving a visible
    // gap below its lowest mesh point.
    return Math.max(0.35, -bounds.min.y + 0.18 / modelScale);
  }, [logo.kind, logo.object, logo.scaleMultiplier]);
  const redLogoColliderY = useMemo(() => {
    if (logo.kind !== "penalty") return 0.65;
    const bounds = new Box3().setFromObject(logo.object);
    const modelScale = logoScale * (logo.scaleMultiplier ?? 1);
    const centerY = bounds.getCenter(new Vector3()).y;
    return redLogoLift + centerY * modelScale;
  }, [logo.kind, logo.object, logo.scaleMultiplier, redLogoLift]);
  const availableRef = useRef(true);
  const collectedRef = useRef(false);
  const colliderRef = useRef<RapierCollider>(null);
  const respawnTimerRef = useRef<number | null>(null);
  const contactIntervalRef = useRef<number | null>(null);
  const contactOpenTimerRef = useRef<number | null>(null);
  const contactActiveRef = useRef(false);
  const contactOpenedRef = useRef(false);
  const contactCooldownUntilRef = useRef(0);
  const [contactCountdown, setContactCountdown] = useState(0);
  const [playerStanding, setPlayerStanding] = useState(false);

  const clearContactTimers = useCallback(() => {
    if (contactIntervalRef.current !== null) gameTimers.clearInterval(contactIntervalRef.current);
    if (contactOpenTimerRef.current !== null) gameTimers.clearTimeout(contactOpenTimerRef.current);
    contactIntervalRef.current = null;
    contactOpenTimerRef.current = null;
  }, []);

  const cancelContactCountdown = useCallback(() => {
    if (!contactActiveRef.current || contactOpenedRef.current) return;
    clearContactTimers();
    contactActiveRef.current = false;
    setContactCountdown(0);
  }, [clearContactTimers]);

  const startActionCountdown = useCallback(() => {
    const now = gameNow();
    if (contactActiveRef.current || now < contactCooldownUntilRef.current) return;

    clearContactTimers();
    contactActiveRef.current = true;
    contactOpenedRef.current = false;
    contactCooldownUntilRef.current = now + contactCooldownMs;
    playCollectibleSound("contact");
    setContactCountdown(3);
    const startedAt = gameNow();

    contactIntervalRef.current = gameTimers.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((contactCountdownMs - (gameNow() - startedAt)) / 1000));
      setContactCountdown(remaining);
    }, 180);

    contactOpenTimerRef.current = gameTimers.setTimeout(() => {
      if (!contactActiveRef.current || contactOpenedRef.current) return;
      contactOpenedRef.current = true;
      contactActiveRef.current = false;
      contactCooldownUntilRef.current = gameNow() + contactCooldownMs;
      clearContactTimers();
      setContactCountdown(0);
      if (logo.kind === "share") {
        onOpenShare();
      } else {
        window.open(contactUrl, "_blank", "noopener,noreferrer");
      }
    }, contactCountdownMs);
  }, [clearContactTimers, logo.kind, onOpenShare]);

  useEffect(() => {
    if (respawnTimerRef.current !== null) {
      gameTimers.clearTimeout(respawnTimerRef.current);
      respawnTimerRef.current = null;
    }
    clearContactTimers();
    contactActiveRef.current = false;
    contactOpenedRef.current = false;
    contactCooldownUntilRef.current = 0;
    setContactCountdown(0);
    setPlayerStanding(false);
    availableRef.current = true;
    collectedRef.current = false;
    logo.object.visible = true;
    setAvailable(true);

    return () => {
      if (respawnTimerRef.current !== null) {
        gameTimers.clearTimeout(respawnTimerRef.current);
        respawnTimerRef.current = null;
      }
      clearContactTimers();
    };
  }, [clearContactTimers, healthRespawnGeneration, logo.object, restartKey]);

  const collectAndRespawn = useCallback(
    (reward: () => void) => {
      collectedRef.current = true;
      availableRef.current = false;
      colliderRef.current?.setEnabled(false);
      logo.object.visible = false;
      setAvailable(false);
      reward();

      respawnTimerRef.current = gameTimers.setTimeout(() => {
        respawnTimerRef.current = null;
        collectedRef.current = false;
        availableRef.current = true;
        logo.object.visible = true;
        setAvailable(true);
      }, collectibleRespawnMs);
    },
    [logo.object],
  );

  const collect = useCallback(
    ({ other }: IntersectionEnterPayload) => {
      if (
        !availableRef.current ||
        collectedRef.current ||
        other.rigidBodyObject?.name !== "StudioCLTDPlayer"
      ) return;

      if (logo.kind === "coin") {
        collectAndRespawn(() => {
          playCollectibleSound("coin");
          onCoinCollect();
        });
        return;
      }

      if (logo.kind === "penalty") {
        collectAndRespawn(() => {
          playCollectibleSound("penalty");
          onReset();
        });
        return;
      }

      if (logo.kind === "dark") {
        if (!onHealthCollect()) return;
        collectedRef.current = true;
        availableRef.current = false;
        colliderRef.current?.setEnabled(false);
        logo.object.visible = false;
        setAvailable(false);
        playCollectibleSound("health");
        onHealthLogoCollected(logo.id);
        return;
      }

      if (logo.kind === "contact" || logo.kind === "share") {
        setPlayerStanding(true);
        startActionCountdown();
      }
    },
    [collectAndRespawn, logo.id, logo.kind, logo.object, onCoinCollect, onHealthCollect, onHealthLogoCollected, onReset, startActionCountdown],
  );

  const handleExit = useCallback(
    ({ other }: IntersectionExitPayload) => {
      if ((logo.kind !== "contact" && logo.kind !== "share") || other.rigidBodyObject?.name !== "StudioCLTDPlayer") return;
      setPlayerStanding(false);
      cancelContactCountdown();
    },
    [cancelContactCountdown, logo.kind],
  );

  if (!available) return null;

  const position: [number, number, number] = [logo.position[0], surface.y, logo.position[1]];
  const standardVisual = (
    <>
      <group
        // Lift the wrapper rather than relying on the GLB root pivot. This
        // keeps the actual red mesh elevated even when the asset has its own
        // transform or a child animation changes the model root.
        position={[0, redLogoLift, 0]}
        rotation={[0, logo.rotationOffset ?? worldLogoRotation, 0]}
        scale={logoScale * (logo.scaleMultiplier ?? 1)}
      >
        <primitive object={logo.object} dispose={null} />
      </group>
    </>
  );
  const visual = (
    <>
      {logo.kind === "coin" ? (
        <GoldBarVisual source={goldScene} scale={logo.scaleMultiplier ?? 1} />
      ) : logo.kind === "dark" ? (
        <PickupIconVisual object={logo.object}
          scale={logo.scaleMultiplier ?? 1} />
      ) : logo.kind === "contact" || logo.kind === "share" ? (
        <ContactLogoVisual
          glow={logo.kind === "share"}
          object={logo.object}
          rotation={worldLogoRotation + (logo.rotationOffset ?? 0)}
          scale={logoScale * (logo.scaleMultiplier ?? 1)}
        />
      ) : standardVisual}
    </>
  );

  return (
    <RigidBody type="fixed" colliders={false} position={position} name={`PlazaLogo:${logo.id}`}>
      <BallCollider
        ref={colliderRef}
        // Coins use a tighter sensor so the car cannot visually catch its
        // edge and appear to jump while collecting it.
        args={[logo.kind === "coin" ? 0.95 : logo.kind === "penalty" ? 0.72 : pickupColliderRadius]}
        position={[0, logo.kind === "penalty" ? redLogoColliderY : 0.65, 0]}
        sensor
        friction={0}
        restitution={0}
        onIntersectionEnter={collect}
        onIntersectionExit={handleExit}
      />
      {logo.kind === "penalty" ? visual : (
        <GroundedPickupVisual surface={surface}>{visual}</GroundedPickupVisual>
      )}
      {(logo.kind === "contact" || logo.kind === "share") && !playerStanding && (
        <BillboardLabel color={logoColors[logo.kind]} fontSize={0.25} position={[0, triggerPopupLayout.labelHeight + 0.42, 0]} maxWidth={4}>
          {logo.kind === "contact" ? "CONTACT" : "SHARE"}
        </BillboardLabel>
      )}
      {contactCountdown > 0 && (
        <BillboardLabel color="#ffffff" fontSize={0.25} position={[0, triggerPopupLayout.labelHeight + 0.42, 0]} maxWidth={4}>
          {`Opening ${logo.kind === "share" ? "Share" : "Contact"} in ${contactCountdown}…`}
        </BillboardLabel>
      )}
    </RigidBody>
  );
}

function GoldBarVisual({ source, scale }: { source: Group; scale: number }) {
  const model = useMemo(() => SkeletonUtils.clone(source), [source]);
  const fit = useMemo(() => {
    const bounds = new Box3().setFromObject(model);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    const normalizedScale = 0.92 / Math.max(size.x, size.y, size.z, 0.001);
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      // Gold is a small collectible; its shadow was a disproportionate cost
      // when several pooled pickups were visible at once.
      object.castShadow = false;
      object.receiveShadow = false;
      object.frustumCulled = true;
    });
    return { normalizedScale, position: [-center.x * normalizedScale, -bounds.min.y * normalizedScale, -center.z * normalizedScale] as [number, number, number] };
  }, [model]);
  return <group name="GoldGLB" scale={scale * 0.576}>
    <primitive object={model} position={fit.position} scale={fit.normalizedScale} dispose={null} />
  </group>;
}

/** Cash and health stay upright; the parent rests their lower edge on the surface. */
function PickupIconVisual({ object, scale }: { object: Object3D; scale: number }) {
  const group = useRef<Group>(null);
  const camera = useThree((state) => state.camera);
  const update = () => {
    if (!group.current) return;
    group.current.position.y = 0;
    group.current.quaternion.copy(camera.quaternion);
    // Keep the dollar upright and fully camera-facing from every viewing angle.
  };
  useLayoutEffect(update, [camera]);
  useGameFrame(update);
  return <group ref={group} name="PickupIcon" scale={scale}>
    <primitive object={object} dispose={null} />
  </group>;
}

function ContactLogoVisual({ glow = false, object, rotation, scale }: { glow?: boolean; object: Object3D; rotation: number; scale: number }) {
  const groupRef = useRef<Group>(null);
  const glowRef = useRef<PointLight>(null);
  const lastUpdateRef = useRef(-Infinity);
  const logoWorldPosition = useMemo(() => new Vector3(), []);
  const playerWorldPosition = useMemo(() => new Vector3(), []);

  useGameFrame(({ clock, scene }) => {
    if (!groupRef.current || clock.elapsedTime - lastUpdateRef.current < 1 / 24) return;
    lastUpdateRef.current = clock.elapsedTime;
    groupRef.current.position.y = 0;
    groupRef.current.rotation.y = rotation + clock.elapsedTime * 0.22;
    if (glowRef.current) {
      const player = scene.getObjectByName("StudioCLTDPlayer");
      const distance = player
        ? player.getWorldPosition(playerWorldPosition).distanceTo(groupRef.current.getWorldPosition(logoWorldPosition))
        : 20;
      glowRef.current.intensity = Math.max(0, Math.min(1, (12 - distance) / 8)) * 2.2;
    }
  });

  return (
    <group ref={groupRef} rotation-y={rotation}>
      <primitive object={object} scale={scale} dispose={null} />
      {glow && <pointLight ref={glowRef} color="#a855f7" distance={9} decay={2} intensity={0} position={[0, 0.65, 0]} />}
    </group>
  );
}

useGLTF.preload(assetForDevice(logoPath));
useGLTF.preload(goldPath);
