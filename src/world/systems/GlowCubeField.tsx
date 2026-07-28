import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  InstancedMesh,
  LinearFilter,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
} from "three";

const glowBeacons = [
  { position: [-18, 0, -14] as [number, number, number], color: "yellow" as const, scale: 0.55 },
  { position: [16, 0, -23] as [number, number, number], color: "red" as const, scale: 0.7 },
  { position: [-31, 0, 18] as [number, number, number], color: "yellow" as const, scale: 0.6 },
  { position: [34, 0, 12] as [number, number, number], color: "red" as const, scale: 0.52 },
  { position: [7, 0, 34] as [number, number, number], color: "yellow" as const, scale: 0.62 },
  { position: [-42, 0, -32] as [number, number, number], color: "red" as const, scale: 0.75 },
  { position: [43, 0, -41] as [number, number, number], color: "yellow" as const, scale: 0.68 },
  { position: [-8, 0, 48] as [number, number, number], color: "red" as const, scale: 0.5 },
  { position: [55, 0, 31] as [number, number, number], color: "yellow" as const, scale: 0.58 },
  { position: [-58, 0, 6] as [number, number, number], color: "red" as const, scale: 0.64 },
];

const yellowBeacons = glowBeacons.filter((beacon) => beacon.color === "yellow");
const redBeacons = glowBeacons.filter((beacon) => beacon.color === "red");
const frameBarsPerCube = 12;

function getCubeSize(scale: number) {
  return 0.44 + scale * 0.25;
}

function createRadialMask(edgeBrightness: number) {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgb(255,255,255)");
  gradient.addColorStop(0.38, "rgb(238,238,238)");
  const edgeValue = Math.round(edgeBrightness * 255);
  gradient.addColorStop(1, `rgb(${edgeValue},${edgeValue},${edgeValue})`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

export function GlowCubeField() {
  const frameRef = useRef<InstancedMesh>(null);
  const yellowFacesRef = useRef<InstancedMesh>(null);
  const redFacesRef = useRef<InstancedMesh>(null);
  const yellowReflectionsRef = useRef<InstancedMesh>(null);
  const redReflectionsRef = useRef<InstancedMesh>(null);

  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const reflectionGeometry = useMemo(() => new CircleGeometry(1, 24), []);
  const faceGlowMask = useMemo(() => createRadialMask(0.48), []);
  const reflectionMask = useMemo(() => createRadialMask(0), []);
  const frameMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#090c10",
        metalness: 0.82,
        roughness: 0.3,
        envMapIntensity: 0.38,
      }),
    [],
  );
  const yellowMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#facc15",
        emissive: "#facc15",
        emissiveMap: faceGlowMask,
        emissiveIntensity: 4,
        metalness: 0.05,
        roughness: 0.42,
        toneMapped: false,
      }),
    [faceGlowMask],
  );
  const redMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#7f1018",
        emissive: "#c51624",
        emissiveMap: faceGlowMask,
        emissiveIntensity: 3.5,
        metalness: 0.05,
        roughness: 0.44,
        toneMapped: false,
      }),
    [faceGlowMask],
  );
  const yellowReflectionMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        map: reflectionMask,
        color: "#facc15",
        opacity: 0.18,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [reflectionMask],
  );
  const redReflectionMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        map: reflectionMask,
        color: "#b5101d",
        opacity: 0.14,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [reflectionMask],
  );

  useLayoutEffect(() => {
    const frameMesh = frameRef.current;
    const yellowMesh = yellowFacesRef.current;
    const redMesh = redFacesRef.current;
    const yellowReflections = yellowReflectionsRef.current;
    const redReflections = redReflectionsRef.current;
    if (!frameMesh || !yellowMesh || !redMesh || !yellowReflections || !redReflections) return;

    const transform = new Object3D();
    let frameIndex = 0;

    glowBeacons.forEach((beacon) => {
      const size = getCubeSize(beacon.scale);
      const half = size / 2;
      const thickness = size * 0.095;
      const centerY = half + 0.035;

      const addBar = (
        offsetX: number,
        offsetY: number,
        offsetZ: number,
        width: number,
        height: number,
        depth: number,
      ) => {
        transform.position.set(beacon.position[0] + offsetX, centerY + offsetY, beacon.position[2] + offsetZ);
        transform.scale.set(width, height, depth);
        transform.rotation.set(0, 0, 0);
        transform.updateMatrix();
        frameMesh.setMatrixAt(frameIndex, transform.matrix);
        frameIndex += 1;
      };

      for (const yDirection of [-1, 1]) {
        for (const zDirection of [-1, 1]) {
          addBar(0, yDirection * half, zDirection * half, size + thickness, thickness, thickness);
        }
        for (const xDirection of [-1, 1]) {
          addBar(xDirection * half, yDirection * half, 0, thickness, thickness, size + thickness);
        }
      }
      for (const xDirection of [-1, 1]) {
        for (const zDirection of [-1, 1]) {
          addBar(xDirection * half, 0, zDirection * half, thickness, size, thickness);
        }
      }
    });

    const setFaceInstances = (mesh: InstancedMesh, beacons: typeof glowBeacons) => {
      beacons.forEach((beacon, index) => {
        const size = getCubeSize(beacon.scale);
        const insetSize = size - size * 0.15;
        transform.position.set(beacon.position[0], size / 2 + 0.035, beacon.position[2]);
        transform.scale.setScalar(insetSize);
        transform.rotation.set(0, 0, 0);
        transform.updateMatrix();
        mesh.setMatrixAt(index, transform.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    };

    const setReflectionInstances = (mesh: InstancedMesh, beacons: typeof glowBeacons) => {
      beacons.forEach((beacon, index) => {
        const size = getCubeSize(beacon.scale);
        transform.position.set(beacon.position[0], 0.012, beacon.position[2]);
        transform.scale.set(size * 1.25, size * 0.9, 1);
        transform.rotation.set(-Math.PI / 2, 0, 0);
        transform.updateMatrix();
        mesh.setMatrixAt(index, transform.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    };

    frameMesh.instanceMatrix.needsUpdate = true;
    frameMesh.computeBoundingSphere();
    setFaceInstances(yellowMesh, yellowBeacons);
    setFaceInstances(redMesh, redBeacons);
    setReflectionInstances(yellowReflections, yellowBeacons);
    setReflectionInstances(redReflections, redBeacons);
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
      faceGlowMask.dispose();
      reflectionGeometry.dispose();
      reflectionMask.dispose();
      frameMaterial.dispose();
      yellowMaterial.dispose();
      redMaterial.dispose();
      yellowReflectionMaterial.dispose();
      redReflectionMaterial.dispose();
    },
    [
      frameMaterial,
      faceGlowMask,
      geometry,
      redMaterial,
      redReflectionMaterial,
      reflectionGeometry,
      reflectionMask,
      yellowMaterial,
      yellowReflectionMaterial,
    ],
  );

  return (
    <RigidBody type="fixed" colliders={false}>
      {glowBeacons.map((beacon) => {
        const size = getCubeSize(beacon.scale);
        return (
          <CuboidCollider
            key={`${beacon.position[0]}:${beacon.position[2]}`}
            args={[size / 2, size / 2, size / 2]}
            position={[beacon.position[0], size / 2 + 0.035, beacon.position[2]]}
          />
        );
      })}
      <group name="EnvironmentGlowCubes">
        <instancedMesh
          ref={frameRef}
          args={[geometry, frameMaterial, glowBeacons.length * frameBarsPerCube]}
          castShadow={false}
          receiveShadow={false}
        />
        <instancedMesh
          ref={yellowFacesRef}
          args={[geometry, yellowMaterial, yellowBeacons.length]}
          castShadow={false}
          receiveShadow={false}
        />
        <instancedMesh
          ref={redFacesRef}
          args={[geometry, redMaterial, redBeacons.length]}
          castShadow={false}
          receiveShadow={false}
        />
        <instancedMesh
          ref={yellowReflectionsRef}
          args={[reflectionGeometry, yellowReflectionMaterial, yellowBeacons.length]}
          castShadow={false}
          receiveShadow={false}
          renderOrder={2}
        />
        <instancedMesh
          ref={redReflectionsRef}
          args={[reflectionGeometry, redReflectionMaterial, redBeacons.length]}
          castShadow={false}
          receiveShadow={false}
          renderOrder={2}
        />
      </group>
    </RigidBody>
  );
}
