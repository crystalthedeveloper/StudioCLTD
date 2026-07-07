import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr, PerformanceMonitor } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { Suspense, useState } from "react";
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from "three";
import { StudioWorld } from "./world/StudioWorld";

export default function App() {
  const [dpr, setDpr] = useState(1.5);

  return (
    <Canvas
      shadows
      dpr={dpr}
      gl={{
        antialias: true,
        outputColorSpace: SRGBColorSpace,
        powerPreference: "high-performance",
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 1.18,
      }}
      camera={{ position: [11, 7, 15], fov: 58, near: 0.1, far: 10000 }}
      onCreated={({ gl }) => {
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = PCFSoftShadowMap;
      }}
    >
      <color attach="background" args={["#03040a"]} />
      <fog attach="fog" args={["#101020", 34, 170]} />
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.75)} />
      <Suspense fallback={null}>
        <Physics gravity={[0, -20, 0]}>
          <StudioWorld />
        </Physics>
      </Suspense>
      <AdaptiveDpr pixelated />
    </Canvas>
  );
}
