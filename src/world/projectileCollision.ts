import { Vector3 } from "three";

/** Earliest segment contact with an axis-aligned ellipsoid, including starting inside it. */
export function segmentEllipsoidHit(start: Vector3, end: Vector3, center: Vector3, radiusX: number, radiusY: number, radiusZ: number) {
  const x = (start.x - center.x) / radiusX, y = (start.y - center.y) / radiusY, z = (start.z - center.z) / radiusZ;
  const dx = (end.x - start.x) / radiusX, dy = (end.y - start.y) / radiusY, dz = (end.z - start.z) / radiusZ;
  const c = x*x + y*y + z*z - 1;
  if (c <= 0) return 0;
  const a = dx*dx + dy*dy + dz*dz;
  if (a === 0) return null;
  const b = 2 * (x*dx + y*dy + z*dz);
  const discriminant = b*b - 4*a*c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2*a);
  return t >= 0 && t <= 1 ? t : null;
}
