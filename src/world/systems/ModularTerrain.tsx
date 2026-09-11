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

type ModularTerrainProps = {
  radius: number;
};

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
  texture.anisotropy = 4;
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
  // World-space joints and broad wear variation reuse the existing material:
  // no decal meshes, texture downloads, colliders or extra draw calls.
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = "varying vec3 vConcretePosition; varying float vConcreteTop;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <worldpos_vertex>", `
      #include <worldpos_vertex>
      vConcretePosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vConcreteTop = normalize(mat3(modelMatrix) * normal).y;
    `);
    shader.fragmentShader = "varying vec3 vConcretePosition; varying float vConcreteTop;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `
      #include <color_fragment>
      vec2 jointDistance = abs(mod(vConcretePosition.xz + 3.5, 7.0) - 3.5);
      vec2 aa = max(fwidth(vConcretePosition.xz), vec2(0.008));
      vec2 joint = 1.0 - smoothstep(vec2(0.012), vec2(0.012) + aa, jointDistance);
      float seam = max(joint.x, joint.y) * smoothstep(0.8, 0.98, vConcreteTop);
      float wear = sin(vConcretePosition.x * 0.39) * sin(vConcretePosition.z * 0.27);
      diffuseColor.rgb *= 1.0 - seam * 0.18 + wear * 0.025;
    `);
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
        // Irregular exposed patches, denser fresh drifts, and darker packed snow.
        vec2 snowUv = vConcretePosition.xz;
        float drift = snowNoise(snowUv * 0.24);
        float clumps = snowNoise(snowUv * 1.8 + vec2(13.2, 7.9));
        float grain = snowNoise(snowUv * 24.0);
        // Fade subpixel grain to prevent shimmering on distant/mobile surfaces.
        float grainVisible = 1.0 - smoothstep(0.35, 1.2, length(fwidth(snowUv * 24.0)));
        grain = mix(0.5, grain, grainVisible);
        float snowCoverage = smoothstep(0.23, 0.43, drift + (clumps - 0.5) * 0.22)
          * smoothstep(0.72, 0.96, vConcreteTop);
        float fresh = smoothstep(0.38, 0.76, drift * 0.7 + clumps * 0.3);
        vec3 snowColor = mix(vec3(0.19, 0.235, 0.285), vec3(0.36, 0.405, 0.45), fresh);
        // Soft tonal occlusion between clumps; existing lights/shadows still apply.
        snowColor *= 0.88 + 0.12 * clumps;
        snowColor += (grain - 0.5) * 0.035;
        diffuseColor.rgb = mix(diffuseColor.rgb, snowColor, snowCoverage * 0.96);
        roughnessFactor = mix(roughnessFactor, mix(0.86, 0.98, fresh), snowCoverage);
        float snowHeight = snowCoverage * (clumps * 0.018 + grain * 0.0025);
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
  material.customProgramCacheKey = () => `studio-concrete-joints-v3-textured-winter-${WINTER_THEME_ENABLED}`;
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

function createConcreteFloorGeometry(size: number) {
  const geometry = new PlaneGeometry(size, size);
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

export function ModularTerrain({ radius }: ModularTerrainProps) {
  const platformSize = radius * 20 + 10;
  const concreteTextures = useTexture(concreteTexturePaths);
  const floorGeometry = useMemo(() => createConcreteFloorGeometry(platformSize), [platformSize]);

  useMemo(() => configureConcreteTextures(concreteTextures), [concreteTextures]);
  const terrainMaterial = useMemo(
    () => createConcreteMaterial(concreteTextures, "#46515d"),
    [concreteTextures],
  );
  const floorMaterial = useMemo(() => {
    const material = createConcreteMaterial(concreteTextures, "#3f4953");
    material.color.set("#3f4953");
    return material;
  }, [concreteTextures]);

  useEffect(() => () => floorMaterial.dispose(), [floorMaterial]);
  useEffect(() => () => terrainMaterial.dispose(), [terrainMaterial]);
  useEffect(() => () => floorGeometry.dispose(), [floorGeometry]);

  return (
    <group name="WeatheredConcreteTerrain">
      <RigidBody name="StudioCLTDFloor" type="fixed" colliders={false}>
        <CuboidCollider
          position={[0, -0.09, 0]}
          args={[platformSize / 2, 0.09, platformSize / 2]}
          friction={0}
          restitution={0.18}
        />
      </RigidBody>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <primitive object={floorGeometry} attach="geometry" />
        <primitive object={floorMaterial} attach="material" />
      </mesh>
      {hubSections.map((section) => (
        <DestinationPlatform key={section.id} material={terrainMaterial} section={section} />
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
        <mesh position={[x, height / 2, z]} material={material} castShadow receiveShadow>
          <primitive object={platformGeometry} attach="geometry" />
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
          receiveShadow
          castShadow
          rotation-x={bridgeAngle}
        >
          <primitive object={rampGeometry} attach="geometry" />
        </mesh>
      </RigidBody>
    </group>
  );
}
