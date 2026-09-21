import { isCompactVisualBudget } from "../visualQuality";
import { useEffect, useMemo } from "react";
import { AdditiveBlending, Color, Quaternion, ShaderMaterial, Vector3 } from "three";
import { type PickupSurface } from "../pickupSurface";

/** Ground glow follows the support plane; no per-pickup dynamic lights or shadows. */
export function PickupSmokeGlow({ visible, color, surface }: { visible: boolean; color: string; surface: PickupSurface }) {
  const material = useMemo(() => new ShaderMaterial({
    uniforms: { tint: { value: new Color(color) }, strength: { value: isCompactVisualBudget() ? 0.12 : 0.24 } },
    transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 tint; uniform float strength; varying vec2 vUv; void main() {
      float glow = pow(max(0.0, 1.0 - length(vUv * 2.0 - 1.0)), 2.0);
      gl_FragColor = vec4(tint * 1.8, glow * strength);
      #include <colorspace_fragment>
    }`,
  }), [color]);
  const rotation = useMemo(() => new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1),
    new Vector3(surface.normal.x, surface.normal.y, surface.normal.z).normalize()), [surface]);
  useEffect(() => () => material.dispose(), [material]);
  return <mesh name="Power ground glow" visible={visible} quaternion={rotation} material={material}>
    <planeGeometry args={[0.95, 0.95]} />
  </mesh>;
}
