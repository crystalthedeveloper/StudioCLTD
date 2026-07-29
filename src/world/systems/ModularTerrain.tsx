import { useTexture } from "@react-three/drei";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, Texture, Vector2 } from "three";

type ModularTerrainProps = {
  radius: number;
};

const floorTexturePaths = [
  "/images/optimized/floor/plaza-microcement-albedo.webp",
  "/images/optimized/floor/plaza-microcement-normal.webp",
  "/images/optimized/floor/plaza-microcement-roughness.webp",
];
const floorNormalScale = new Vector2(0.04, 0.04);

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
  const [albedoMap, normalMap, roughnessMap] = useTexture(floorTexturePaths);
  const textureRepeat = platformSize / 40;

  configureFloorTexture(albedoMap, textureRepeat);
  configureFloorTexture(normalMap, textureRepeat);
  configureFloorTexture(roughnessMap, textureRepeat);
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
          map={albedoMap}
          normalMap={normalMap}
          normalScale={floorNormalScale}
          roughnessMap={roughnessMap}
          roughness={1}
          metalness={0}
          envMapIntensity={0.18}
        />
      </mesh>
    </group>
  );
}
