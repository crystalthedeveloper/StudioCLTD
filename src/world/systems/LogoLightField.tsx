import { useGLTF } from "@react-three/drei";
import { BallCollider, IntersectionEnterPayload, RigidBody } from "@react-three/rapier";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Color, Group, Mesh, MeshStandardMaterial, Object3D } from "three";
import { activateSpeedBoost } from "../../player/speedBoost";
import { InteractiveOutline } from "../InteractiveOutline";

const logoPath = "/logo/logo-optimized.glb";
const logoScale = 1.8;
const floorLogoY = 0.04;
const worldLogoRotation = -0.35;
const pickupColliderRadius = 1.55;
const speedRespawnMs = 28000;

type LogoKind = "coin" | "speed" | "penalty" | "light";

type PlazaLogo = {
  id: string;
  kind: LogoKind;
  position: readonly [number, number];
  rotationOffset?: number;
  scaleMultiplier?: number;
};

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

const logoColors: Record<LogoKind, string> = {
  coin: "#3f7d3a",
  speed: "#facc15",
  penalty: "#991b1b",
  light: "#ffffff",
};

function createSharedMaterial(kind: LogoKind) {
  const color = new Color(logoColors[kind]);
  return new MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: kind === "light" ? 1.5 : kind === "coin" ? 1 : 0.88,
    metalness: 0.08,
    roughness: 0.38,
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
  onPenaltyCollect: () => void;
  restartKey: number;
};

export function LogoLightField({ onCoinCollect, onPenaltyCollect, restartKey }: LogoLightFieldProps) {
  const { scene } = useGLTF(logoPath);
  const materials = useMemo(
    () => ({
      coin: createSharedMaterial("coin"),
      speed: createSharedMaterial("speed"),
      penalty: createSharedMaterial("penalty"),
      light: createSharedMaterial("light"),
    }),
    [],
  );
  const templates = useMemo(
    () => ({
      coin: createLogoTemplate(scene, materials.coin),
      speed: createLogoTemplate(scene, materials.speed),
      penalty: createLogoTemplate(scene, materials.penalty),
      light: createLogoTemplate(scene, materials.light),
    }),
    [materials, scene],
  );

  const logos = useMemo(
    () =>
      plazaLogos.map((logo) => ({
        ...logo,
        object: templates[logo.kind].clone(true),
      })),
    [templates],
  );

  useEffect(() => () => Object.values(materials).forEach((material) => material.dispose()), [materials]);

  return (
    <group name="PlazaLogoSystem">
      {logos.map((logo) => (
        <PlazaLogoInstance
          key={logo.id}
          logo={logo}
          onCoinCollect={onCoinCollect}
          onPenaltyCollect={onPenaltyCollect}
          restartKey={restartKey}
        />
      ))}
    </group>
  );
}

type PlazaLogoInstanceProps = {
  logo: PlazaLogo & { object: Object3D };
  onCoinCollect: () => void;
  onPenaltyCollect: () => void;
  restartKey: number;
};

function PlazaLogoInstance({ logo, onCoinCollect, onPenaltyCollect, restartKey }: PlazaLogoInstanceProps) {
  const [available, setAvailable] = useState(true);
  const respawnTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (respawnTimerRef.current !== null) {
      window.clearTimeout(respawnTimerRef.current);
      respawnTimerRef.current = null;
    }
    setAvailable(true);

    return () => {
      if (respawnTimerRef.current !== null) {
        window.clearTimeout(respawnTimerRef.current);
        respawnTimerRef.current = null;
      }
    };
  }, [restartKey]);

  const collect = useCallback(
    ({ other }: IntersectionEnterPayload) => {
      if (!available || other.rigidBodyObject?.name !== "StudioCLTDPlayer") return;

      if (logo.kind === "coin") {
        setAvailable(false);
        onCoinCollect();
        return;
      }

      if (logo.kind === "penalty") {
        setAvailable(false);
        onPenaltyCollect();
        return;
      }

      if (logo.kind === "speed") {
        setAvailable(false);
        activateSpeedBoost();
        respawnTimerRef.current = window.setTimeout(() => {
          respawnTimerRef.current = null;
          setAvailable(true);
        }, speedRespawnMs);
      }
    },
    [available, logo.kind, onCoinCollect, onPenaltyCollect],
  );

  if (!available && logo.kind !== "light") return null;

  const position: [number, number, number] = [logo.position[0], floorLogoY, logo.position[1]];
  const visual = (
    <>
      <primitive
        object={logo.object}
        rotation={[0, worldLogoRotation + (logo.rotationOffset ?? 0), 0]}
        scale={logoScale * (logo.scaleMultiplier ?? 1)}
        dispose={null}
      />
      {logo.kind !== "light" && <InteractiveOutline object={logo.object} />}
    </>
  );

  if (logo.kind === "light") {
    return <group position={position}>{visual}</group>;
  }

  return (
    <RigidBody type="fixed" colliders={false} position={position} name={`PlazaLogo:${logo.id}`}>
      <BallCollider args={[pickupColliderRadius]} position={[0, 0.65, 0]} sensor onIntersectionEnter={collect} />
      {visual}
    </RigidBody>
  );
}

useGLTF.preload(logoPath);
