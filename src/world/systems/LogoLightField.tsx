import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  BallCollider,
  IntersectionEnterPayload,
  IntersectionExitPayload,
  RapierCollider,
  RigidBody,
} from "@react-three/rapier";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Color, Group, Mesh, MeshStandardMaterial, Object3D, PointLight, Vector3 } from "three";
import { activateSpeedBoost } from "../../player/speedBoost";
import { playCollectibleSound } from "../../audio/collectibleSounds";
import { BillboardLabel } from "../../ui/BillboardLabel";
import { destinationPlatformRadius, hubSections, sectionRampApproachLength, sectionRampWidth } from "../hubSections";
import { homeBaseTransportPadPosition, transportPadPositions } from "./TransportPads";
import { homeBaseCenter } from "./HomeBase";

const logoPath = "/logo/logo-optimized.glb";
const logoScale = 1.8;
const floorLogoY = 0.04;
const worldLogoRotation = -0.35;
const pickupColliderRadius = 1.55;
const speedRespawnMs = 28000;
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
const placementWorldLimit = 68;

type LogoKind = "coin" | "speed" | "penalty" | "contact" | "share" | "light" | "dark";

type PlazaLogo = {
  height?: number;
  id: string;
  kind: LogoKind;
  position: readonly [number, number];
  rotationOffset?: number;
  scaleMultiplier?: number;
};

const homeBaseLogos: PlazaLogo[] = [
  { id: "home-contact", kind: "contact", position: [homeBaseCenter[0] - 8, homeBaseCenter[2] - 2], height: homeBaseCenter[1] + 0.04, rotationOffset: 0.08, scaleMultiplier: 0.9 },
  { id: "home-share", kind: "share", position: [homeBaseCenter[0] + 8, homeBaseCenter[2] - 2], height: homeBaseCenter[1] + 0.04, rotationOffset: -0.08, scaleMultiplier: 0.9 },
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
  { id: "speed-1", kind: "speed", position: [0, -18] },
  { id: "speed-2", kind: "speed", position: [-24, 10] },
  { id: "speed-3", kind: "speed", position: [24, 22] },
  { id: "penalty-1", kind: "penalty", position: [42, -15] },
  { id: "penalty-2", kind: "penalty", position: [-39, -20] },
  { id: "penalty-3", kind: "penalty", position: [48, 4] },
  { id: "light-1", kind: "light", position: [16, -23] },
  { id: "light-2", kind: "light", position: [34, 12] },
  { id: "light-3", kind: "light", position: [-42, -32] },
  { id: "light-4", kind: "light", position: [-8, 48] },
  { id: "light-5", kind: "light", position: [-58, 6] },
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
  { id: "speed-center-1", kind: "speed", position: [-15, 25], rotationOffset: -0.11, scaleMultiplier: 1.05 },
  { id: "speed-center-2", kind: "speed", position: [26, -10], rotationOffset: 0.09, scaleMultiplier: 0.93 },
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
  if (Math.hypot(x, z) > placementWorldLimit) return false;

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

  if (transportPadPositions.some(([padX, padZ]) => Math.hypot(x - padX, z - padZ) < transportPadClearance)) {
    return false;
  }

  if (Math.hypot(x - homeBaseTransportPadPosition[0], z - homeBaseTransportPadPosition[1]) < transportPadClearance) {
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

const accessiblePlazaLogos = resolveLogoPlacements(plazaLogos);

const logoColors: Record<LogoKind, string> = {
  coin: "#3f7d3a",
  speed: "#facc15",
  penalty: "#991b1b",
  contact: "#2583e8",
  share: "#a855f7",
  light: "#ffffff",
  dark: "#000",
};

function createSharedMaterial(kind: LogoKind) {
  const color = new Color(logoColors[kind]);
  return new MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: kind === "light" ? 0.12 : kind === "coin" ? 0.55 : kind === "contact" || kind === "share" ? 0.65 : kind === "dark" ? 0.08 : kind === "speed" ? 0.7 : 0.55,
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
  const { scene } = useGLTF(logoPath);
  const collectedHealthLogoIdsRef = useRef(new Set<string>());
  const healthRespawnTimerRef = useRef<number | null>(null);
  const [healthRespawnGeneration, setHealthRespawnGeneration] = useState(0);
  const materials = useMemo(
    () => ({
      coin: createSharedMaterial("coin"),
      speed: createSharedMaterial("speed"),
      penalty: createSharedMaterial("penalty"),
      contact: createSharedMaterial("contact"),
      share: createSharedMaterial("share"),
      light: createSharedMaterial("light"),
      dark: createSharedMaterial("dark"),
    }),
    [],
  );
  const templates = useMemo(
    () => ({
      coin: createLogoTemplate(scene, materials.coin),
      speed: createLogoTemplate(scene, materials.speed),
      penalty: createLogoTemplate(scene, materials.penalty),
      contact: createLogoTemplate(scene, materials.contact),
      share: createLogoTemplate(scene, materials.share),
      light: createLogoTemplate(scene, materials.light),
      dark: createLogoTemplate(scene, materials.dark),
    }),
    [materials, scene],
  );

  const logos = useMemo(
    () =>
      [...accessiblePlazaLogos, ...homeBaseLogos].map((logo) => ({
        ...logo,
        object: templates[logo.kind].clone(true),
      })),
    [templates],
  );
  const healthLogoCount = useMemo(() => logos.filter((logo) => logo.kind === "dark").length, [logos]);

  const handleHealthLogoCollected = useCallback((logoId: string) => {
    collectedHealthLogoIdsRef.current.add(logoId);
    if (collectedHealthLogoIdsRef.current.size < healthLogoCount || healthRespawnTimerRef.current !== null) return;

    healthRespawnTimerRef.current = window.setTimeout(() => {
      healthRespawnTimerRef.current = null;
      collectedHealthLogoIdsRef.current.clear();
      setHealthRespawnGeneration((current) => current + 1);
    }, healthGroupRespawnMs);
  }, [healthLogoCount]);

  useEffect(() => {
    if (healthRespawnTimerRef.current !== null) {
      window.clearTimeout(healthRespawnTimerRef.current);
      healthRespawnTimerRef.current = null;
    }
    collectedHealthLogoIdsRef.current.clear();

    return () => {
      if (healthRespawnTimerRef.current !== null) window.clearTimeout(healthRespawnTimerRef.current);
    };
  }, [restartKey]);

  useEffect(() => () => Object.values(materials).forEach((material) => material.dispose()), [materials]);

  return (
    <group name="PlazaLogoSystem">
      {logos.map((logo) => (
        <PlazaLogoInstance
          key={logo.id}
          healthRespawnGeneration={healthRespawnGeneration}
          logo={logo}
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
  healthRespawnGeneration: number;
  logo: PlazaLogo & { object: Object3D };
  onCoinCollect: () => void;
  onHealthCollect: () => boolean;
  onHealthLogoCollected: (logoId: string) => void;
  onReset: () => void;
  onOpenShare: () => void;
  restartKey: number;
};

function PlazaLogoInstance({ healthRespawnGeneration, logo, onCoinCollect, onHealthCollect, onHealthLogoCollected, onOpenShare, onReset, restartKey }: PlazaLogoInstanceProps) {
  const [available, setAvailable] = useState(true);
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

  const clearContactTimers = useCallback(() => {
    if (contactIntervalRef.current !== null) window.clearInterval(contactIntervalRef.current);
    if (contactOpenTimerRef.current !== null) window.clearTimeout(contactOpenTimerRef.current);
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
    const now = performance.now();
    if (contactActiveRef.current || now < contactCooldownUntilRef.current) return;

    clearContactTimers();
    contactActiveRef.current = true;
    contactOpenedRef.current = false;
    contactCooldownUntilRef.current = now + contactCooldownMs;
    playCollectibleSound("contact");
    setContactCountdown(3);
    const startedAt = performance.now();

    contactIntervalRef.current = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((contactCountdownMs - (performance.now() - startedAt)) / 1000));
      setContactCountdown(remaining);
    }, 180);

    contactOpenTimerRef.current = window.setTimeout(() => {
      if (!contactActiveRef.current || contactOpenedRef.current) return;
      contactOpenedRef.current = true;
      contactActiveRef.current = false;
      contactCooldownUntilRef.current = performance.now() + contactCooldownMs;
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
      window.clearTimeout(respawnTimerRef.current);
      respawnTimerRef.current = null;
    }
    clearContactTimers();
    contactActiveRef.current = false;
    contactOpenedRef.current = false;
    contactCooldownUntilRef.current = 0;
    setContactCountdown(0);
    availableRef.current = true;
    collectedRef.current = false;
    logo.object.visible = true;
    setAvailable(true);

    return () => {
      if (respawnTimerRef.current !== null) {
        window.clearTimeout(respawnTimerRef.current);
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

      respawnTimerRef.current = window.setTimeout(() => {
        respawnTimerRef.current = null;
        collectedRef.current = false;
        availableRef.current = true;
        logo.object.visible = true;
        setAvailable(true);
      }, speedRespawnMs);
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

      if (logo.kind === "speed") {
        collectAndRespawn(() => {
          playCollectibleSound("speed");
          activateSpeedBoost();
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

      if (logo.kind === "contact" || logo.kind === "share") startActionCountdown();
    },
    [collectAndRespawn, logo.id, logo.kind, logo.object, onCoinCollect, onHealthCollect, onHealthLogoCollected, onReset, startActionCountdown],
  );

  const handleExit = useCallback(
    ({ other }: IntersectionExitPayload) => {
      if ((logo.kind !== "contact" && logo.kind !== "share") || other.rigidBodyObject?.name !== "StudioCLTDPlayer") return;
      cancelContactCountdown();
    },
    [cancelContactCountdown, logo.kind],
  );

  if (!available && logo.kind !== "light") return null;

  const position: [number, number, number] = [logo.position[0], logo.height ?? floorLogoY, logo.position[1]];
  const standardVisual = (
    <>
      <primitive
        object={logo.object}
        rotation={[0, worldLogoRotation + (logo.rotationOffset ?? 0), 0]}
        scale={logoScale * (logo.scaleMultiplier ?? 1)}
        dispose={null}
      />
    </>
  );
  const visual = (
    <>
      {logo.kind === "contact" || logo.kind === "share" || logo.kind === "dark" ? (
        <ContactLogoVisual
          glow={logo.kind === "share"}
          object={logo.object}
          rotation={worldLogoRotation + (logo.rotationOffset ?? 0)}
          scale={logoScale * (logo.scaleMultiplier ?? 1)}
        />
      ) : standardVisual}
    </>
  );

  if (logo.kind === "light") {
    return <group position={position}>{visual}</group>;
  }

  return (
    <RigidBody type="fixed" colliders={false} position={position} name={`PlazaLogo:${logo.id}`}>
      <BallCollider
        ref={colliderRef}
        args={[pickupColliderRadius]}
        position={[0, 0.65, 0]}
        sensor
        onIntersectionEnter={collect}
        onIntersectionExit={handleExit}
      />
      {visual}
      {(logo.kind === "contact" || logo.kind === "share") && contactCountdown === 0 && (
        <BillboardLabel color={logoColors[logo.kind]} fontSize={0.25} position={[0, 1.75, 0]} maxWidth={4}>
          {logo.kind === "contact" ? "CONTACT" : "SHARE"}
        </BillboardLabel>
      )}
      {contactCountdown > 0 && (
        <BillboardLabel color="#ffffff" fontSize={0.25} position={[0, 1.75, 0]} maxWidth={4}>
          {`Opening ${logo.kind === "share" ? "Share" : "Contact"} in ${contactCountdown}…`}
        </BillboardLabel>
      )}
    </RigidBody>
  );
}

function ContactLogoVisual({ glow = false, object, rotation, scale }: { glow?: boolean; object: Object3D; rotation: number; scale: number }) {
  const groupRef = useRef<Group>(null);
  const glowRef = useRef<PointLight>(null);
  const lastUpdateRef = useRef(-Infinity);
  const logoWorldPosition = useMemo(() => new Vector3(), []);
  const playerWorldPosition = useMemo(() => new Vector3(), []);

  useFrame(({ clock, scene }) => {
    if (!groupRef.current || clock.elapsedTime - lastUpdateRef.current < 1 / 24) return;
    lastUpdateRef.current = clock.elapsedTime;
    groupRef.current.position.y = 0.1 + Math.sin(clock.elapsedTime * 0.85) * 0.08;
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

useGLTF.preload(logoPath);
