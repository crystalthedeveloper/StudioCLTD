import { Quaternion, Vector3 } from "three";

export function createRollingMotion() {
  const previous = new Vector3();
  const displacement = new Vector3();
  const axis = new Vector3();
  const step = new Quaternion();
  let initialized = false;
  return {
    reset() { initialized = false; },
    update(position: Vector3, normal: Vector3, radius: number, delta: number, rotation: Quaternion) {
      if (!initialized) { previous.copy(position); initialized = true; return 0; }
      displacement.subVectors(position, previous);
      previous.copy(position);
      // Respawns, transport and long suspended frames are not rolling distance.
      if (delta <= 0 || delta > 0.2 || displacement.length() > Math.max(2, delta * 40)) return -1;
      displacement.addScaledVector(normal, -displacement.dot(normal));
      const distance = displacement.length();
      if (distance < 0.00001) return 0;
      axis.crossVectors(normal, displacement).normalize();
      step.setFromAxisAngle(axis, distance / radius);
      rotation.premultiply(step).normalize();
      return distance;
    },
  };
}
