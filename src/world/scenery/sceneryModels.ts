import { BufferGeometry, CylinderGeometry, IcosahedronGeometry, PlaneGeometry, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function seededRandom(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
}
function merge(parts: BufferGeometry[]) {
  const result = mergeGeometries(parts, false)!;
  parts.forEach(part => part.dispose());
  result.computeBoundingSphere();
  return result;
}
function branch(a: Vector3, b: Vector3, radius: number, tip: number, sides: number) {
  const direction = b.clone().sub(a);
  const geometry = new CylinderGeometry(tip, radius, direction.length(), sides, 1);
  geometry.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()));
  geometry.translate(...a.clone().add(b).multiplyScalar(.5).toArray());
  return geometry;
}

/** Three reusable, asymmetrical pine silhouettes, with real needle atlas cards.
 * Separate tapered boughs and twig sprays leave gaps instead of solid cones.
 */
export function createPineModel(variant: number, distant = false) {
  const random = seededRandom(713 + variant * 117);
  const wood: BufferGeometry[] = [], needles: BufferGeometry[] = [];
  const height = 6.4 + variant * .35;
  let last = new Vector3();
  for (let i = 1; i <= 8; i++) {
    const next = new Vector3(Math.sin(i * .63 + variant) * .08, height * i / 8, Math.sin(i * .8) * .08);
    wood.push(branch(last, next, .16 * (1 - (i - 1) / 9), .16 * (1 - i / 9), distant ? 5 : 8));
    last = next;
  }
  for (let tier = 0; tier < 10; tier++) {
    const y = .85 + tier * .53;
    const reach = (1.95 * Math.pow(1 - tier / 12, .65)) * (1 + .12 * Math.sin(tier * 2.8));
    for (let arm = 0; arm < 5; arm++) {
      const angle = arm / 5 * Math.PI * 2 + tier * 2.399 + variant + random() * .55;
      const length = reach * (.72 + random() * .35);
      const base = new Vector3(0, y + random() * .22, 0);
      const bend = new Vector3(Math.cos(angle) * length * .55, y - .16, Math.sin(angle) * length * .55);
      const tip = new Vector3(Math.cos(angle) * length, y + .2 + random() * .24, Math.sin(angle) * length);
      if (!distant || arm % 2 === 0) {
        wood.push(branch(base, bend, .027, .016, 4), branch(bend, tip, .016, .003, 4));
      }
      const sprays = distant ? 3 : 6;
      for (let spray = 0; spray < sprays; spray++) {
        const t = .25 + spray / sprays * .75;
        const center = bend.clone().lerp(tip, t);
        const fanAngle = angle + (spray % 2 ? 1 : -1) * (.5 + random() * .5);
        const size = (.62 + random() * .3) * (distant ? 1.35 : 1);
        // Atlas's upper-left pine sprig only; exclude cones and baked branches.
        for (let cross = 0; cross < (distant ? 1 : 2); cross++) {
          const card = new PlaneGeometry(size * .62, size);
          card.translate(0, size * .3, 0);
          card.rotateX(-Math.PI / 2 + .28 + cross * .85);
          card.rotateY(-fanAngle + Math.PI / 2);
          card.translate(center.x, center.y, center.z);
          const uv = card.getAttribute('uv');
          for (let i=0;i<uv.count;i++) uv.setXY(i, .025 + uv.getX(i)*.213, .57 + uv.getY(i)*.4);
          needles.push(card);
        }
      }
    }
  }
  return { wood: merge(wood), needles: merge(needles) };
}

/** Eroded, flattened boulders; no regular low-poly primitive silhouette. */
export function createRockModel(variant: number, distant = false, snowbank = false) {
  const geometry = new IcosahedronGeometry(1, distant ? 1 : 3);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x=positions.getX(i), y=positions.getY(i), z=positions.getZ(i);
    const erosion = 1 + .17*Math.sin(x*4.2 + z*2.7 + variant*2) * Math.cos(y*3.7-z*2)
      + .07*Math.sin(x*9-z*7+y*6);
    positions.setXYZ(i, x*erosion*1.15, Math.max(-.32, y*erosion*.78) + .3, z*erosion*.86);
  }
  if (snowbank) geometry.scale(1.5, .25, .8);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
