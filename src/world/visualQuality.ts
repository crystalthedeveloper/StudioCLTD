/** Conservative GPU budget for touch devices and narrow viewports. */
export function isCompactVisualBudget() {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse), (max-width: 768px)").matches;
}
export const sunlightOffset = [-34, 52, 28] as const;
