export function WorldLights() {
  return (
    <>
      <ambientLight intensity={1.05} color="#c8d0ff" />
      <hemisphereLight intensity={1.28} color="#d4ddff" groundColor="#6a3325" />
      <directionalLight
        castShadow
        color="#ffe2bd"
        intensity={4.65}
        position={[-16, 30, 24]}
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.00008}
        shadow-normalBias={0.025}
        shadow-camera-left={-75}
        shadow-camera-right={75}
        shadow-camera-top={75}
        shadow-camera-bottom={-75}
      />
      <directionalLight color="#ffd4a3" intensity={2.25} position={[14, 13, 18]} />
      <rectAreaLight color="#ffddb8" intensity={4.6} width={34} height={22} position={[0, 13, 16]} rotation={[-0.72, 0, 0]} />
      <pointLight color="#e2e6ff" intensity={32} distance={34} position={[0, 6, 6]} />
      <spotLight
        castShadow
        color="#fff1d5"
        intensity={155}
        position={[6, 18, 12]}
        angle={0.42}
        penumbra={0.8}
        distance={70}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.00008}
        shadow-normalBias={0.02}
      />
    </>
  );
}
