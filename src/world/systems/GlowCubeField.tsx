const glowCubes = [
  { position: [-18, 0.45, -14] as [number, number, number], color: "#ffcf5a", light: "#ffc247", scale: 0.55 },
  { position: [16, 0.55, -23] as [number, number, number], color: "#ff5b34", light: "#ff442a", scale: 0.7 },
  { position: [-31, 0.5, 18] as [number, number, number], color: "#ffd16a", light: "#ffbf45", scale: 0.6 },
  { position: [34, 0.48, 12] as [number, number, number], color: "#e83d2d", light: "#ff3828", scale: 0.52 },
  { position: [7, 0.52, 34] as [number, number, number], color: "#ffc857", light: "#ffc03d", scale: 0.62 },
  { position: [-42, 0.6, -32] as [number, number, number], color: "#ff7540", light: "#ff4d2e", scale: 0.75 },
  { position: [43, 0.58, -41] as [number, number, number], color: "#ffd878", light: "#ffca58", scale: 0.68 },
  { position: [-8, 0.46, 48] as [number, number, number], color: "#df342a", light: "#ff3228", scale: 0.5 },
  { position: [55, 0.5, 31] as [number, number, number], color: "#ffcb5c", light: "#ffc247", scale: 0.58 },
  { position: [-58, 0.54, 6] as [number, number, number], color: "#ff5836", light: "#ff3b2c", scale: 0.64 },
];

export function GlowCubeField() {
  return (
    <group>
      {glowCubes.map((cube, index) => (
        <group key={index} position={cube.position}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[cube.scale, cube.scale, cube.scale]} />
            <meshStandardMaterial
              color={cube.color}
              emissive={cube.light}
              emissiveIntensity={2.35}
              metalness={0.18}
              roughness={0.28}
            />
          </mesh>
          <mesh scale={cube.scale * 2.8}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color={cube.light} transparent opacity={0.075} depthWrite={false} />
          </mesh>
          <pointLight color={cube.light} intensity={17} distance={18} decay={1.85} position={[0, 0.6, 0]} />
        </group>
      ))}
    </group>
  );
}
