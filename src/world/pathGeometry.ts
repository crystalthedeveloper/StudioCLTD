import { BufferGeometry, Float32BufferAttribute } from 'three';
import { plazaRadius, walkingPathWidth, walkingRoutes, type GroundPoint } from './worldLayout';

/** Flat paving shares the ground collider: no steps or extra physics bodies. */
export function createPathGeometry() {
  const vertices: number[] = [];
  const uvs: number[] = [];
  const triangle = (a: GroundPoint, b: GroundPoint, c: GroundPoint) => {
    if ((b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]) < 0) [b, c] = [c, b];
    for (const [x, z] of [a, b, c]) { vertices.push(x, 0, z); uvs.push(x, z); }
  };
  const disk = (center: GroundPoint, radius: number, segments: number) => {
    for (let i = 0; i < segments; i++) {
      const point = (angle: number): GroundPoint => [center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius];
      triangle(center, point(i / segments * Math.PI * 2), point((i + 1) / segments * Math.PI * 2));
    }
  };
  disk([0, 0], plazaRadius, 64);
  const joins = new Set<string>();
  for (const route of walkingRoutes) {
    route.forEach((point, i) => {
      const key = point.join(',');
      if (!joins.has(key)) { disk(point, walkingPathWidth / 2, 16); joins.add(key); }
      if (!i) return;
      const start = route[i - 1];
      const dx = point[0] - start[0], dz = point[1] - start[1];
      const length = Math.hypot(dx, dz);
      const nx = -dz / length * walkingPathWidth / 2, nz = dx / length * walkingPathWidth / 2;
      const a: GroundPoint = [start[0] + nx, start[1] + nz], b: GroundPoint = [point[0] + nx, point[1] + nz];
      const c: GroundPoint = [point[0] - nx, point[1] - nz], d: GroundPoint = [start[0] - nx, start[1] - nz];
      triangle(a, b, c); triangle(a, c, d);
    });
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
