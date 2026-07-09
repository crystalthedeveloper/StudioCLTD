import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useRef } from "react";
import { AdditiveBlending, DoubleSide, Group, Mesh, MeshBasicMaterial } from "three";

const glowBeacons = [
  { position: [-18, 0.45, -14] as [number, number, number], color: "#FFE600", light: "#FFE600", scale: 0.55 },
  { position: [16, 0.55, -23] as [number, number, number], color: "#ff3b2f", light: "#ff3b2f", scale: 0.7 },
  { position: [-31, 0.5, 18] as [number, number, number], color: "#FFE600", light: "#FFE600", scale: 0.6 },
  { position: [34, 0.48, 12] as [number, number, number], color: "#ff3b2f", light: "#ff3b2f", scale: 0.52 },
  { position: [7, 0.52, 34] as [number, number, number], color: "#FFE600", light: "#FFE600", scale: 0.62 },
  { position: [-42, 0.6, -32] as [number, number, number], color: "#ff3b2f", light: "#ff3b2f", scale: 0.75 },
  { position: [43, 0.58, -41] as [number, number, number], color: "#FFE600", light: "#FFE600", scale: 0.68 },
  { position: [-8, 0.46, 48] as [number, number, number], color: "#ff3b2f", light: "#ff3b2f", scale: 0.5 },
  { position: [55, 0.5, 31] as [number, number, number], color: "#FFE600", light: "#FFE600", scale: 0.58 },
  { position: [-58, 0.54, 6] as [number, number, number], color: "#ff3b2f", light: "#ff3b2f", scale: 0.64 },
];

export function GlowCubeField() {
  return (
    <group name="EnvironmentLightBeacons">
      {glowBeacons.map((beacon, index) => (
        <BeaconMarker key={`${beacon.position[0]}:${beacon.position[2]}`} {...beacon} phase={index * 0.73} />
      ))}
    </group>
  );
}

type BeaconMarkerProps = {
  position: [number, number, number];
  color: string;
  light: string;
  scale: number;
  phase: number;
};

function BeaconMarker({ position, color, light, scale, phase }: BeaconMarkerProps) {
  const markerRef = useRef<Group>(null);
  const ringRef = useRef<Group>(null);
  const verticalGlowRef = useRef<Mesh>(null);
  const groundGlowRef = useRef<Mesh>(null);
  const coreMaterialRef = useRef<MeshBasicMaterial>(null);
  const lastVisualFrameRef = useRef(-1);

  const visualScale = scale * 0.58;
  const isWarning = color.toLowerCase() !== "#ffe600";

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    const frameSlot = Math.floor(elapsed * 18);
    if (frameSlot === lastVisualFrameRef.current) return;
    lastVisualFrameRef.current = frameSlot;

    const pulse = 0.78 + Math.sin(elapsed * 1.08 + phase) * 0.18;

    if (markerRef.current) {
      markerRef.current.scale.setScalar(0.96 + pulse * 0.04);
    }

    if (ringRef.current) {
      ringRef.current.rotation.y = elapsed * 0.62 + phase;
      ringRef.current.rotation.z = Math.sin(elapsed * 0.42 + phase) * 0.08;
    }

    if (coreMaterialRef.current) {
      coreMaterialRef.current.opacity = 0.74 + pulse * 0.12;
    }

    if (verticalGlowRef.current?.material instanceof MeshBasicMaterial) {
      verticalGlowRef.current.material.opacity = (isWarning ? 0.12 : 0.1) * pulse;
    }

    if (groundGlowRef.current?.material instanceof MeshBasicMaterial) {
      groundGlowRef.current.material.opacity = (isWarning ? 0.075 : 0.065) * pulse;
    }

  });

  return (
    <RigidBody type="fixed" colliders={false} position={[position[0], 0.06, position[2]]}>
      <CuboidCollider args={[visualScale * 0.32, visualScale * 0.52, visualScale * 0.32]} position={[0, visualScale * 0.5, 0]} />
      <group ref={markerRef}>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, 0]}>
          <cylinderGeometry args={[visualScale * 0.48, visualScale * 0.58, 0.035, 24]} />
          <meshStandardMaterial color="#151a22" metalness={0.88} roughness={0.26} envMapIntensity={0.76} />
        </mesh>

        <mesh rotation-x={-Math.PI / 2} position={[0, 0.04, 0]}>
          <ringGeometry args={[visualScale * 0.34, visualScale * 0.43, 36]} />
          <meshBasicMaterial color={light} transparent opacity={0.24} depthWrite={false} blending={AdditiveBlending} />
        </mesh>

        <mesh position={[0, visualScale * 0.48, 0]}>
          <cylinderGeometry args={[visualScale * 0.085, visualScale * 0.13, visualScale * 0.7, 18]} />
          <meshStandardMaterial
            color={color}
            emissive={light}
            emissiveIntensity={isWarning ? 1.9 : 1.65}
            metalness={0.36}
            roughness={0.16}
          />
        </mesh>

        <mesh position={[0, visualScale * 0.52, 0]}>
          <sphereGeometry args={[visualScale * 0.16, 16, 8]} />
          <meshBasicMaterial
            ref={coreMaterialRef}
            color={light}
            transparent
            opacity={0.82}
            depthWrite={false}
            toneMapped={false}
            blending={AdditiveBlending}
          />
        </mesh>

        <group ref={ringRef} position={[0, visualScale * 0.56, 0]} rotation={[Math.PI / 2.65, 0, Math.PI / 8]}>
          <mesh>
            <torusGeometry args={[visualScale * 0.34, visualScale * 0.012, 8, 48]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.52} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>

        <mesh ref={verticalGlowRef} position={[0, visualScale * 0.52, 0]}>
          <cylinderGeometry args={[visualScale * 0.28, visualScale * 0.36, visualScale * 1.12, 24, 1, true]} />
          <meshBasicMaterial
            color={light}
            transparent
            opacity={0.1}
            depthWrite={false}
            side={DoubleSide}
            blending={AdditiveBlending}
          />
        </mesh>

        <mesh rotation-x={-Math.PI / 2} position={[0, 0.045, 0]}>
          <ringGeometry args={[visualScale * 0.46, visualScale * 0.68, 40]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.16} depthWrite={false} toneMapped={false} />
        </mesh>

        <mesh ref={groundGlowRef} rotation-x={-Math.PI / 2} position={[0, 0.05, 0]}>
          <circleGeometry args={[visualScale * 1.08, 32]} />
          <meshBasicMaterial color={light} transparent opacity={0.07} depthWrite={false} blending={AdditiveBlending} />
        </mesh>

      </group>
    </RigidBody>
  );
}
