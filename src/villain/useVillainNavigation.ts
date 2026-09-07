import { useMemo } from "react";
import { useRapier, type RapierRigidBody } from "@react-three/rapier";
import { Vector3 } from "three";
import { isPlayerObject } from "../world/playerCollision";

export function useVillainNavigation() {
  const { world, rapier, colliderStates } = useRapier();
  const shape = useMemo(() => new rapier.Capsule(0.55, 0.45), [rapier]);
  const filter = (collider: { handle: number; isSensor: () => boolean }) => !collider.isSensor() && !isPlayerObject(colliderStates.get(collider.handle)?.object);
  return {
    clear(x: number, y: number, z: number, self?: RapierRigidBody | null) {
      return !world.intersectionWithShape({ x, y: y + 1.08, z }, { x: 0, y: 0, z: 0, w: 1 }, shape, undefined, undefined, undefined, self ?? undefined, filter);
    },
    sight(from: Vector3, to: Vector3, self?: RapierRigidBody | null) {
      const direction = new Vector3(to.x - from.x, 0, to.z - from.z);
      const distance = direction.length();
      if (distance < 0.01) return true;
      direction.divideScalar(distance);
      return !world.castRay(new rapier.Ray({ x: from.x, y: from.y + 1.25, z: from.z }, direction), distance, true, undefined, undefined, undefined, self ?? undefined, filter);
    },
  };
}
