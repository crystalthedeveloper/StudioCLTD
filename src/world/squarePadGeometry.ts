import { Path, Shape, ShapeGeometry } from "three";

/** Sharp square frame in the XY plane, retaining the old pad's outer span. */
export function createSquarePadGeometry(innerHalfSize: number, outerHalfSize: number) {
  const outline = new Shape();
  outline.moveTo(-outerHalfSize, -outerHalfSize);
  outline.lineTo(outerHalfSize, -outerHalfSize);
  outline.lineTo(outerHalfSize, outerHalfSize);
  outline.lineTo(-outerHalfSize, outerHalfSize);
  outline.closePath();

  const opening = new Path();
  opening.moveTo(-innerHalfSize, -innerHalfSize);
  opening.lineTo(-innerHalfSize, innerHalfSize);
  opening.lineTo(innerHalfSize, innerHalfSize);
  opening.lineTo(innerHalfSize, -innerHalfSize);
  opening.closePath();
  outline.holes.push(opening);
  return new ShapeGeometry(outline);
}
