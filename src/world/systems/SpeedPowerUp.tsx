import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Shape, Vector3 } from "three";
import { activateSpeedBoost } from "../../player/speedBoost";
import { playerWorldState } from "../playerWorldState";

const pickupRadius = 1.8;
const respawnMs = 25000;
const collectFadeMs = 260;

const pickupPositions = [
  [0, 1.35, -18],
  [-22, 1.35, -12],
  [24, 1.35, -10],
  [-18, 1.35, 24],
  [22, 1.35, 26],
] as const;

const white = "#ffffff";

function createBoltShape() {
  const shape = new Shape();
  shape.moveTo(-0.18, 0.72);
  shape.lineTo(0.22, 0.72);
  shape.lineTo(0.02, 0.12);
  shape.lineTo(0.34, 0.12);
  shape.lineTo(-0.24, -0.78);
  shape.lineTo(-0.04, -0.18);
  shape.lineTo(-0.36, -0.18);
  shape.closePath();
  return shape;
}

export function SpeedPowerUp() {
  const boltShape = useMemo(createBoltShape, []);

  return (
    <group name="SpeedPowerUps">
      {pickupPositions.map((position, index) => (
        <SpeedPowerUpInstance key={index} boltShape={boltShape} index={index} position={position} />
      ))}
    </group>
  );
}

type SpeedPowerUpInstanceProps = {
  boltShape: Shape;
  index: number;
  position: readonly [number, number, number];
};

function SpeedPowerUpInstance({ boltShape, index, position }: SpeedPowerUpInstanceProps) {
  const groupRef = useRef<Group>(null);
  const [visible, setVisible] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const collectedAtRef = useRef(0);
  const basePosition = useMemo(() => new Vector3(...position), [position]);

  const shimmerParticles = useMemo(
    () =>
      Array.from({ length: 8 }, (_, particleIndex) => ({
        angle: (particleIndex / 8) * Math.PI * 2,
        height: -0.42 + (particleIndex % 4) * 0.24,
        radius: 0.42 + (particleIndex % 3) * 0.08,
        size: 0.018 + (particleIndex % 2) * 0.008,
      })),
    []
  );

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group || !visible) return;

    const elapsed = clock.elapsedTime + index * 0.6;
    group.position.set(
      basePosition.x,
      basePosition.y + Math.sin(elapsed * 2.1) * 0.2,
      basePosition.z
    );
    group.rotation.y += 0.024;

    group.children.forEach((child, childIndex) => {
      if (!child.name.startsWith("SpeedPowerUpParticle")) return;

      const particle = shimmerParticles[childIndex - 2];
      if (!particle) return;

      const angle = particle.angle + elapsed * 1.8;
      child.position.set(
        Math.cos(angle) * particle.radius,
        particle.height + Math.sin(elapsed * 2.4 + childIndex) * 0.04,
        Math.sin(angle) * particle.radius
      );
    });

    if (collecting) {
      const progress = Math.min((performance.now() - collectedAtRef.current) / collectFadeMs, 1);
      const fade = 1 - progress;
      group.scale.setScalar(1 + progress * 0.3);
      group.traverse((object) => {
        const material = (object as Mesh).material;
        if (!(material instanceof MeshBasicMaterial) && !(material instanceof MeshStandardMaterial)) return;
        material.opacity = Math.max(0, fade);
      });

      if (progress < 1) return;

      setVisible(false);
      setCollecting(false);
      group.scale.setScalar(1);
      window.setTimeout(() => setVisible(true), respawnMs);
      return;
    }

    const distance = playerWorldState.position.distanceTo(group.position);
    if (distance > pickupRadius) return;

    activateSpeedBoost();
    collectedAtRef.current = performance.now();
    setCollecting(true);
  });

  if (!visible) return null;

  return (
    <group ref={groupRef} name={`SpeedPowerUp:${index}`} position={basePosition}>
      <pointLight color={white} intensity={2.8} distance={5.2} position={[0, 0, 0]} />
      <mesh name="SpeedPowerUpBolt" scale={[0.9, 0.9, 0.9]}>
        <extrudeGeometry args={[boltShape, { bevelEnabled: true, bevelSegments: 1, bevelSize: 0.018, bevelThickness: 0.018, depth: 0.08 }]} />
        <meshStandardMaterial
          color={white}
          emissive={white}
          emissiveIntensity={0.95}
          metalness={0.18}
          roughness={0.28}
          transparent
          opacity={1}
          toneMapped={false}
        />
      </mesh>
      {shimmerParticles.map((particle, particleIndex) => (
        <mesh
          key={particleIndex}
          name={`SpeedPowerUpParticle:${particleIndex}`}
          position={[
            Math.cos(particle.angle) * particle.radius,
            particle.height,
            Math.sin(particle.angle) * particle.radius,
          ]}
        >
          <sphereGeometry args={[particle.size, 8, 8]} />
          <meshBasicMaterial color={white} transparent opacity={0.34} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
