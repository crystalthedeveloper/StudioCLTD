import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Shape,
  SphereGeometry,
  Vector3,
} from "three";
import { activateSpeedBoost } from "../../player/speedBoost";
import { playerWorldState } from "../playerWorldState";

const pickupRadius = 1.8;
const respawnMs = 28000;
const pickupPositions = [
  [0, 1.35, -18],
  [-24, 1.35, 10],
  [24, 1.35, 22],
] as const;

const white = "#ffffff";
const particleCount = 2;

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

export function SpeedPowerUp({ restartKey }: { restartKey: number }) {
  const resources = useMemo(() => {
    const boltGeometry = new ExtrudeGeometry(createBoltShape(), {
      bevelEnabled: true,
      bevelSegments: 1,
      bevelSize: 0.018,
      bevelThickness: 0.018,
      depth: 0.08,
    });
    const particleGeometry = new SphereGeometry(0.025, 8, 8);
    const boltMaterial = new MeshStandardMaterial({
      color: white,
      emissive: white,
      emissiveIntensity: 0.72,
      metalness: 0.18,
      roughness: 0.28,
      toneMapped: false,
    });
    const particleMaterial = new MeshBasicMaterial({
      color: white,
      depthWrite: false,
      opacity: 0.28,
      toneMapped: false,
      transparent: true,
    });

    return {
      boltGeometry,
      boltMaterial,
      particleGeometry,
      particleMaterial,
    };
  }, []);

  return (
    <group name="SpeedPowerUps">
      {pickupPositions.map((position, index) => (
        <SpeedPowerUpInstance key={index} index={index} position={position} resources={resources} restartKey={restartKey} />
      ))}
    </group>
  );
}

type SpeedPowerUpInstanceProps = {
  index: number;
  position: readonly [number, number, number];
  resources: {
    boltGeometry: ExtrudeGeometry;
    boltMaterial: MeshStandardMaterial;
    particleGeometry: SphereGeometry;
    particleMaterial: MeshBasicMaterial;
  };
  restartKey: number;
};

function SpeedPowerUpInstance({ index, position, resources, restartKey }: SpeedPowerUpInstanceProps) {
  const groupRef = useRef<Group>(null);
  const particlesRef = useRef<Mesh[]>([]);
  const availableRef = useRef(true);
  const respawnAtRef = useRef(0);
  const lastVisualFrameRef = useRef(-1);
  const basePosition = useMemo(() => new Vector3(...position), [position]);

  useEffect(() => {
    availableRef.current = true;
    respawnAtRef.current = 0;
    if (!groupRef.current) return;

    groupRef.current.visible = true;
    groupRef.current.scale.setScalar(1);
    groupRef.current.position.copy(basePosition);
  }, [basePosition, restartKey]);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;

    const now = performance.now();
    if (!availableRef.current) {
      if (now < respawnAtRef.current) return;

      availableRef.current = true;
      group.visible = true;
      group.scale.setScalar(1);
    }

    const visualFrame = Math.floor(clock.elapsedTime * 24);
    if (visualFrame !== lastVisualFrameRef.current) {
      lastVisualFrameRef.current = visualFrame;
      const elapsed = clock.elapsedTime + index * 0.7;
      group.position.set(
        basePosition.x,
        basePosition.y + Math.sin(elapsed * 1.8) * 0.12,
        basePosition.z
      );
      group.rotation.y = elapsed * 1.1;

      for (let particleIndex = 0; particleIndex < particlesRef.current.length; particleIndex += 1) {
        const particle = particlesRef.current[particleIndex];
        if (!particle) continue;

        const angle = elapsed * 1.05 + (particleIndex / particleCount) * Math.PI * 2;
        particle.position.set(
          Math.cos(angle) * 0.34,
          -0.16 + particleIndex * 0.24 + Math.sin(elapsed * 1.7 + particleIndex) * 0.025,
          Math.sin(angle) * 0.34
        );
      }
    }

    if (playerWorldState.position.distanceTo(group.position) > pickupRadius) return;

    activateSpeedBoost();
    availableRef.current = false;
    respawnAtRef.current = now + respawnMs;
    group.visible = false;
  });

  return (
    <group ref={groupRef} name={`SpeedPowerUp:${index}`} position={basePosition}>
      <mesh geometry={resources.boltGeometry} material={resources.boltMaterial} name="SpeedPowerUpBolt" scale={[0.9, 0.9, 0.9]} />
      {Array.from({ length: particleCount }, (_, particleIndex) => (
        <mesh
          key={particleIndex}
          ref={(mesh) => {
            if (mesh) particlesRef.current[particleIndex] = mesh;
          }}
          geometry={resources.particleGeometry}
          material={resources.particleMaterial}
          name={`SpeedPowerUpParticle:${particleIndex}`}
        />
      ))}
    </group>
  );
}
