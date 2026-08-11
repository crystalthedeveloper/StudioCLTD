import { useTexture } from "@react-three/drei";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useMemo } from "react";
import {
  BoxGeometry,
  BufferGeometry,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshToonMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
} from "three";
import { comicToneGradient } from "../../characters/cartoonMaterials";
import { destinationPlatformRadius, hubSections, sectionRampApproachLength, sectionRampWidth } from "../hubSections";
import { InteractiveMeshOutline } from "../InteractiveOutline";

type ModularTerrainProps = {
  radius: number;
};

const comicConcreteTexturePath = "/images/optimized/floor/world-comic-concrete.webp";
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

function applyWorldScaleBoxUvs(geometry: BufferGeometry, offsetX = 0, offsetZ = 0) {
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
      uvs.setXY(index, x + offsetX, normalY > 0 ? -(z + offsetZ) : z + offsetZ);
    } else if (Math.abs(normalX) > 0.5) {
      uvs.setXY(index, normalX > 0 ? -(z + offsetZ) : z + offsetZ, y);
    } else {
      uvs.setXY(index, normalZ > 0 ? x + offsetX : -(x + offsetX), y);
    }
  }

  uvs.needsUpdate = true;
  return geometry;
}

function createConcreteBoxGeometry(width: number, height: number, depth: number, offsetX = 0, offsetZ = 0) {
  return applyWorldScaleBoxUvs(new BoxGeometry(width, height, depth), offsetX, offsetZ);
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
  const concreteMap = useTexture(comicConcreteTexturePath);
  const textureRepeat = 1 / concreteTextureWorldSize;
  const floorGeometry = useMemo(() => createConcreteFloorGeometry(platformSize), [platformSize]);

  configureFloorTexture(concreteMap, textureRepeat);
  concreteMap.colorSpace = SRGBColorSpace;
  const floorMaterial = useMemo(() => new MeshToonMaterial({
    color: "#e0e0e0",
    gradientMap: comicToneGradient,
    map: concreteMap,
  }), [concreteMap]);
  const platformMaterial = useMemo(() => new MeshToonMaterial({
    color: "#c5c5c5",
    gradientMap: comicToneGradient,
    map: concreteMap,
  }), [concreteMap]);

  useEffect(() => () => floorMaterial.dispose(), [floorMaterial]);
  useEffect(() => () => platformMaterial.dispose(), [platformMaterial]);
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
        <primitive object={floorMaterial} attach="material" />
      </mesh>
      {hubSections.map((section) => (
        <DestinationPlatform key={section.id} material={platformMaterial} section={section} />
      ))}
    </group>
  );
}

function DestinationPlatform({
  material,
  section,
}: {
  material: MeshToonMaterial;
  section: (typeof hubSections)[number];
}) {
  const [x, height, z] = section.position;
  const [directionX, directionZ] = section.entrance;
  const bridgeRun = sectionRampApproachLength;
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
    () => createConcreteBoxGeometry(destinationPlatformRadius * 2, height, destinationPlatformRadius * 2, x, z),
    [height, x, z],
  );
  const rampGeometry = useMemo(
    () => createConcreteBoxGeometry(sectionRampWidth, rampThickness, bridgeLength, bridgeX, bridgeZ),
    [bridgeLength, bridgeX, bridgeZ],
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
          <InteractiveMeshOutline />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders={false} position={[bridgeX, bridgeCenterY, bridgeZ]} rotation={[0, yaw, 0]}>
        <CuboidCollider
          args={[sectionRampWidth / 2, rampThickness / 2, bridgeLength / 2]}
          rotation={[bridgeAngle, 0, 0]}
          friction={0.35}
        />
        <mesh
          material={material}
          rotation-x={bridgeAngle}
        >
          <primitive object={rampGeometry} attach="geometry" />
          <InteractiveMeshOutline />
        </mesh>
      </RigidBody>
    </group>
  );
}
