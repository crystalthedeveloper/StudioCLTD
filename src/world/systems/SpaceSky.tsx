import { useTexture } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import {
  BackSide,
  Color,
  Group,
  LinearFilter,
  SRGBColorSpace,
  Texture,
} from "three";

const cloudTexturePath = "/images/optimized/cinematic-cloud-layer.webp";
const moonTexturePath = "/images/optimized/2k_moon.webp";
const venusTexturePath = "/images/optimized/venus-surface-2k.webp";
const cinematicSkyColor = new Color("#010205");

function configureCloudTexture(texture: Texture) {
  texture.colorSpace = SRGBColorSpace;
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
  const cloudTexture = useTexture(cloudTexturePath);
  const moonTexture = useTexture(moonTexturePath);
  const venusTexture = useTexture(venusTexturePath);
  const nearCloudGroupRef = useRef<Group>(null);
  const middleCloudGroupRef = useRef<Group>(null);
  const farCloudGroupRef = useRef<Group>(null);
  const skyGroupRef = useRef<Group>(null);
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    configureCloudTexture(cloudTexture);
    configurePlanetTexture(moonTexture);
    configurePlanetTexture(venusTexture);
    const previousBackground = scene.background;
    const previousBackgroundBlurriness = scene.backgroundBlurriness;
    const previousBackgroundIntensity = scene.backgroundIntensity;

    scene.background = cinematicSkyColor;
    scene.backgroundBlurriness = 0;
    scene.backgroundIntensity = 1;
    invalidate();

    return () => {
      scene.background = previousBackground;
      scene.backgroundBlurriness = previousBackgroundBlurriness;
      scene.backgroundIntensity = previousBackgroundIntensity;
    };
  }, [cloudTexture, invalidate, moonTexture, scene, venusTexture]);

  useFrame(({ camera }, delta) => {
    const frameDelta = Math.min(delta, 1 / 30);
    if (skyGroupRef.current) {
      skyGroupRef.current.position.x = camera.position.x;
      skyGroupRef.current.position.z = camera.position.z;
    }
    if (nearCloudGroupRef.current) nearCloudGroupRef.current.rotation.y += frameDelta * 0.0028;
    if (middleCloudGroupRef.current) middleCloudGroupRef.current.rotation.y -= frameDelta * 0.0019;
    if (farCloudGroupRef.current) farCloudGroupRef.current.rotation.y += frameDelta * 0.0012;
  });

  return (
    <group ref={skyGroupRef} name="CinematicSky">
      <group ref={nearCloudGroupRef} name="NearSlowCloudLayers">
        <sprite position={[0, 108, -430]} scale={[260, 118, 1]} renderOrder={-100}>
          <spriteMaterial map={cloudTexture} color="#b2b8be" opacity={0.302} transparent alphaTest={0.01} depthWrite={false} fog={false} toneMapped={false} rotation={-0.04} />
        </sprite>
        <sprite position={[420, 92, -280]} scale={[235, 106, 1]} renderOrder={-100}>
          <spriteMaterial map={cloudTexture} color="#a5abb1" opacity={0.246} transparent alphaTest={0.01} depthWrite={false} fog={false} toneMapped={false} rotation={0.06} />
        </sprite>
      </group>

      <group ref={middleCloudGroupRef} name="MiddleSlowCloudLayers">
        <sprite position={[-380, 86, -120]} scale={[225, 102, 1]} renderOrder={-100}>
          <spriteMaterial map={cloudTexture} color="#a3aab0" opacity={0.235} transparent alphaTest={0.01} depthWrite={false} fog={false} toneMapped={false} rotation={0.08} />
        </sprite>
        <sprite position={[90, 74, 475]} scale={[270, 120, 1]} renderOrder={-100}>
          <spriteMaterial map={cloudTexture} color="#a9afb5" opacity={0.224} transparent alphaTest={0.01} depthWrite={false} fog={false} toneMapped={false} rotation={-0.07} />
        </sprite>
      </group>

      <group ref={farCloudGroupRef} name="FarSlowCloudLayers">
        <sprite position={[330, 126, 170]} scale={[245, 110, 1]} renderOrder={-100}>
          <spriteMaterial map={cloudTexture} color="#adb3b9" opacity={0.258} transparent alphaTest={0.01} depthWrite={false} fog={false} toneMapped={false} rotation={-0.1} />
        </sprite>
        <sprite position={[-240, 148, -520]} scale={[290, 128, 1]} renderOrder={-100}>
          <spriteMaterial map={cloudTexture} color="#9ea5ac" opacity={0.202} transparent alphaTest={0.01} depthWrite={false} fog={false} toneMapped={false} rotation={0.11} />
        </sprite>
      </group>

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
          map={moonTexture}
          color="#c8c5be"
          emissive="#26282b"
          emissiveIntensity={0.018}
          fog={false}
          metalness={0}
          roughness={0.92}
        />
      </mesh>
      <mesh position={[-135, 48, 165]} scale={[1.09, 1.09, 1.09]}>
        <sphereGeometry args={[17, 24, 16]} />
        <meshBasicMaterial
          color="#aeb5bc"
          transparent
          opacity={0.1}
          depthWrite={false}
          side={BackSide}
          fog={false}
        />
      </mesh>
      </group>
    </group>
  );
}
