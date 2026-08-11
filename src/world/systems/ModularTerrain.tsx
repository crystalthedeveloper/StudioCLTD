import { useTexture } from "@react-three/drei";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useMemo } from "react";
import {
  BoxGeometry,
  BufferGeometry,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  Vector2,
} from "three";
import { destinationPlatformRadius, hubSections } from "../hubSections";

type ModularTerrainProps = {
  radius: number;
};

const floorTexturePaths = [
  "/images/optimized/floor/plaza-microcement-albedo.webp",
  "/images/optimized/floor/plaza-microcement-normal.webp",
  "/images/optimized/floor/plaza-microcement-roughness.webp",
];
const bridgeWidth = 4.2;
const rampApproachLength = 14;
const rampThickness = 0.36;
const concreteTextureWorldSize = 48;

function configureFloorTexture(texture: Texture, repeat: number) {
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
}

function applyWorldScaleBoxUvs(geometry: BufferGeometry) {
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const uvs = geometry.getAttribute("uv");

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const normalX = normals.getX(index);
    const normalY = normals.getY(index);
    const normalZ = normals.getZ(index);

    if (Math.abs(normalY) > 0.5) {
      uvs.setXY(index, x, normalY > 0 ? -z : z);
    } else if (Math.abs(normalX) > 0.5) {
      uvs.setXY(index, normalX > 0 ? -z : z, y);
    } else {
      uvs.setXY(index, normalZ > 0 ? x : -x, y);
    }
  }

  uvs.needsUpdate = true;
  return geometry;
}

function createConcreteBoxGeometry(width: number, height: number, depth: number) {
  return applyWorldScaleBoxUvs(new BoxGeometry(width, height, depth));
}

function createConcreteFloorGeometry(size: number) {
  const geometry = new PlaneGeometry(size, size);
  const positions = geometry.getAttribute("position");
  const uvs = geometry.getAttribute("uv");
  for (let index = 0; index < positions.count; index += 1) {
    uvs.setXY(index, positions.getX(index), positions.getY(index));
  }
  uvs.needsUpdate = true;
  return geometry;
}

export function ModularTerrain({ radius }: ModularTerrainProps) {
  const platformSize = radius * 20 + 10;
  const [albedoMap, normalMap, roughnessMap] = useTexture(floorTexturePaths);
  const textureRepeat = 1 / concreteTextureWorldSize;
  const floorGeometry = useMemo(() => createConcreteFloorGeometry(platformSize), [platformSize]);

  configureFloorTexture(albedoMap, textureRepeat);
  configureFloorTexture(normalMap, textureRepeat);
  configureFloorTexture(roughnessMap, textureRepeat);
  albedoMap.colorSpace = SRGBColorSpace;
  const sharedFloorMaterial = useMemo(() => new MeshStandardMaterial({
    color: "#d8d8d8",
    map: albedoMap,
    normalMap,
    normalScale: new Vector2(0.07, 0.07),
    roughnessMap,
    roughness: 0.92,
    metalness: 0,
    envMapIntensity: 0.08,
  }), [albedoMap, normalMap, roughnessMap]);

  useEffect(() => () => sharedFloorMaterial.dispose(), [sharedFloorMaterial]);
  useEffect(() => () => floorGeometry.dispose(), [floorGeometry]);

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
        <primitive object={floorGeometry} attach="geometry" />
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
  const [directionX, directionZ] = section.entrance;
  const bridgeRun = rampApproachLength;
  const bridgeAngle = Math.atan2(height, bridgeRun);
  const bridgeLength = Math.hypot(bridgeRun, height);
  const bridgeCenterOffset = destinationPlatformRadius
    + bridgeRun / 2
    - (rampThickness / 2) * Math.sin(bridgeAngle);
  const bridgeCenterY = height / 2 - (rampThickness / 2) * Math.cos(bridgeAngle);
  const bridgeX = x + directionX * bridgeCenterOffset;
  const bridgeZ = z + directionZ * bridgeCenterOffset;
  const yaw = Math.atan2(directionX, directionZ);
  const platformGeometry = useMemo(
    () => createConcreteBoxGeometry(destinationPlatformRadius * 2, height, destinationPlatformRadius * 2),
    [height],
  );
  const rampGeometry = useMemo(
    () => createConcreteBoxGeometry(bridgeWidth, rampThickness, bridgeLength),
    [bridgeLength],
  );

  useEffect(() => () => platformGeometry.dispose(), [platformGeometry]);
  useEffect(() => () => rampGeometry.dispose(), [rampGeometry]);

  return (
    <group name={`DestinationPlatform:${section.id}`}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[destinationPlatformRadius, height / 2, destinationPlatformRadius]}
          position={[x, height / 2, z]}
          friction={0.35}
        />
        <mesh position={[x, height / 2, z]} material={material}>
          <primitive object={platformGeometry} attach="geometry" />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders={false} position={[bridgeX, bridgeCenterY, bridgeZ]} rotation={[0, yaw, 0]}>
        <CuboidCollider
          args={[bridgeWidth / 2, rampThickness / 2, bridgeLength / 2]}
          rotation={[bridgeAngle, 0, 0]}
          friction={0.35}
        />
        <mesh
          material={material}
          rotation-x={bridgeAngle}
        >
          <primitive object={rampGeometry} attach="geometry" />
        </mesh>
      </RigidBody>
    </group>
  );
}
