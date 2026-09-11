import type { PowerMode } from "./temporaryPowers";

/** Shared SVG sources for world pickups and HUD buttons. */
export const powerIcons = {
  standard: { src: "/images/powers/wind.svg", worldSrc: "/images/powers/wind-world.svg", name: "Wind" },
  rapid: { src: "/images/powers/lightning.svg", worldSrc: "/images/powers/lightning-world.svg", name: "Lightning" },
  power: { src: "/images/powers/fire.svg", worldSrc: "/images/powers/fire-world.svg", name: "Fire" },
} satisfies Record<PowerMode, { src: string; worldSrc: string; name: string }>;
