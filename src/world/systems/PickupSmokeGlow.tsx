import { isCompactVisualBudget } from "../visualQuality";
import { useEffect, useMemo } from "react";
import { AdditiveBlending, Color, Quaternion, ShaderMaterial, Vector3 } from "three";
import { type PickupSurface } from "../pickupSurface";
import { useGameFrame } from "../../player/useGameFrame";

/** Ground glow follows the support plane; no per-pickup dynamic lights or shadows. */
export function PickupSmokeGlow({ visible, color, surface }: { visible: boolean; color: string; surface: PickupSurface }) {
  const material = useMemo(() => new ShaderMaterial({
    uniforms: { tint: { value: new Color(color) }, strength: { value: isCompactVisualBudget() ? 0.08 : 0.14 }, time: { value: 0 } },
    transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 tint; uniform float strength, time; varying vec2 vUv; void main() {
      float drift = sin(time * 1.7 + vUv.x * 5.0) * 0.035;
      float glow = pow(max(0.0, 1.0 - length((vUv + vec2(drift, 0.0)) * 2.0 - 1.0)), 2.4);
      gl_FragColor = vec4(tint * 1.8, glow * strength);
      #include <colorspace_fragment>
    }`,
  }), [color]);
  const rotation = useMemo(() => new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1),
    new Vector3(surface.normal.x, surface.normal.y, surface.normal.z).normalize()), [surface]);
  useEffect(() => () => material.dispose(), [material]);
  useGameFrame(() => { material.uniforms.time.value = performance.now() / 1000; });
  return <mesh name="Power ground glow" visible={visible} quaternion={rotation} material={material}>
    <planeGeometry args={[0.95, 0.95]} />
  </mesh>;
}
