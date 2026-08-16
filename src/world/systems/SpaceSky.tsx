import { useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import {
  BackSide,
  EquirectangularReflectionMapping,
  LinearFilter,
  SRGBColorSpace,
  Texture,
} from "three";

const cosmicSkyTexturePath = "/images/optimized/milky-way-clean-night-fewer-stars-4k.webp";
const earthTexturePath = "/images/optimized/earth-nightmap-2k.webp";
const venusTexturePath = "/images/optimized/venus-surface-2k.webp";

function configureSkyTexture(texture: Texture) {
  texture.colorSpace = SRGBColorSpace;
  texture.mapping = EquirectangularReflectionMapping;
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
}

function configurePlanetTexture(texture: Texture) {
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
}

export function SpaceSky() {
  const cosmicSkyTexture = useTexture(cosmicSkyTexturePath);
  const earthTexture = useTexture(earthTexturePath);
  const venusTexture = useTexture(venusTexturePath);
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    configureSkyTexture(cosmicSkyTexture);
    configurePlanetTexture(earthTexture);
    configurePlanetTexture(venusTexture);
    const previousBackground = scene.background;
    const previousBackgroundBlurriness = scene.backgroundBlurriness;
    const previousBackgroundIntensity = scene.backgroundIntensity;

    scene.background = cosmicSkyTexture;
    scene.backgroundBlurriness = 0;
    scene.backgroundIntensity = 1;
    invalidate();

    return () => {
      scene.background = previousBackground;
      scene.backgroundBlurriness = previousBackgroundBlurriness;
      scene.backgroundIntensity = previousBackgroundIntensity;
    };
  }, [cosmicSkyTexture, earthTexture, invalidate, scene, venusTexture]);

  return (
    <group name="CosmicPlanets">
      <mesh position={[68, 42, -210]} rotation={[0.08, -0.48, 0]}>
        <sphereGeometry args={[22, 24, 18]} />
        <meshStandardMaterial
          map={venusTexture}
          color="#e9b57f"
          emissive="#59311f"
          emissiveIntensity={0.025}
          fog={false}
          metalness={0}
          roughness={0.9}
        />
      </mesh>
      <mesh position={[68, 42, -210]} scale={[1.08, 1.08, 1.08]}>
        <sphereGeometry args={[22, 24, 16]} />
        <meshBasicMaterial
          color="#9a78aa"
          transparent
          opacity={0.1}
          depthWrite={false}
          side={BackSide}
          fog={false}
        />
      </mesh>

      <mesh position={[-135, 48, 165]} rotation={[0.08, 0.64, -0.06]}>
        <sphereGeometry args={[17, 24, 18]} />
        <meshStandardMaterial
          map={earthTexture}
          color="#a8cbd4"
          emissive="#294f68"
          emissiveIntensity={0.025}
          fog={false}
          metalness={0}
          roughness={0.92}
        />
      </mesh>
      <mesh position={[-135, 48, 165]} scale={[1.09, 1.09, 1.09]}>
        <sphereGeometry args={[17, 24, 16]} />
        <meshBasicMaterial
          color="#759fc2"
          transparent
          opacity={0.1}
          depthWrite={false}
          side={BackSide}
          fog={false}
        />
      </mesh>
    </group>
  );
}
