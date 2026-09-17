import { useFrame } from "@react-three/fiber";
import { useRapier } from "@react-three/rapier";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { Group, Mesh, Vector3 } from "three";

export type PickupSurface = { y: number; normal: { x: number; y: number; z: number } };
export const pickupSurfaceGap = 0.015;

/** Only stationary, solid surfaces can support a pickup; ignore actors/sensors. */
export function usePickupSurfaces(locations: readonly (readonly [number, number, number])[]) {
  const { world, rapier } = useRapier();
  const [surfaces, setSurfaces] = useState<PickupSurface[]>(() => locations.map(([, y]) => ({ y, normal: { x: 0, y: 1, z: 0 } })));
  const previousCount = useRef(-1);
  const ray = useMemo(() => new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }), [rapier]);
  // Runs during the paused initial preview too; retries when deferred terrain mounts.
  useFrame(() => {
    const count = world.colliders.len();
    if (previousCount.current === count) return;
    previousCount.current = count;
    world.propagateModifiedBodyPositionsToColliders();
    world.updateSceneQueries();
    const next = locations.map(([x, y, z], index) => {
      ray.origin.x = x; ray.origin.y = y + 8; ray.origin.z = z;
      const hit = world.castRayAndGetNormal(ray, 100, true,
        rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS);
      return hit && hit.normal.y > 0.25
        ? { y: ray.origin.y - hit.timeOfImpact, normal: { ...hit.normal } }
        : surfaces[index];
    });
    if (next.some((surface, i) => Math.abs(surface.y - surfaces[i].y) > 0.0001
      || Math.abs(surface.normal.x - surfaces[i].normal.x) > 0.0001
      || Math.abs(surface.normal.y - surfaces[i].normal.y) > 0.0001
      || Math.abs(surface.normal.z - surfaces[i].normal.z) > 0.0001)) setSurfaces(next);
  });
  return surfaces;
}

/** Rest the complete rotated visual on its support plane, including ramps. */
export function GroundedPickupVisual({ surface, children }: { surface: PickupSurface; children: ReactNode }) {
  const root = useRef<Group>(null);
  const scratch = useMemo(() => ({ point: new Vector3(), origin: new Vector3(), normal: new Vector3() }), []);
  useFrame(() => {
    const group = root.current;
    if (!group) return;
    group.position.y = 0;
    group.updateWorldMatrix(true, true);
    group.getWorldPosition(scratch.origin);
    scratch.normal.copy(surface.normal);
    let bottom = Infinity;
    group.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      const box = object.geometry.boundingBox;
      if (!box) return;
      for (let i = 0; i < 8; i++) {
        scratch.point.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z)
          .applyMatrix4(object.matrixWorld).sub(scratch.origin);
        bottom = Math.min(bottom, scratch.point.dot(scratch.normal));
      }
    });
    if (Number.isFinite(bottom)) group.position.y = (pickupSurfaceGap - bottom) / surface.normal.y;
  });
  return <group ref={root}>{children}</group>;
}
