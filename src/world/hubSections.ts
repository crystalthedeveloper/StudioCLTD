export type HubSection = {
  id: string;
  name: string;
  icon: string;
  position: [number, number, number];
  entrance: [number, number];
  color: string;
  accent: string;
};

export const destinationPlatformRadius = 11;
export const sectionRampApproachLength = 8;
export const sectionRampWidth = 4.2;
export const sharedRoadSurfaceY = 0.84;
const roadStartZ = 28;
const roadTurnScale = Math.PI / 160;
export function roadCenterX(z: number) {
  const distance = roadStartZ - z;
  return 8.5 * Math.sin(distance * roadTurnScale) + 2.8 * Math.sin(distance * roadTurnScale * 0.47);
}
export function roadHeight(z: number) {
  const distance = roadStartZ - z;
  return sharedRoadSurfaceY + distance * 0.0014 + 0.42 * Math.sin(distance * Math.PI / 280) + 0.18 * Math.sin(distance * Math.PI / 124);
}
export function roadTangent(z: number) {
  const step = 0.1;
  const dx = roadCenterX(z - step) - roadCenterX(z + step);
  const dz = -step * 2;
  const length = Math.hypot(dx, dz);
  const tangentX = dx / length;
  return [tangentX, Math.sign(dz) * Math.sqrt(Math.max(0, 1 - tangentX * tangentX))] as const;
}
export function roadPoint(localX: number, z: number, yOffset = 0) {
  const tangent = roadTangent(z);
  return [roadCenterX(z) - tangent[1] * localX, roadHeight(z) + yOffset, z] as const;
}

export const hubSections: HubSection[] = [
  ...[
    ["tips", "Tips", "T", -65, "#63d8ff", "#1aa7ff"], ["offers", "Offers", "O", -115, "#E8ECEF", "#ff9f1c"],
    ["value", "Value", "V", -165, "#7dffb2", "#26d07c"], ["quick-fix", "Quick Fix", "Q", -215, "#ffbc75", "#ff6b35"],
    ["urgent-fix", "Urgent Fix", "U", -265, "#ff5d5d", "#d7263d"], ["performance", "Performance", "P", -315, "#c77dff", "#8a2be2"],
    ["site-improvement", "Site Improvement", "S", -365, "#70e4ff", "#2a9df4"], ["showcase", "Showcase", "SC", -415, "#E8ECEF", "#E8ECEF"],
  ].map(([id, name, icon, z, color, accent]) => {
    const tangent = roadTangent(Number(z));
    return { id: String(id), name: String(name), icon: String(icon), position: [roadCenterX(Number(z)), roadHeight(Number(z)) - 0.29, Number(z)] as [number, number, number], entrance: [tangent[0], tangent[1]] as [number, number], color: String(color), accent: String(accent) };
  }),
];

export const levelOrder = hubSections.map(({ id }) => id);
