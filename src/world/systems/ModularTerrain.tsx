import { groundSize, groundCenter } from "../worldLayout";
import { PlazaPaths } from "./PlazaPaths";
import { NearbyAsset } from "../NearbyAsset";
import { isCompactVisualBudget } from "../visualQuality";
import { assetForDevice } from "../mobileAssets";
import { WINTER_THEME_ENABLED } from "../winterTheme";
import { RoundedBoxGeometry } from "three-stdlib";
import { useTexture } from "@react-three/drei";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useMemo } from "react";
import {
  BufferGeometry,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshStandardMaterial,
  NoColorSpace,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  Vector2,
} from "three";
import { destinationPlatformRadius, hubSections, sectionRampApproachLength, sectionRampWidth } from "../hubSections";


export const concreteTexturePaths: string[] = [
  "/images/optimized/floor/world-weathered-concrete-seamless.webp",
  "/images/optimized/floor/world-weathered-concrete-bump.webp",
  "/images/optimized/floor/world-weathered-concrete-roughness.webp",
  "/images/optimized/floor/world-weathered-concrete-normal.webp",
];
const concreteNormalScale = new Vector2(0.55, 0.55);
const rampThickness = 0.36;
// Box surfaces retain this shared world-space scale. The main ground plane uses
// a tighter UV multiplier so its broad surface reads at the same visual density.
const concreteTextureWorldSize = 14;
const groundTextureScale = 1.12;

function configureFloorTexture(texture: Texture, repeat: number) {
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = isCompactVisualBudget() ? 1 : 4;
  texture.needsUpdate = true;
}

type ConcreteTextures = Texture[];

export function configureConcreteTextures(textures: ConcreteTextures) {
  textures.forEach((texture) => configureFloorTexture(texture, 1 / concreteTextureWorldSize));
  textures[0].colorSpace = SRGBColorSpace;
  textures[1].colorSpace = NoColorSpace;
  textures[2].colorSpace = NoColorSpace;
  textures[3].colorSpace = NoColorSpace;
}

export function createConcreteMaterial(textures: ConcreteTextures, color: string) {
  const material = new MeshStandardMaterial({
    bumpMap: textures[1],
    bumpScale: 0.025,
    color,
    envMapIntensity: 0.22,
    map: textures[0],
    metalness: 0.01,
    normalMap: textures[3],
    normalScale: concreteNormalScale,
    roughness: 1,
    roughnessMap: textures[2],
  });
  // Every surface samples the same world-space coordinates, independent of mesh UVs.
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = "varying vec3 vConcretePosition; varying float vConcreteTop;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <uv_vertex>", `
      #include <uv_vertex>
      vec3 groundWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      vec3 groundNormal = normalize(mat3(modelMatrix) * normal);
      vec2 groundUv = abs(groundNormal.y) > 0.5 ? groundWorld.xz
        : abs(groundNormal.x) > 0.5 ? groundWorld.zy : groundWorld.xy;
      groundUv /= 14.0;
      vMapUv = groundUv;
      vNormalMapUv = groundUv;
      vRoughnessMapUv = groundUv;
      vBumpMapUv = groundUv;
      vConcretePosition = groundWorld;
      vConcreteTop = groundNormal.y;
    `);
    shader.fragmentShader = "varying vec3 vConcretePosition; varying float vConcreteTop;\n" + shader.fragmentShader;
  };
  if (WINTER_THEME_ENABLED) {
    const concreteShader = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      concreteShader(shader, renderer);
      shader.fragmentShader = `
        // Smooth, deterministic world-space texture: no additional texture assets.
        float snowHash(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }
        float snowNoise(vec2 p) {
          vec2 cell = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(snowHash(cell), snowHash(cell + vec2(1.0, 0.0)), f.x),
                     mix(snowHash(cell + vec2(0.0, 1.0)), snowHash(cell + 1.0), f.x), f.y);
        }
      ` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <roughnessmap_fragment>", `
        #include <roughnessmap_fragment>
        // World-space worn asphalt, frozen soil and dirty snow share existing maps.
        vec2 snowUv = vConcretePosition.xz;
        float drift = snowNoise(snowUv * 0.24);
        float clumps = snowNoise(snowUv * 1.8 + vec2(13.2, 7.9));
        float grainVisible = 1.0 - smoothstep(0.35, 1.2, length(fwidth(snowUv * 24.0)));
        float grain = mix(0.5, snowNoise(snowUv * 24.0), grainVisible);
        float topSurface = smoothstep(0.72, 0.96, vConcreteTop);
        float snowCoverage = (0.72 + 0.28 * smoothstep(0.30, 0.65, drift + (clumps - 0.5) * 0.20)) * topSurface;
        float soil = smoothstep(0.38, 0.66, snowNoise(snowUv * 0.12 + 37.0));
        vec3 asphalt = diffuseColor.rgb * 0.7 + vec3(0.018, 0.022, 0.026);
        vec3 frozenDirt = vec3(0.105, 0.081, 0.064) * (0.72 + clumps * 0.5);
        vec3 wornGround = mix(asphalt, frozenDirt, soil * 0.8);
        // Irregular cell boundaries form cracks; derivatives soften distant detail.
        vec2 crackUv = snowUv * 0.85 + vec2(clumps * 0.2);
        vec2 crackCell = floor(crackUv);
        vec2 crackLocal = fract(crackUv);
        float nearest = 8.0;
        float secondNearest = 8.0;
        for (int cy = -1; cy <= 1; cy++) {
          for (int cx = -1; cx <= 1; cx++) {
            vec2 cell = vec2(float(cx), float(cy));
            vec2 seed = crackCell + cell;
            vec2 point = cell + vec2(snowHash(seed), snowHash(seed + 19.7)) - crackLocal;
            float distanceSquared = dot(point, point);
            secondNearest = min(secondNearest, max(nearest, distanceSquared));
            nearest = min(nearest, distanceSquared);
          }
        }
        float crackAA = max(length(fwidth(crackUv)), 0.006);
        float cracks = 1.0 - smoothstep(0.012, 0.012 + crackAA, secondNearest - nearest);
        wornGround *= 1.0 - cracks * 0.35;
        float grit = smoothstep(0.72, 0.84, grain) * grainVisible;
        wornGround = mix(wornGround, vec3(0.22, 0.20, 0.17), grit * 0.35);
        float fresh = smoothstep(0.48, 0.78, drift);
        vec3 snowColor = mix(vec3(0.29, 0.30, 0.30), vec3(0.52, 0.57, 0.61), fresh);
        snowColor *= 0.86 + clumps * 0.14;
        snowColor += (grain - 0.5) * 0.035;
        diffuseColor.rgb = mix(diffuseColor.rgb, wornGround, topSurface);
        diffuseColor.rgb = mix(diffuseColor.rgb, snowColor, snowCoverage);
        float exposedRoughness = mix(0.58, 0.91, clumps) * (0.85 + roughnessFactor * 0.15);
        roughnessFactor = mix(roughnessFactor, exposedRoughness, topSurface);
        roughnessFactor = mix(roughnessFactor, mix(0.88, 0.98, fresh), snowCoverage);
        float snowHeight = topSurface * ((clumps * 0.006 + grit * 0.003 - cracks * 0.008) * (1.0 - snowCoverage)
          + snowCoverage * (clumps * 0.018 + grain * 0.0025));
      `);
      shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_maps>", `
        #include <normal_fragment_maps>
        // Screen derivatives give the procedural texture actual light-responsive relief.
        vec3 snowDx = dFdx(-vViewPosition);
        vec3 snowDy = dFdy(-vViewPosition);
        vec3 snowR1 = cross(snowDy, normal);
        vec3 snowR2 = cross(normal, snowDx);
        float snowDet = dot(snowDx, snowR1);
        vec3 snowGradient = sign(snowDet) * (dFdx(snowHeight) * snowR1 + dFdy(snowHeight) * snowR2);
        normal = normalize(max(abs(snowDet), 0.000001) * normal - snowGradient);
      `);
      shader.fragmentShader = shader.fragmentShader.replace("#include <fog_fragment>", `
        #include <fog_fragment>
        // Subtle surface haze builds with viewing distance, never across labels or sky.
        float mist = (1.0 - exp(-length(vViewPosition) * 0.012)) * 0.12;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.36, 0.44, 0.53), mist * smoothstep(0.72, 0.96, vConcreteTop));
      `);
    };
    material.envMapIntensity = 0.12;
  }
  material.customProgramCacheKey = () => `studio-shared-snow-v5-${WINTER_THEME_ENABLED}`;
  return material;
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

export function createConcreteBoxGeometry(width: number, height: number, depth: number, offsetX = 0, offsetZ = 0) {
  return applyWorldScaleBoxUvs(new RoundedBoxGeometry(width, height, depth, 1, Math.min(0.06, height / 6)), offsetX, offsetZ);
}

function createConcreteFloorGeometry(width: number, depth: number) {
  const geometry = new PlaneGeometry(width, depth);
  const positions = geometry.getAttribute("position");
  const uvs = geometry.getAttribute("uv");
  for (let index = 0; index < positions.count; index += 1) {
    uvs.setXY(
      index,
      positions.getX(index) * groundTextureScale,
      positions.getY(index) * groundTextureScale,
    );
  }
  uvs.needsUpdate = true;
  return geometry;
}

/** One owner loads/configures/disposes the material used by all ground meshes. */
export function useSharedGroundMaterial() {
  const textures = useTexture(concreteTexturePaths.map(assetForDevice));
  const material = useMemo(() => {
    configureConcreteTextures(textures);
    return createConcreteMaterial(textures, "#46515d");
  }, [textures]);
  useEffect(() => () => material.dispose(), [material]);
  return material;
}

export function ModularTerrain({ material }: { material: MeshStandardMaterial }) {
  const floorGeometry = useMemo(() => createConcreteFloorGeometry(...groundSize), []);
  useEffect(() => () => floorGeometry.dispose(), [floorGeometry]);

  return (
    <group name="WeatheredConcreteTerrain">
      <RigidBody name="StudioCLTDFloor" type="fixed" colliders={false}>
        <CuboidCollider
          position={[groundCenter[0], -0.09, groundCenter[1]]}
          args={[groundSize[0] / 2, 0.09, groundSize[1] / 2]}
          friction={0}
          restitution={0.18}
        />
      </RigidBody>
      <mesh position={[groundCenter[0], 0, groundCenter[1]]} rotation-x={-Math.PI / 2} receiveShadow>
        <primitive object={floorGeometry} attach="geometry" />
        <primitive object={material} attach="material" dispose={null} />
      </mesh>
      <PlazaPaths material={material} />
      {hubSections.map((section) => (
        <DestinationPlatform key={section.id} material={material} section={section} />
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

  return (
    <group name={`DestinationPlatform:${section.id}`}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[destinationPlatformRadius, height / 2, destinationPlatformRadius]}
          position={[x, height / 2, z]}
          friction={0.35}
        />
        <NearbyAsset position={section.position}>
          <PlatformVisual material={material} size={[destinationPlatformRadius * 2, height, destinationPlatformRadius * 2]}
            origin={[x, z]} position={[x, height / 2, z]} />
        </NearbyAsset>
      </RigidBody>
      <RigidBody type="fixed" colliders={false} position={[bridgeX, bridgeCenterY, bridgeZ]} rotation={[0, yaw, 0]}>
        <CuboidCollider
          args={[sectionRampWidth / 2, rampThickness / 2, bridgeLength / 2]}
          rotation={[bridgeAngle, 0, 0]}
          friction={0.35}
        />
        <NearbyAsset position={section.position}>
          <PlatformVisual material={material} size={[sectionRampWidth, rampThickness, bridgeLength]}
            origin={[bridgeX, bridgeZ]} rotation={bridgeAngle} />
        </NearbyAsset>
      </RigidBody>
    </group>
  );
}

function PlatformVisual({ material, size: [width, height, depth], origin: [x, z], position, rotation = 0 }: {
  material: MeshStandardMaterial; size: [number, number, number]; origin: [number, number];
  position?: [number, number, number]; rotation?: number;
}) {
  const geometry = useMemo(() => createConcreteBoxGeometry(width, height, depth, x, z), [width, height, depth, x, z]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh position={position} rotation-x={rotation} material={material} castShadow receiveShadow>
    <primitive object={geometry} attach="geometry" />
  </mesh>;
}
