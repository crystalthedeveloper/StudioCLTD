import { useTexture } from "@react-three/drei";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useMemo } from "react";
import { LinearFilter, LinearMipmapLinearFilter, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, Texture } from "three";
import { hubSections } from "../hubSections";

type ModularTerrainProps = {
  radius: number;
};

const floorTexturePath = "/images/optimized/floor/plaza-sci-fi-panels.webp";
const destinationPlatformRadius = 14;
const bridgeStartRadius = 24;
const bridgeWidth = 4.2;

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
  const sharedFloorMaterial = useMemo(() => new MeshStandardMaterial({
    color: "#9ca1a9",
    map: albedoMap,
    roughness: 0.74,
    metalness: 0.22,
    envMapIntensity: 0.14,
  }), [albedoMap]);

  useEffect(() => () => sharedFloorMaterial.dispose(), [sharedFloorMaterial]);

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
        <primitive object={sharedFloorMaterial} attach="material" />
      </mesh>
      {hubSections.map((section) => (
        <DestinationPlatform key={section.id} material={sharedFloorMaterial} section={section} />
      ))}
    </group>
  );
}

function DestinationPlatform({
  material,
  section,
}: {
  material: MeshStandardMaterial;
  section: (typeof hubSections)[number];
}) {
  const [x, height, z] = section.position;
  const distance = Math.hypot(x, z);
  const directionX = x / distance;
  const directionZ = z / distance;
  const bridgeEndRadius = distance - destinationPlatformRadius + 1.2;
  const bridgeRun = bridgeEndRadius - bridgeStartRadius;
  const bridgeLength = Math.hypot(bridgeRun, height);
  const bridgeAngle = Math.atan2(height, bridgeRun);
  const bridgeCenterRadius = (bridgeStartRadius + bridgeEndRadius) / 2;
  const yaw = Math.atan2(directionX, directionZ);

  return (
    <group name={`DestinationPlatform:${section.id}`}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider
          args={[height / 2, destinationPlatformRadius]}
          position={[x, height / 2, z]}
          friction={0.35}
        />
        <mesh position={[x, height / 2, z]} material={material}>
          <cylinderGeometry args={[destinationPlatformRadius, destinationPlatformRadius, height, 12]} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders={false} rotation={[0, yaw, 0]}>
        <CuboidCollider
          args={[bridgeWidth / 2, 0.18, bridgeLength / 2]}
          position={[0, height / 2, bridgeCenterRadius]}
          rotation={[-bridgeAngle, 0, 0]}
          friction={0.35}
        />
        <mesh
          material={material}
          position={[0, height / 2, bridgeCenterRadius]}
          rotation-x={-bridgeAngle}
        >
          <boxGeometry args={[bridgeWidth, 0.36, bridgeLength]} />
        </mesh>
      </RigidBody>
    </group>
  );
}
