import { useFrame } from "@react-three/fiber";
import { RefObject, useEffect, useRef } from "react";
import { MathUtils, Mesh, MeshBasicMaterial, RingGeometry, TorusGeometry } from "three";
import { subscribeGameFocus } from "../player/gameFocus";

export const portalRingGeometry = new TorusGeometry(1, 0.026, 8, 48);
export const portalPulseGeometry = new RingGeometry(0.68, 1.05, 48);
export const fixRingGeometry = new TorusGeometry(1.3, 0.03, 8, 64);
export const fixPulseGeometry = new RingGeometry(0.86, 1.32, 64);

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

  useEffect(() => subscribeGameFocus((focused) => {
    if (focused) return;
    activeStartedAtRef.current = Number.NEGATIVE_INFINITY;
    wasActiveRef.current = active;
    resetMeshScale(ringRef);
    resetMeshScale(pulseRef);
    if (pulseRef.current) pulseRef.current.visible = false;
  }), [active]);

  useFrame(({ clock }) => {
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

function resetMeshScale(ref: RefObject<Mesh>) {
  ref.current?.scale.set(1, 1, 1);
}
