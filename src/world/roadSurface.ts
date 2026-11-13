export const roadSurfaceY = 0.84;
export const roadHalfWidth = 8.5;
export function clampRoadX(x: number, margin = 1.2) {
  return Math.max(-roadHalfWidth + margin, Math.min(roadHalfWidth - margin, x));
}
