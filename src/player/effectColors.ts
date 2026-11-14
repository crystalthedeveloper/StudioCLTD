/** Shared brand colour for HUD, pickups, lights, power effects and completion states. */
export const brandYellow = "#FFD60A";

export const effectColors = {
  wind: "#009B3A",
  shock: brandYellow,
  fire: "#CE1126",
} as const;

export const effectCoreColors = {
  wind: "#315f3d",
  shock: brandYellow,
  fire: "#d34a28",
  none: "#111318",
} as const;
