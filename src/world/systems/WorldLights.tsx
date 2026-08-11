import { useEffect, useRef } from "react";
import { AmbientLight } from "three";

export function WorldLights() {
  const characterFillRef = useRef<AmbientLight>(null);

  useEffect(() => {
    characterFillRef.current?.layers.set(1);
  }, []);

  return (
    <>
      <ambientLight intensity={1.05} color="#fff8e8" />
      <hemisphereLight intensity={1.25} color="#d9f1ff" groundColor="#70766a" />
      <ambientLight ref={characterFillRef} intensity={0.42} color="#fffdf5" />
      <directionalLight color="#fff1c9" intensity={1.35} position={[-24, 36, 20]} />
      <directionalLight color="#c8e9ff" intensity={0.38} position={[20, 18, -16]} />
    </>
  );
}
