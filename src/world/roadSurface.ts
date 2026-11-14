import { roadCenterX, roadHeight, roadPoint, roadTangent, sharedRoadSurfaceY } from './hubSections';

export { roadCenterX, roadHeight, roadPoint, roadTangent };
export const roadSurfaceY = sharedRoadSurfaceY;
export const roadHalfWidth = 8.5;

export function clampRoadX(x: number, z = 0, margin = 1.2) {
  const center = roadCenterX(z);
  return Math.max(center - roadHalfWidth + margin, Math.min(center + roadHalfWidth - margin, x));
}
