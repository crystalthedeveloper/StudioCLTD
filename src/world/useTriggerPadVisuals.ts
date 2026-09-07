import { createSquarePadGeometry } from "./squarePadGeometry";
import { useGameFrame } from "../player/useGameFrame";
import { useRef } from "react";
import { MathUtils, Mesh, MeshBasicMaterial } from "three";

export const portalRingGeometry = createSquarePadGeometry(0.974, 1.026);
export const portalPulseGeometry = createSquarePadGeometry(0.68, 1.05);
export const fixRingGeometry = createSquarePadGeometry(1.27, 1.33);
export const fixPulseGeometry = createSquarePadGeometry(0.86, 1.32);

type TriggerPadVisualConfig = {
  pulseBaseScale: number;
  pulseScaleAmount: number;
  ringOpacity: (active: boolean, activationGlow: number) => number;
  pulseOpacity: (active: boolean, activationGlow: number) => number;
  ringColor?: string;
};

export function useTriggerPadVisuals(active: boolean, config: TriggerPadVisualConfig) {
  const ringRef = useRef<Mesh>(null);
  const pulseRef = useRef<Mesh>(null);
  const activeStartedAtRef = useRef(0);
  const wasActiveRef = useRef(active);

  useGameFrame(({ clock }) => {
    if (!active && !wasActiveRef.current) return;

    if (active && !wasActiveRef.current) activeStartedAtRef.current = clock.elapsedTime;

    const activationGlow = active
      ? MathUtils.clamp(1 - (clock.elapsedTime - activeStartedAtRef.current), 0, 1)
      : 0;
    const ringScale = MathUtils.clamp(1 + activationGlow * 0.05, 1, 1.05);
    wasActiveRef.current = active;

    if (ringRef.current) {
      ringRef.current.scale.setScalar(ringScale);
      const material = ringRef.current.material;
      if (material instanceof MeshBasicMaterial) {
        if (config.ringColor) material.color.set(config.ringColor);
        material.opacity = config.ringOpacity(active, activationGlow);
      }
    }

    if (pulseRef.current) {
      pulseRef.current.visible = active || activationGlow > 0;
      pulseRef.current.scale.setScalar(MathUtils.clamp(
        config.pulseBaseScale + activationGlow * config.pulseScaleAmount,
        config.pulseBaseScale,
        config.pulseBaseScale + config.pulseScaleAmount,
      ));
      const material = pulseRef.current.material;
      if (material instanceof MeshBasicMaterial) {
        if (config.ringColor) material.color.set(config.ringColor);
        material.opacity = config.pulseOpacity(active, activationGlow);
      }
    }
  });

  return { pulseRef, ringRef };
}
