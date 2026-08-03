export const DISTANCE_FOG_STRENGTH = 1;

export const distanceFog = {
  color: "#20283d",
  near: 55,
  far: 55 + 225 / DISTANCE_FOG_STRENGTH,
} as const;
