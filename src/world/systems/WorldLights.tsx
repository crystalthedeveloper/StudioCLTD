export function WorldLights() {
  return (
    <>
      <ambientLight intensity={0.58} color="#d8dcff" />
      <hemisphereLight intensity={0.68} color="#e2e8ff" groundColor="#432d2c" />
      <directionalLight color="#ffe2bd" intensity={1.35} position={[-16, 30, 24]} />
      <directionalLight color="#ffd8ad" intensity={0.72} position={[14, 13, 18]} />
      <rectAreaLight color="#ffdfbf" intensity={1.35} width={42} height={26} position={[0, 14, 18]} rotation={[-0.72, 0, 0]} />
      <spotLight
        color="#fff1d5"
        intensity={11}
        position={[6, 18, 12]}
        angle={0.5}
        penumbra={0.92}
        distance={70}
      />
    </>
  );
}
