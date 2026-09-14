import { destinationPlatformRadius, hubSections, sectionRampApproachLength } from './hubSections';

export type GroundPoint = readonly [number, number];
export const groundSize = [172, 184] as const;
export const groundCenter = [0, -22] as const;
export const plazaRadius = 18;
export const walkingPathWidth = 7;
// Clockwise circuit joins all three districts. North is negative Z.
export const walkingLoop: GroundPoint[] = [
  [-24, 16], [-24, 0], [-28, -36], [-30, -48], [10, -56],
  [28, -46], [32, -4], [32, 18], [44, 18], [20, 24], [-16, 24], [-24, 16],
];
export function rampLanding(section: (typeof hubSections)[number]): GroundPoint {
  const offset = destinationPlatformRadius + sectionRampApproachLength;
  return [section.position[0] + section.entrance[0] * offset, section.position[2] + section.entrance[1] * offset];
}
export const walkingRoutes: GroundPoint[][] = [
  walkingLoop,
  [[0, 0], [-24, 0]],
  [[0, 0], [32, -4]],
  [[0, 0], [0, -54]],
  [[0, 0], [0, 24]],
  [[-24, 16], [-24, 20], rampLanding(hubSections.find(s => s.id === 'quick-fix')!)],
];
export const routePowerPositions: [number, number, number][] = [
  [-10, 0, 4], [8, 0, 12], [0, 0, -14], [-23, 0, 8],
  [-25, 0, -24], [32, 0, -12], [-22, 0, -46], [21, 0, -47],
  [-34, 0, 20], [37, 0, 18],
];
// Preserve pickup ids/counts/values, placing rewards and recovery along the routes.
export const routePickupPositions: Record<string, GroundPoint> = {
  'coin-1': [-24, -12], 'coin-2': [-25, -30], 'coin-3': [-22, -48],
  'coin-4': [-10, -52], 'coin-5': [20, -51], 'coin-6': [30, -34],
  'coin-7': [33, 1], 'coin-8': [32, 18],
  'coin-center-1': [-15, 0], 'coin-center-2': [21, -2],
  'coin-center-3': [0, -24], 'coin-center-4': [0, -36],
  'coin-center-5': [-30, 20], 'coin-center-6': [-8, 24], 'coin-center-7': [10, 24],
  'speed-1': [0, -18], 'speed-2': [-24, -5], 'speed-3': [31, -20],
  'speed-center-1': [-18, 24], 'speed-center-2': [21, -10],
  'dark-1': [-32, 23], 'dark-2': [27, -42], 'dark-3': [5, -48],
  'penalty-1': [22, 7], 'penalty-2': [-16, -27], 'penalty-3': [22, -32],
  'penalty-center-1': [-14, 16],
  'light-1': [-10, -20], 'light-2': [18, -24], 'light-3': [-20, -38],
  'light-4': [12, 16], 'light-5': [-15, -8],
};
export const bonusRouteSpots: GroundPoint[] = [[-21, 6], [22, 10], [-23, -12], [27, -15], [0, 23]];
