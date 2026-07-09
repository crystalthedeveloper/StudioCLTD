import {
  BackSide,
  Color,
  LinearFilter,
  SRGBColorSpace,
} from "three";
import { useTexture } from "@react-three/drei";

const earthTexturePath = "/images/optimized/earth-nightmap-1k.jpg";
const venusTexturePath = "/images/optimized/venus-surface-1k.jpg";
const skyTexturePath = "/images/optimized/stars-milky-way-2k.jpg";

export function SpaceSky() {
  const earthTexture = useTexture(earthTexturePath);
  const venusTexture = useTexture(venusTexturePath);
  const skyTexture = useTexture(skyTexturePath);
  earthTexture.colorSpace = SRGBColorSpace;
  venusTexture.colorSpace = SRGBColorSpace;
  skyTexture.colorSpace = SRGBColorSpace;
  [earthTexture, venusTexture, skyTexture].forEach((texture) => {
    texture.generateMipmaps = false;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
  });

  return (
    <group>
      <mesh position={[0, 0, 0]} rotation={[0.12, 2.25, 0]} renderOrder={-1000} frustumCulled={false}>
        <sphereGeometry args={[5000, 32, 24]} />
        <meshBasicMaterial
          map={skyTexture}
          color="#6f7480"
          side={BackSide}
          depthWrite={false}
          depthTest={false}
          fog={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[68, 32, -210]} rotation={[0.08, -0.48, 0]}>
        <sphereGeometry args={[22, 32, 24]} />
        <meshStandardMaterial
          map={venusTexture}
          color={new Color("#ffbf6a")}
          emissive="#5d2414"
          emissiveIntensity={0.12}
          metalness={0}
          roughness={0.72}
          envMapIntensity={0.55}
        />
      </mesh>
      <mesh position={[68, 32, -210]} scale={[1.08, 1.08, 1.08]}>
        <sphereGeometry args={[22, 24, 16]} />
        <meshBasicMaterial color="#ffb75f" transparent opacity={0.16} depthWrite={false} side={BackSide} />
      </mesh>
      <mesh position={[-135, 40, 165]} rotation={[0.08, 0.64, -0.06]}>
        <sphereGeometry args={[17, 32, 24]} />
        <meshStandardMaterial
          map={earthTexture}
          emissiveMap={earthTexture}
          emissive="#7fb5ff"
          emissiveIntensity={0.28}
          metalness={0}
          roughness={0.66}
          envMapIntensity={0.45}
        />
      </mesh>
      <mesh position={[-135, 40, 165]} scale={[1.09, 1.09, 1.09]}>
        <sphereGeometry args={[17, 24, 16]} />
        <meshBasicMaterial color="#6ca8ff" transparent opacity={0.11} depthWrite={false} side={BackSide} />
      </mesh>
    </group>
  );
}
