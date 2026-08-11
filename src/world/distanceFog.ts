export const DISTANCE_FOG_STRENGTH = 1;

export const distanceFog = {
  color: "#8fd3f4",
  near: 105,
  far: 95 + 245 / DISTANCE_FOG_STRENGTH,
} as const;
