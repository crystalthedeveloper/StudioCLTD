import { useFrame } from "@react-three/fiber";
import { ReactNode, useRef } from "react";
import { Group, Material, MathUtils, Object3D, Vector3 } from "three";
import { playerWorldState } from "../playerWorldState";

type DistanceVisibleProps = {
  children: ReactNode;
  fullDistance?: number;
  hiddenDistance?: number;
  origin?: Vector3 | [number, number, number];
};

const originPosition = new Vector3();
const materialState = new WeakMap<Material, { opacity: number; transparent: boolean }>();
const updateIntervalSeconds = 0.08;

function getMaterials(object: Object3D) {
  const material = (object as { material?: Material | Material[] }).material;
  if (!material) return [];
  return Array.isArray(material) ? material : [material];
}

function collectMaterials(group: Group) {
  const materials: Material[] = [];

  group.traverse((object) => {
    getMaterials(object).forEach((material) => {
      if (!materialState.has(material)) {
        materialState.set(material, {
          opacity: material.opacity <= 0 ? 1 : material.opacity,
          transparent: material.transparent,
        });
      }
      materials.push(material);
    });
  });

  return materials;
}

function applyOpacity(materials: Material[], opacity: number) {
  materials.forEach((material) => {
    const initial = materialState.get(material);
    if (!initial) return;

    material.transparent = initial.transparent || opacity < 0.99;
    material.opacity = initial.opacity * opacity;
  });
}

export function DistanceVisible({
  children,
  fullDistance = 40,
  hiddenDistance = 70,
  origin,
}: DistanceVisibleProps) {
  const groupRef = useRef<Group>(null);
  const materialsRef = useRef<Material[]>([]);
  const lastOpacityRef = useRef(-1);
  const lastUpdateRef = useRef(0);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    if (clock.elapsedTime - lastUpdateRef.current < updateIntervalSeconds) return;
    lastUpdateRef.current = clock.elapsedTime;

    if (materialsRef.current.length === 0) {
      materialsRef.current = collectMaterials(group);
    }

    if (origin instanceof Vector3) {
      originPosition.copy(origin);
    } else if (origin) {
      originPosition.set(...origin);
    } else {
      group.getWorldPosition(originPosition);
    }

    const distance = playerWorldState.position.distanceTo(originPosition);
    const opacity = 1 - MathUtils.smoothstep(distance, fullDistance, hiddenDistance);
    const roundedOpacity = Math.round(opacity * 100) / 100;

    if (Math.abs(roundedOpacity - lastOpacityRef.current) < 0.01) return;
    lastOpacityRef.current = roundedOpacity;

    group.visible = roundedOpacity > 0.02;
    applyOpacity(materialsRef.current, roundedOpacity);
  });

  return <group ref={groupRef}>{children}</group>;
}
