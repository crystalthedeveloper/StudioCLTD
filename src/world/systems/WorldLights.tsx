export function WorldLights() {
  return (
    <>
      <ambientLight intensity={1.18} color="#d8dcff" />
      <hemisphereLight intensity={1.42} color="#e2e8ff" groundColor="#7c4334" />
      <directionalLight color="#ffe2bd" intensity={2.7} position={[-16, 30, 24]} />
      <directionalLight color="#ffd8ad" intensity={1.55} position={[14, 13, 18]} />
      <rectAreaLight color="#ffdfbf" intensity={3.15} width={42} height={26} position={[0, 14, 18]} rotation={[-0.72, 0, 0]} />
      <spotLight
        color="#fff1d5"
        intensity={34}
        position={[6, 18, 12]}
        angle={0.5}
        penumbra={0.92}
        distance={70}
      />
    </>
  );
}
