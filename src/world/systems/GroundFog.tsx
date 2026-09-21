import { useMemo } from "react";
import { AdditiveBlending, PlaneGeometry, ShaderMaterial } from "three";
import { useGameFrame } from "../../player/useGameFrame";
import { isCompactVisualBudget } from "../visualQuality";

const noRaycast = () => {};

/** A small, low-altitude fog sheet: distant, HUD-safe, and one draw call. */
export function GroundFog() {
  const geometry = useMemo(() => new PlaneGeometry(42 * (isCompactVisualBudget() ? 0.72 : 1), 28 * (isCompactVisualBudget() ? 0.72 : 1)), []);
  const material = useMemo(() => new ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, blending: AdditiveBlending,
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec2 vUv; uniform float time; void main(){ vUv=uv; vec3 p=position; p.x+=sin(time*.08+p.z*.08)*.7; p.z+=time*.035; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`,
    fragmentShader: `varying vec2 vUv; void main(){ float edge=smoothstep(0.,.22,vUv.x)*smoothstep(1.,.78,vUv.x)*smoothstep(0.,.3,vUv.y)*smoothstep(1.,.7,vUv.y); float wave=.55+.45*sin(vUv.x*11.+vUv.y*7.); gl_FragColor=vec4(.38,.43,.48,edge*wave*.075); }`,
  }), []);
  useGameFrame((_, delta) => { material.uniforms.time.value += Math.min(delta, 0.05); });
  return <mesh name="DistantGroundFog" geometry={geometry} material={material} position={[0, 0.16, -8]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast} />;
}
