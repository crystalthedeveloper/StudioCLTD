import {
  Color, DataTexture, InstancedBufferAttribute, InstancedBufferGeometry,
  LinearFilter, NormalBlending, PlaneGeometry, ShaderMaterial,
} from "three";

// Bake the cloud density once; the fragment shader needs only one texture sample.
function noise(x: number, y: number) {
  const hash = (a: number, b: number) => {
    const value = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return value - Math.floor(value);
  };
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const lower = hash(ix, iy) * (1 - sx) + hash(ix + 1, iy) * sx;
  const upper = hash(ix, iy + 1) * (1 - sx) + hash(ix + 1, iy + 1) * sx;
  return lower * (1 - sy) + upper * sy;
}

const resolution = 128;
const pixels = new Uint8Array(resolution * resolution * 4);
for (let y = 0; y < resolution; y++) for (let x = 0; x < resolution; x++) {
  const u = x / (resolution - 1), v = y / (resolution - 1);
  const density = noise(u * 4 + 8, v * 4 + 3) * 0.55
    + noise(u * 9 + 2, v * 9 + 7) * 0.3 + noise(u * 19, v * 19) * 0.15;
  const radius = Math.hypot((u - 0.5) * 2, (v - 0.5) * 2);
  const edge = Math.max(0, 1 - radius * radius);
  const alpha = Math.pow(edge, 1.5) * Math.max(0, density - 0.22) * 1.6;
  pixels.set([255, 255, 255, Math.round(Math.min(1, alpha) * 255)], (y * resolution + x) * 4);
}
const smokeTexture = new DataTexture(pixels, resolution, resolution);
smokeTexture.minFilter = smokeTexture.magFilter = LinearFilter;
smokeTexture.needsUpdate = true;

/** One instanced draw, with fewer overlapping wisps on mobile. No lights or postprocessing. */
export function createPowerSmoke(color: string, compact: boolean) {
  const count = compact ? 10 : 18;
  const plane = new PlaneGeometry(1, 1);
  const geometry = new InstancedBufferGeometry();
  geometry.index = plane.index;
  geometry.attributes = { ...plane.attributes };
  geometry.instanceCount = count;
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    seeds.set([i / count, noise(i + 1, 3), noise(i + 4, 9), noise(i + 8, 2)], i * 4);
  }
  geometry.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 4));
  // Geometry owns the transferred buffers from here.
  plane.dispose();
  const material = new ShaderMaterial({
    uniforms: {
      uSmoke: { value: smokeTexture }, uColor: { value: new Color(color) },
      uTime: { value: 0 }, uStrength: { value: 0 },
    },
    transparent: true, blending: NormalBlending, depthWrite: false,
    depthTest: true, toneMapped: false,
    vertexShader: `
      attribute vec4 aSeed;
      uniform float uTime;
      varying vec2 vUv;
      varying float vFade;
      void main() {
        float life = fract(uTime * (0.29 + aSeed.y * 0.09) + aSeed.x);
        float sway = uTime * 0.65 + aSeed.z * 19.0;
        vec3 center = vec3(
          (aSeed.y - 0.5) * 0.8 + sin(sway) * 0.12,
          0.08 + life * 1.95,
          (aSeed.z - 0.5) * 0.7 + sin(sway * 0.73 + 4.0) * 0.12
        );
        float size = (0.52 + aSeed.w * 0.18) * (0.75 + life * 0.8);
        float angle = aSeed.z * 6.28 + sin(sway * 0.4) * 0.28;
        mat2 rotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
        vec2 corner = rotation * position.xy * vec2(size, size * 1.35);
        vec4 viewCenter = modelViewMatrix * vec4(center, 1.0);
        viewCenter.xy += corner;
        gl_Position = projectionMatrix * viewCenter;
        vUv = uv;
        vFade = smoothstep(0.0, 0.16, life) * (1.0 - smoothstep(0.55, 1.0, life));
      }
    `,
    fragmentShader: `
      uniform sampler2D uSmoke;
      uniform vec3 uColor;
      uniform float uStrength;
      varying vec2 vUv;
      varying float vFade;
      void main() {
        float density = texture2D(uSmoke, vUv).a;
        float alpha = density * vFade * uStrength;
        if (alpha < 0.003) discard;
        // Gentle variation reads as lit smoke, without an opaque luminous shell.
        gl_FragColor = vec4(uColor * (0.85 + density * 0.55), alpha);
        #include <colorspace_fragment>
      }
    `,
  });
  return { geometry, material };
}

/** A brief ignition, light sustained smoke, and a smooth fade to zero in the final seconds. */
export function powerSmokeStrength(remainingMs: number, durationMs: number) {
  const remaining = Math.max(0, Math.min(remainingMs, durationMs));
  const age = (durationMs - remaining) / 1000;
  const fade = Math.min(1, remaining / 1800);
  const smoothFade = fade * fade * (3 - 2 * fade);
  return (0.32 + 0.28 * Math.exp(-age * 3.5))
    * (0.7 + 0.3 * remaining / durationMs) * smoothFade;
}
