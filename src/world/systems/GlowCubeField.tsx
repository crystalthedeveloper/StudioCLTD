import { CuboidCollider, RigidBody } from "@react-three/rapier";

const glowBeacons = [
  { position: [-18, 0.45, -14] as [number, number, number], color: "#ffd35c", light: "#ffd35c", scale: 0.55 },
  { position: [16, 0.55, -23] as [number, number, number], color: "#ff3b2f", light: "#ff3b2f", scale: 0.7 },
  { position: [-31, 0.5, 18] as [number, number, number], color: "#ffd35c", light: "#ffd35c", scale: 0.6 },
  { position: [34, 0.48, 12] as [number, number, number], color: "#ff3b2f", light: "#ff3b2f", scale: 0.52 },
  { position: [7, 0.52, 34] as [number, number, number], color: "#ffd35c", light: "#ffd35c", scale: 0.62 },
  { position: [-42, 0.6, -32] as [number, number, number], color: "#ff3b2f", light: "#ff3b2f", scale: 0.75 },
  { position: [43, 0.58, -41] as [number, number, number], color: "#ffd35c", light: "#ffd35c", scale: 0.68 },
  { position: [-8, 0.46, 48] as [number, number, number], color: "#ff3b2f", light: "#ff3b2f", scale: 0.5 },
  { position: [55, 0.5, 31] as [number, number, number], color: "#ffd35c", light: "#ffd35c", scale: 0.58 },
  { position: [-58, 0.54, 6] as [number, number, number], color: "#ff3b2f", light: "#ff3b2f", scale: 0.64 },
];

export function GlowCubeField() {
  return (
    <group name="EnvironmentLightBeacons">
      {glowBeacons.map((beacon, index) => (
        <RigidBody key={index} type="fixed" colliders={false} position={[beacon.position[0], 0.06, beacon.position[2]]}>
          <CuboidCollider args={[beacon.scale * 0.45, beacon.scale * 0.42, beacon.scale * 0.45]} position={[0, beacon.scale * 0.42, 0]} />
          <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, 0.012, 0]}>
            <cylinderGeometry args={[beacon.scale * 0.58, beacon.scale * 0.72, 0.045, 48]} />
            <meshStandardMaterial color="#161b22" metalness={0.82} roughness={0.28} envMapIntensity={0.8} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.044, 0]}>
            <ringGeometry args={[beacon.scale * 0.42, beacon.scale * 0.58, 64]} />
            <meshBasicMaterial color={beacon.light} transparent opacity={0.48} depthWrite={false} />
          </mesh>
          <mesh castShadow position={[0, beacon.scale * 0.42, 0]}>
            <cylinderGeometry args={[beacon.scale * 0.14, beacon.scale * 0.19, beacon.scale * 0.78, 32]} />
            <meshStandardMaterial
              color={beacon.color}
              emissive={beacon.light}
              emissiveIntensity={3.1}
              metalness={0.24}
              roughness={0.18}
            />
          </mesh>
          <mesh position={[0, beacon.scale * 0.43, 0]} scale={[beacon.scale * 1.25, beacon.scale * 1.25, beacon.scale * 1.25]}>
            <sphereGeometry args={[0.42, 32, 16]} />
            <meshBasicMaterial color={beacon.light} transparent opacity={0.13} depthWrite={false} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.05, 0]}>
            <circleGeometry args={[beacon.scale * 1.65, 64]} />
            <meshBasicMaterial color={beacon.light} transparent opacity={0.075} depthWrite={false} />
          </mesh>
          <pointLight color={beacon.light} intensity={15} distance={17} decay={1.8} position={[0, beacon.scale * 0.85, 0]} />
        </RigidBody>
      ))}
    </group>
  );
}
