export const DISTANCE_FOG_STRENGTH = 1;

export const distanceFog = {
  color: "#52748a",
  near: 185,
  far: 180 + 330 / DISTANCE_FOG_STRENGTH,
} as const;
