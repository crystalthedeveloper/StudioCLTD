import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  BackSide,
  Color,
  Float32BufferAttribute,
  Group,
  LinearFilter,
  Matrix4,
  MeshToonMaterial,
  Quaternion,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  Vector3,
} from "three";
import { comicToneGradient } from "../../characters/cartoonMaterials";
import { InteractiveMeshOutline } from "../InteractiveOutline";

const earthTexturePath = "/images/optimized/earth-nightmap-1k.jpg";
const venusTexturePath = "/images/optimized/venus-surface-1k.jpg";

// A single modest sphere is shared by every puff. The extra radial segments
// soften silhouettes without multiplying geometry memory per cloud.
const cloudGeometry = new SphereGeometry(1, 16, 12);
const cloudMaterial = new MeshToonMaterial({
  color: "#ffffff",
  fog: false,
  gradientMap: comicToneGradient,
  vertexColors: true,
});

type CloudProps = {
  position: [number, number, number];
  scale: number;
  speed: number;
  variant: number;
  rotation?: number;
};

type Puff = {
  position: [number, number, number];
  scale: [number, number, number];
};

const cloudPuffLayouts: Puff[][] = [
  [
    { position: [-3.05, 0.06, 0.04], scale: [1.38, 1.02, 1.18] },
    { position: [-1.82, 0.4, 0], scale: [1.52, 1.3, 1.32] },
    { position: [-0.42, 0.86, -0.05], scale: [1.68, 1.62, 1.46] },
    { position: [1.02, 0.65, 0.03], scale: [1.55, 1.43, 1.35] },
    { position: [2.35, 0.25, 0.04], scale: [1.4, 1.12, 1.2] },
    { position: [3.42, 0, 0], scale: [1.02, 0.82, 0.98] },
  ],
  [
    { position: [-2.82, 0.03, 0], scale: [1.22, 0.92, 1.08] },
    { position: [-1.62, 0.36, 0.07], scale: [1.55, 1.22, 1.3] },
    { position: [-0.22, 0.52, 0], scale: [1.48, 1.36, 1.4] },
    { position: [1.12, 1.08, -0.05], scale: [1.68, 1.7, 1.48] },
    { position: [2.42, 0.4, 0.03], scale: [1.48, 1.18, 1.28] },
    { position: [3.45, 0.02, 0], scale: [1.02, 0.8, 0.96] },
  ],
  [
    { position: [-3.32, 0, 0], scale: [1.12, 0.84, 1.02] },
    { position: [-2.16, 0.3, 0.06], scale: [1.42, 1.18, 1.24] },
    { position: [-0.8, 0.74, -0.04], scale: [1.6, 1.48, 1.42] },
    { position: [0.66, 0.8, 0], scale: [1.78, 1.58, 1.52] },
    { position: [2.08, 0.4, 0.05], scale: [1.5, 1.22, 1.3] },
    { position: [3.28, 0.03, 0], scale: [1.16, 0.88, 1.04] },
  ],
  [
    { position: [-3.08, 0.03, 0.03], scale: [1.18, 0.88, 1.05] },
    { position: [-1.9, 0.48, 0], scale: [1.5, 1.28, 1.3] },
    { position: [-0.55, 1.04, -0.04], scale: [1.58, 1.66, 1.44] },
    { position: [0.82, 0.5, 0.05], scale: [1.46, 1.24, 1.28] },
    { position: [2.15, 0.76, 0], scale: [1.55, 1.48, 1.36] },
    { position: [3.38, 0.05, 0], scale: [1.05, 0.82, 0.98] },
  ],
];

const cloudTopColor = new Color("#fffdf1");
const cloudUndersideColor = new Color("#f3f6f5");
const puffQuaternion = new Quaternion();

const cloudGeometries = cloudPuffLayouts.map((layout) => {
  const puffs = layout.map((puff) => {
    const geometry = cloudGeometry.clone();
    const transform = new Matrix4().compose(
      new Vector3(...puff.position),
      puffQuaternion,
      new Vector3(...puff.scale),
    );
    geometry.applyMatrix4(transform);
    return geometry;
  });
  const geometry = mergeGeometries(puffs, false);
  puffs.forEach((puff) => puff.dispose());
  if (!geometry) throw new Error("Unable to build cartoon cloud geometry");

  const positions = geometry.getAttribute("position");
  const colors: number[] = [];
  const color = new Color();
  for (let index = 0; index < positions.count; index += 1) {
    const blend = Math.max(0, Math.min(1, (positions.getY(index) + 0.5) / 1.25));
    color.copy(cloudUndersideColor).lerp(cloudTopColor, blend);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
});

function CartoonCloud({ position, rotation = 0, scale, speed, variant }: CloudProps) {
  const cloudRef = useRef<Group>(null);
  const startX = position[0];
  const phase = useMemo(() => Math.abs(position[0] * 0.17 + position[2] * 0.11), [position]);

  useFrame(({ clock }) => {
    if (!cloudRef.current) return;
    const time = clock.getElapsedTime();
    cloudRef.current.position.x = startX + Math.sin(time * speed + phase) * 2.5;
    cloudRef.current.position.y = position[1] + Math.sin(time * speed * 0.55 + phase) * 0.45;
  });

  return (
    <group ref={cloudRef} position={position} rotation-y={rotation} scale={scale}>
      <mesh geometry={cloudGeometries[variant % cloudGeometries.length]} material={cloudMaterial}>
        <InteractiveMeshOutline />
      </mesh>
    </group>
  );
}

const clouds: CloudProps[] = [
  { position: [-92, 48, -150], scale: 3.5, speed: 0.028, variant: 0, rotation: 0.08 },
  { position: [112, 68, -175], scale: 5.1, speed: 0.021, variant: 1, rotation: -0.16 },
  { position: [-175, 76, -72], scale: 7.8, speed: 0.017, variant: 2, rotation: 0.2 },
  { position: [178, 50, 48], scale: 2.4, speed: 0.024, variant: 3, rotation: -0.24 },
  { position: [72, 82, 168], scale: 6.2, speed: 0.019, variant: 0, rotation: 0.14 },
  { position: [-48, 58, 202], scale: 2.9, speed: 0.026, variant: 2, rotation: -0.08 },
  { position: [16, 105, -225], scale: 4.4, speed: 0.014, variant: 3, rotation: 0.18 },
];

function configurePlanetTexture(texture: Texture) {
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
}

export function SpaceSky() {
  const earthTexture = useTexture(earthTexturePath);
  const venusTexture = useTexture(venusTexturePath);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    configurePlanetTexture(earthTexture);
    configurePlanetTexture(venusTexture);
    invalidate();
  }, [earthTexture, invalidate, venusTexture]);

  return (
    <group>
      <mesh renderOrder={-1000} frustumCulled={false}>
        <sphereGeometry args={[5000, 32, 16]} />
        <meshBasicMaterial
          color="#62bff5"
          side={BackSide}
          depthWrite={false}
          depthTest={false}
          fog={false}
          toneMapped={false}
        />
      </mesh>

      {clouds.map((cloud) => (
        <CartoonCloud key={cloud.position.join(":")} {...cloud} />
      ))}

      <mesh position={[68, 42, -210]} rotation={[0.08, -0.48, 0]}>
        <sphereGeometry args={[22, 32, 24]} />
        <meshToonMaterial
          map={venusTexture}
          color={new Color("#ffd08a")}
          emissive="#8d4725"
          emissiveIntensity={0.1}
          gradientMap={comicToneGradient}
          fog={false}
        />
        <InteractiveMeshOutline />
      </mesh>
      <mesh position={[68, 42, -210]} scale={[1.08, 1.08, 1.08]}>
        <sphereGeometry args={[22, 24, 16]} />
        <meshBasicMaterial color="#ffd197" transparent opacity={0.18} depthWrite={false} side={BackSide} fog={false} />
      </mesh>

      <mesh position={[-135, 48, 165]} rotation={[0.08, 0.64, -0.06]}>
        <sphereGeometry args={[17, 32, 24]} />
        <meshToonMaterial
          map={earthTexture}
          emissiveMap={earthTexture}
          emissive="#86bfff"
          emissiveIntensity={0.2}
          gradientMap={comicToneGradient}
          fog={false}
        />
        <InteractiveMeshOutline />
      </mesh>
      <mesh position={[-135, 48, 165]} scale={[1.09, 1.09, 1.09]}>
        <sphereGeometry args={[17, 24, 16]} />
        <meshBasicMaterial color="#b8dcff" transparent opacity={0.16} depthWrite={false} side={BackSide} fog={false} />
      </mesh>
    </group>
  );
}
