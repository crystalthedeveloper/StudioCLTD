import { NearbyAsset } from "../NearbyAsset";
import { isCompactVisualBudget } from "../visualQuality";
import { assetForDevice } from "../mobileAssets";
import { WINTER_THEME_ENABLED } from "../winterTheme";
import { RoundedBoxGeometry } from "three-stdlib";
import { useTexture } from "@react-three/drei";
import { CuboidCollider, RigidBody, TrimeshCollider } from "@react-three/rapier";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BufferGeometry,
  Float32BufferAttribute,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshStandardMaterial,
  MeshBasicMaterial,
  Mesh,
  NoColorSpace,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  DoubleSide,
  Texture,
  Vector2,
  Vector3,
  Raycaster,
  Quaternion,
} from "three";
import { destinationPlatformRadius, hubSections, sectionRampApproachLength, sectionRampWidth } from "../hubSections";
import { roadCenterX, roadHalfWidth, roadHeight, roadPoint, roadTangent } from "../roadSurface";
import { isInsideTriggerExclusion } from "../worldLayout";
import { brandYellow } from "../../player/effectColors";


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
export const roadTexturePath = "/images/optimized/road/wet-asphalt.jpg";
const roadNormalTexturePath = "/images/optimized/floor/world-weathered-concrete-normal.webp";
const roadRoughnessTexturePath = "/images/optimized/floor/world-weathered-concrete-roughness.webp";
const bloodTexturePaths = [
  "/images/optimized/road/blood-splatter-a.png",
  "/images/optimized/road/blood-splatter-b.png",
  "/images/optimized/road/blood-smear.png",
  "/images/optimized/road/blood-handprint.png",
] as const;

function createRoadMaterial(asphaltTexture: Texture | null, normalTexture: Texture | null, roughnessTexture: Texture | null) {
  [asphaltTexture, normalTexture, roughnessTexture].forEach((texture) => {
    if (!texture) return;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(1, 1);
    texture.minFilter = LinearMipmapLinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
  });
  if (asphaltTexture) asphaltTexture.colorSpace = SRGBColorSpace;
  if (normalTexture) normalTexture.colorSpace = NoColorSpace;
  if (roughnessTexture) roughnessTexture.colorSpace = NoColorSpace;
  const material = new MeshStandardMaterial({
    color: "#3B4B5C",
    map: asphaltTexture,
    normalMap: normalTexture,
    normalScale: new Vector2(0.14, 0.14),
    roughnessMap: roughnessTexture,
    roughness: 0.68,
    metalness: 0.03,
    envMapIntensity: 0.24,
    emissive: "#182635",
    emissiveIntensity: 0.32,
  });
  return material;
}

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

function createRoadRibbonGeometry(lateralOffset: number, width: number, yOffset = 0) {
  const sampleCount = 99;
  const vertices = new Float32Array(sampleCount * 2 * 3);
  const uvs = new Float32Array(sampleCount * 2 * 2);
  const indices = new Uint32Array((sampleCount - 1) * 6);
  const distanceAt = new Float32Array(sampleCount);
  let distance = 0;

  for (let index = 0; index < sampleCount; index += 1) {
    const z = 28 - index * 5;
    if (index > 0) {
      const previous = roadPoint(lateralOffset, 28 - (index - 1) * 5, yOffset);
      const current = roadPoint(lateralOffset, z, yOffset);
      distance += Math.hypot(current[0] - previous[0], current[1] - previous[1], current[2] - previous[2]);
    }
    distanceAt[index] = distance;
    const left = roadPoint(lateralOffset - width / 2, z, yOffset);
    const right = roadPoint(lateralOffset + width / 2, z, yOffset);
    const vertex = index * 6;
    vertices.set(left, vertex);
    vertices.set(right, vertex + 3);
    const uv = index * 4;
    uvs[uv] = 0;
    uvs[uv + 1] = distance / 12;
    uvs[uv + 2] = 1;
    uvs[uv + 3] = distance / 12;
  }

  for (let index = 0; index < sampleCount - 1; index += 1) {
    const current = index * 2;
    const next = (index + 1) * 2;
    const triangle = index * 6;
    indices[triangle] = current;
    indices[triangle + 1] = current + 1;
    indices[triangle + 2] = next + 1;
    indices[triangle + 3] = current;
    indices[triangle + 4] = next + 1;
    indices[triangle + 5] = next;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(Array.from(indices));
  geometry.computeVertexNormals();
  return geometry;
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
        float snowCoverage = (0.64 + 0.36 * smoothstep(0.30, 0.68, drift + (clumps - 0.5) * 0.24)) * topSurface;
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
        float snowShade = smoothstep(0.22, 0.78, clumps);
        // Fresh snow stays cool and luminous; compressed/dirty snow picks up blue-gray shade.
        vec3 snowColor = mix(vec3(0.38, 0.42, 0.45), vec3(0.78, 0.84, 0.90), fresh);
        snowColor *= 0.90 + snowShade * 0.16;
        snowColor += (grain - 0.5) * 0.045;
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
  // The road always uses this one cached colour texture on every viewport.
  const [asphaltSource, normalSource, roughnessSource] = useTexture([
    roadTexturePath,
    roadNormalTexturePath,
    roadRoughnessTexturePath,
  ]);
  const bloodTextures = useTexture([...bloodTexturePaths]);
  useEffect(() => {
    bloodTextures.forEach((texture) => {
      texture.colorSpace = SRGBColorSpace;
      texture.wrapS = texture.wrapT = RepeatWrapping;
      texture.minFilter = LinearFilter;
      texture.magFilter = LinearFilter;
      texture.needsUpdate = true;
    });
  }, [bloodTextures]);
  // useTexture owns this cached asset. Keep the same texture instance through
  // responsive resizes so a layout change cannot dispose the road image.
  const roadMaterial = useMemo(() => createRoadMaterial(asphaltSource, normalSource, roughnessSource), [asphaltSource, normalSource, roughnessSource]);
  const roadMeshRef = useRef<Mesh>(null);
  const roadGeometry = useMemo(() => createRoadRibbonGeometry(0, roadHalfWidth * 2), []);
  const yellowLineLeftGeometry = useMemo(() => createRoadRibbonGeometry(0.15, 0.08, 0.035), []);
  const yellowLineRightGeometry = useMemo(() => createRoadRibbonGeometry(-0.15, 0.08, 0.035), []);
  const centerLineMaterial = useMemo(() => new MeshBasicMaterial({
    color: brandYellow,
    transparent: true,
    opacity: 0.74,
    depthWrite: false,
    toneMapped: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  }), []);
  useEffect(() => () => {
    if (typeof roadMaterial.dispose === "function") roadMaterial.dispose();
  }, [roadMaterial]);
  useEffect(() => () => {
    roadGeometry.dispose();
    yellowLineLeftGeometry.dispose();
    yellowLineRightGeometry.dispose();
  }, [roadGeometry, yellowLineLeftGeometry, yellowLineRightGeometry]);
  useEffect(() => () => centerLineMaterial.dispose(), [centerLineMaterial]);

  return (
    <group name="WeatheredConcreteTerrain">
      <group name="SharedCurvedRoad">
        <RoadCollision />
        <mesh ref={roadMeshRef} name="ContinuousCurvedRoadVisual" geometry={roadGeometry} material={roadMaterial} receiveShadow />
        <RoadZoneTints />
        <RoadBloodDecals textures={bloodTextures} roadMeshRef={roadMeshRef} />
        <RoadReflectors />
        <mesh name="DoubleYellowLineLeft" geometry={yellowLineLeftGeometry} material={centerLineMaterial} renderOrder={3} />
        <mesh name="DoubleYellowLineRight" geometry={yellowLineRightGeometry} material={centerLineMaterial} renderOrder={3} />
      </group>
    </group>
  );
}

const roadZones = [
  { name: "Error Zone", start: 28, end: -152, color: "#2b3a47", opacity: .11 },
  { name: "Corruption Zone", start: -132, end: -312, color: "#1f2a34", opacity: .15 },
  { name: "System Failure Zone", start: -292, end: -460, color: "#29272b", opacity: .19 },
] as const;

function createZoneGeometry(start: number, end: number) {
  const samples = 18;
  const geometry = new BufferGeometry();
  const vertices = new Float32Array(samples * 2 * 3);
  const indices = new Uint32Array((samples - 1) * 6);
  for (let index = 0; index < samples; index += 1) {
    const z = start + (end - start) * (index / (samples - 1));
    const left = roadPoint(-roadHalfWidth, z, .045);
    const right = roadPoint(roadHalfWidth, z, .045);
    vertices.set(left, index * 6);
    vertices.set(right, index * 6 + 3);
    if (index === samples - 1) continue;
    const next = index * 2;
    const nextRow = (index + 1) * 2;
    const triangle = index * 6;
    indices.set([next, nextRow, nextRow + 1, next, nextRow + 1, next + 1], triangle);
  }
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(Array.from(indices));
  geometry.computeVertexNormals();
  return geometry;
}

function RoadZoneTints() {
  const resources = useMemo(() => roadZones.map((zone) => ({
    geometry: createZoneGeometry(zone.start, zone.end),
    material: new MeshBasicMaterial({ color: zone.color, transparent: true, opacity: zone.opacity, depthWrite: false, toneMapped: false, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  })), []);
  useEffect(() => () => resources.forEach(({ geometry, material }) => { geometry.dispose(); material.dispose(); }), [resources]);
  return <group name="RoadZoneTints">
    {resources.map((resource, index) => <mesh key={roadZones[index].name} geometry={resource.geometry} material={resource.material} renderOrder={1} />)}
  </group>;
}

function RoadBloodDecals({ textures, roadMeshRef }: { textures: Texture[]; roadMeshRef: React.RefObject<Mesh> }) {
  const compact = isCompactVisualBudget();
  const candidates = useMemo(() => {
    const candidates = [
      [-3.6, -118, 0.18, 0.72, 0, "#651b29"], [3.4, -226, -0.42, 0.58, 1, "#4d1420"], [-2.9, -326, 0.32, 0.5, 2, "#731e2b"],
      [3.2, -426, -0.18, 0.66, 0, "#521622"], [-3.7, -526, 0.55, 0.46, 1, "#7b2330"], [3.8, -626, -0.3, 0.56, 2, "#48131f"],
      [-3.2, -726, 0.4, 0.7, 0, "#681a28"], [2.2, -146, -0.5, 0.3, 1, "#8a2832"], [4.2, -166, 0.22, 0.18, 2, "#5b1723"],
      [-4.4, -246, 0.48, 0.22, 3, "#571722"], [-1.8, -266, -0.36, 0.16, 1, "#81232d"], [4.0, -346, -0.22, 0.24, 2, "#661b28"],
      [2.2, -366, 0.3, 0.14, 0, "#8b2934"], [-4.0, -446, 0.52, 0.25, 1, "#511520"], [-2.0, -466, -0.15, 0.16, 2, "#76202c"],
      [4.1, -546, -0.4, 0.3, 3, "#5a1722"], [2.6, -566, 0.1, 0.15, 0, "#8d2935"], [-4.0, -646, 0.4, 0.25, 1, "#671b27"],
      [-2.2, -666, -0.3, 0.14, 2, "#81232f"], [3.8, -746, 0.52, 0.26, 3, "#541621"], [1.7, -766, -0.2, 0.15, 0, "#8d2935"],
      [-3.0, -796, 0.35, 0.2, 1, "#641a26"],
    ] as const;
    const selected: typeof candidates[number][] = [];
    for (const candidate of candidates) {
      const [localX, z] = candidate;
      const point = roadPoint(localX, z);
      if (isInsideTriggerExclusion(point[0], point[2], 2.2)) continue;
      if (selected.some(([otherX, otherZ]) => Math.hypot(localX - otherX, z - otherZ) < 14)) continue;
      selected.push(candidate);
      if (selected.length >= (compact ? 14 : 22)) break;
    }
    return selected;
  }, [compact]);
  const [decals, setDecals] = useState<Array<{ point: Vector3; normal: Vector3; rotation: number; scale: number; textureIndex: number; color: string }>>([]);
  useEffect(() => {
    let frame = 0;
    const place = () => {
      const roadMesh = roadMeshRef.current;
      if (!roadMesh || !roadMesh.geometry.boundingSphere) {
        frame = window.requestAnimationFrame(place);
        return;
      }
      roadMesh.updateWorldMatrix(true, false);
      const raycaster = new Raycaster();
      const down = new Vector3(0, -1, 0);
      const origin = new Vector3();
      const localNormal = new Vector3();
      const worldNormal = new Vector3();
      const inverseQuaternion = new Quaternion();
      const placed = candidates.flatMap(([localX, z, rotation, scale, textureIndex, color]) => {
        const [x, y] = roadPoint(localX, z, 8);
        origin.set(x, y, z);
        raycaster.set(origin, down);
        const hit = raycaster.intersectObject(roadMesh, false)[0];
        if (!hit) return [];
        localNormal.copy(hit.face?.normal ?? new Vector3(0, 1, 0));
        worldNormal.copy(localNormal).transformDirection(roadMesh.matrixWorld).normalize();
        inverseQuaternion.setFromUnitVectors(new Vector3(0, 0, 1), worldNormal);
        return [{ point: hit.point.clone().addScaledVector(worldNormal, 0.005), normal: worldNormal.clone(), rotation, scale, textureIndex, color }];
      });
      setDecals(placed);
    };
    frame = window.requestAnimationFrame(place);
    return () => window.cancelAnimationFrame(frame);
  }, [candidates, roadMeshRef]);
  return (
    <group name="RoadBloodDecals">
      {decals.map(({ point, normal, rotation, scale, textureIndex, color }, index) => {
        const orientation = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), normal);
        return (
          <mesh key={`blood-decal:${index}`} frustumCulled={false} position={point} quaternion={orientation} scale={[scale * (index % 3 === 2 ? 7.5 : 5.6), scale * 2.2, 1]} rotation-z={rotation}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial map={textures[textureIndex % textures.length]} color={color} transparent opacity={0.96} alphaTest={0.01} side={DoubleSide} depthWrite={false} polygonOffset polygonOffsetFactor={-8} polygonOffsetUnits={-8} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}

function RoadReflectors() {
  const positions = useMemo(() => [-72, -172, -272, -372, -472, -572, -672, -772].map((z) => roadPoint(0, z, 0.055)), []);
  return <group name="FaintYellowRoadReflectors">
    {positions.map((position, index) => (
      <mesh key={`road-reflector:${index}`} position={position} renderOrder={4}>
        <sphereGeometry args={[0.055, 6, 4]} />
        <meshBasicMaterial color="#b89d18" toneMapped opacity={0.62} transparent depthWrite={false} />
      </mesh>
    ))}
  </group>;
}

function RoadCollision() {
  const args = useMemo(() => {
    const sampleCount = 99;
    const colliderHalfWidth = roadHalfWidth + 0.8;
    const vertices = new Float32Array(sampleCount * 2 * 3);
    const indices = new Uint32Array((sampleCount - 1) * 6);
    for (let index = 0; index < sampleCount; index += 1) {
      const z = 28 - index * 5;
      const left = roadPoint(-colliderHalfWidth, z, -0.045);
      const right = roadPoint(colliderHalfWidth, z, -0.045);
      const vertex = index * 6;
      vertices[vertex] = left[0]; vertices[vertex + 1] = left[1]; vertices[vertex + 2] = left[2];
      vertices[vertex + 3] = right[0]; vertices[vertex + 4] = right[1]; vertices[vertex + 5] = right[2];
      if (index >= sampleCount - 1) continue;
      const next = index * 6;
      const currentLeft = index * 2;
      const nextLeft = (index + 1) * 2;
      const triangle = index * 6;
      indices[triangle] = currentLeft;
      indices[triangle + 1] = currentLeft + 1;
      indices[triangle + 2] = nextLeft + 1;
      indices[triangle + 3] = currentLeft;
      indices[triangle + 4] = nextLeft + 1;
      indices[triangle + 5] = nextLeft;
    }
    return [vertices, indices] as [Float32Array, Uint32Array];
  }, []);

  return (
    <RigidBody name="ContinuousCurvedRoadCollision" type="fixed" colliders={false}>
      <TrimeshCollider args={args} friction={0} restitution={0.05} />
    </RigidBody>
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
