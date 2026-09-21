import {
  Color, DataTexture, InstancedBufferAttribute, InstancedBufferGeometry,
  LinearFilter, NormalBlending, PlaneGeometry, ShaderMaterial, Vector3,
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

// Shared per quality tier, allocated only when that tier is used.
const smokeTextures = new Map<number, DataTexture>();
function getSmokeTexture(compact: boolean) {
  const resolution = compact ? 64 : 128;
  const cached = smokeTextures.get(resolution);
  if (cached) return cached;
  const pixels = new Uint8Array(resolution * resolution * 4);
  for (let y = 0; y < resolution; y++) for (let x = 0; x < resolution; x++) {
    const u = x / (resolution - 1), v = y / (resolution - 1);
    const nx = (u - 0.5) * 2, ny = (v - 0.5) * 2;
    const broad = noise(u * 4 + 8, v * 4 + 3);
    const detail = noise(u * 10 + 2, v * 10 + 7);
    const fine = noise(u * 23, v * 23);
    const density = broad * 0.55 + detail * 0.3 + fine * 0.15;
    const angle = Math.atan2(ny, nx);
    const boundary = 0.76 + Math.sin(angle * 3 + 0.4) * 0.10 + Math.sin(angle * 5) * 0.06;
    const radius = Math.hypot(nx, ny) / boundary;
    const edge = Math.max(0, 1 - radius * radius);
    // Broken lobes and holes survive layering instead of filling a circular disk.
    const alpha = Math.pow(edge, 1.7) * Math.pow(Math.max(0, density - 0.24) * 1.65, 1.15);
    const light = Math.round((0.25 + broad * 0.5 + detail * 0.25) * 255);
    pixels.set([light, light, light, Math.round(Math.min(1, alpha) * 255)], (y * resolution + x) * 4);
  }
  const texture = new DataTexture(pixels, resolution, resolution);
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  smokeTextures.set(resolution, texture);
  return texture;
}

/** One instanced draw: soft, single-colour wisps with a slow rise and curl. */
export function createPowerSmoke(color: string, compact: boolean, size = 1, orb = false) {
  const count = compact ? 12 : 24;
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
      uSmoke: { value: getSmokeTexture(compact) }, uColor: { value: new Color(color) },
      uOrb: { value: orb ? 1 : 0 },
      uColors: { value: Array.from({ length: 3 }, () => new Color(color)) },
      uColorCount: { value: 1 },
      uDensity: { value: compact ? 1.65 : 1.15 },
      uTrail: { value: Array.from({ length: 8 }, () => new Vector3()) },
      uMotion: { value: 0 }, uTime: { value: 0 }, uStrength: { value: 0 }, uSize: { value: size },
    },
    transparent: true, blending: NormalBlending, depthWrite: false,
    depthTest: true, toneMapped: false,
    vertexShader: `
      attribute vec4 aSeed;
      uniform float uTime, uSize, uOrb, uMotion, uColorCount;
      uniform vec3 uTrail[8], uColors[3], uColor;
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vFade, vLife;
      void main() {
        float index = floor(aSeed.x * ${count}.0 + 0.1);
        float life = fract(uTime * 0.075 + aSeed.x);
        vLife = life;
        float curl = uTime * 0.22 + aSeed.z * 6.283;
        // Each wisp keeps its own hue; no colour averaging or dark shell.
        int colorIndex = int(mod(index, uColorCount));
        vColor = uOrb > 0.5 ? uColors[colorIndex] : uColor;
        vec3 center = vec3(
          (aSeed.y - 0.5) * (0.3 + life * 0.6) + sin(curl) * 0.065,
          0.12 + life * 1.95,
          (aSeed.z - 0.5) * (0.3 + life * 0.5) + sin(curl * 0.8) * 0.05
        );
        float size = (0.38 + aSeed.w * 0.42) * (0.8 + life * 0.85);
        vFade = smoothstep(0.0, 0.18, life) * (1.0 - smoothstep(0.68, 1.0, life));
        if (uOrb > 0.5) {
          center = vec3((aSeed.y - 0.5) * (0.16 + life * 0.3) + sin(curl) * 0.025,
            -0.20 + life * 0.48, (aSeed.z - 0.5) * (0.14 + life * 0.28) + sin(curl * 0.8) * 0.02);
          size = (0.23 + aSeed.w * 0.22) * (0.85 + life * 0.4);
          // Cover the same trail length at either particle budget.
          int sampleIndex = int(floor(floor(index / 4.0) * 7.0 / ${count / 4 - 1}.0));
          center += uTrail[sampleIndex] * life;
          size *= 1.0 - uMotion * life * 0.2;
        }
        // Fixed texture orientation: curling comes from slow drift, never orbiting.
        float angle = aSeed.w * 6.283;
        vec2 corner = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * position.xy * vec2(size, size * (0.9 + aSeed.y * 0.4));
        vec4 viewCenter = modelViewMatrix * vec4(center * uSize, 1.0);
        // Fade before the cloud can enter the camera's near field.
        vFade *= smoothstep(0.45, 1.0, -viewCenter.z);
        viewCenter.xy += corner * uSize;
        gl_Position = projectionMatrix * viewCenter;
        vUv = uv;
      }
    `,
    fragmentShader: `
      uniform sampler2D uSmoke;
      uniform float uStrength, uDensity;
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vFade, vLife;
      void main() {
        // Small advection bends the internal cloud without rotating the particle.
        vec2 flowUv = vUv + vec2(sin(vUv.y * 6.0 + vLife * 2.0), sin(vUv.x * 5.0 - vLife)) * 0.025;
        vec4 cloud = texture2D(uSmoke, flowUv);
        float alpha = min(0.58, cloud.a * uDensity) * vFade * uStrength;
        if (alpha < 0.003) discard;
        // Scalar illumination gives volume while retaining each wisp's own hue.
        float light = 0.48 + cloud.r * 1.25;
        vec3 smokeColor = vColor * light;
        if (dot(vColor, vec3(1.0)) < 0.001) smokeColor = vec3(0.008) * light;
        gl_FragColor = vec4(smokeColor, alpha);
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
