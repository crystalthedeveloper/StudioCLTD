import { useFrame } from "@react-three/fiber";
import { useRef } from "react";

const enabled = import.meta.env.VITE_PERFORMANCE_DEBUG === "true";

export function PerformanceDebug() {
  const framesRef = useRef(0);
  const elapsedRef = useRef(0);

  useFrame((_, delta) => {
    if (!enabled) return;

    framesRef.current += 1;
    elapsedRef.current += delta;

    if (elapsedRef.current < 1) return;

    const fps = framesRef.current / elapsedRef.current;
    console.info("[StudioCLTD performance]", {
      fps: Math.round(fps),
      frameMs: Number((1000 / Math.max(fps, 1)).toFixed(1)),
    });
    framesRef.current = 0;
    elapsedRef.current = 0;
  });

  return null;
}
