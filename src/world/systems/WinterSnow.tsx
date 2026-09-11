import { useEffect, useMemo, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, ShaderMaterial, Vector3 } from "three";
import { useGameFrame } from "../../player/useGameFrame";
import { playerWorldState } from "../playerWorldState";
import { isCompactVisualBudget } from "../visualQuality";

const noRaycast = () => {};

/** One draw call; particles recycle on the GPU inside a player-centered volume. */
export function WinterSnow() {
  const [compact, setCompact] = useState(isCompactVisualBudget);
  const height = useThree((state) => state.size.height);
  const gl = useThree((state) => state.gl);
  const elapsed = useRef(0);
  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse), (max-width: 768px)");
    const update = () => setCompact(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const geometry = useMemo(() => {
    const count = compact ? 220 : 650;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    // Deterministic distribution avoids changing the pattern on re-renders.
    for (let i = 0; i < count; i++) {
      positions[i * 3] = ((i * 0.754877666) % 1) * 48;
      positions[i * 3 + 1] = ((i * 0.569840296) % 1) * 20;
      positions[i * 3 + 2] = ((i * 0.438579021) % 1) * 48;
      seeds[i] = (i * 0.618033989) % 1;
    }
    const result = new BufferGeometry();
    result.setAttribute("position", new BufferAttribute(positions, 3));
    result.setAttribute("seed", new BufferAttribute(seeds, 1));
    return result;
  }, [compact]);
  const material = useMemo(() => new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { time: { value: 0 }, player: { value: new Vector3() }, viewport: { value: 1 } },
    vertexShader: `
      attribute float seed;
      uniform float time;
      uniform vec3 player;
      uniform float viewport;
      varying float opacity;
      void main() {
        vec3 p = position;
        p.x += time * 0.18 + sin(time * 0.4 + seed * 30.0) * 0.45;
        p.z += time * 0.09;
        p.xz = mod(p.xz - player.xz + 24.0, 48.0) - 24.0 + player.xz;
        float bottom = max(0.08, player.y - 6.0);
        p.y = mod(p.y - time * (0.65 + seed * 0.65) - bottom, 20.0) + bottom;
        vec4 view = modelViewMatrix * vec4(p, 1.0);
        float distanceToPlayer = length(p.xz - player.xz);
        opacity = 0.55 * (1.0 - smoothstep(17.0, 24.0, distanceToPlayer))
          * smoothstep(2.0, 5.0, -view.z)
          * smoothstep(bottom, bottom + 1.0, p.y);
        gl_PointSize = clamp(viewport * (0.025 + seed * 0.025) / max(1.0, -view.z), 1.0, 5.0);
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: `
      varying float opacity;
      void main() {
        float radius = length(gl_PointCoord - 0.5);
        float alpha = (1.0 - smoothstep(0.12, 0.5, radius)) * opacity;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(0.82, 0.9, 1.0, alpha);
      }
    `,
  }), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useGameFrame((_, delta) => {
    elapsed.current += Math.min(delta, 0.05);
    material.uniforms.time.value = elapsed.current;
    material.uniforms.player.value.copy(playerWorldState.position);
    material.uniforms.viewport.value = height * Math.min(gl.getPixelRatio(), 2);
  });
  return <points name="LocalizedWinterSnow" geometry={geometry} material={material} frustumCulled={false} raycast={noRaycast} />;
}
