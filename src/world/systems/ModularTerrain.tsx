import { useTexture } from "@react-three/drei";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, Texture } from "three";

type ModularTerrainProps = {
  radius: number;
};

const floorTexturePath = "/images/optimized/floor/plaza-sci-fi-panels.webp";

function configureFloorTexture(texture: Texture, repeat: number) {
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
}

export function ModularTerrain({ radius }: ModularTerrainProps) {
  const platformSize = radius * 20 + 10;
  const albedoMap = useTexture(floorTexturePath);
  const textureRepeat = platformSize / 36;

  configureFloorTexture(albedoMap, textureRepeat);
  albedoMap.colorSpace = SRGBColorSpace;

  return (
    <group name="PremiumMicrocementFloor">
      <RigidBody name="StudioCLTDFloor" type="fixed" colliders={false}>
        <CuboidCollider
          position={[0, -0.09, 0]}
          args={[platformSize / 2, 0.09, platformSize / 2]}
          friction={0}
          restitution={0.18}
        />
      </RigidBody>
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[platformSize, platformSize, 1, 1]} />
        <meshStandardMaterial
          color="#9ca1a9"
          map={albedoMap}
          roughness={0.74}
          metalness={0.22}
          envMapIntensity={0.14}
        />
      </mesh>
    </group>
  );
}
