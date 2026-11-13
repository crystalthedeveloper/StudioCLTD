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

export const hubSections: HubSection[] = [
  { id: "tips", name: "Tips", icon: "T", position: [0, 0.55, -60], entrance: [0, 1], color: "#63d8ff", accent: "#1aa7ff" },
  { id: "offers", name: "Offers", icon: "O", position: [0, 0.55, -135], entrance: [0, 1], color: "#E8ECEF", accent: "#ff9f1c" },
  { id: "value", name: "Value", icon: "V", position: [0, 0.55, -210], entrance: [0, 1], color: "#7dffb2", accent: "#26d07c" },
  { id: "quick-fix", name: "Quick Fix", icon: "Q", position: [0, 0.55, -285], entrance: [0, 1], color: "#ffbc75", accent: "#ff6b35" },
  { id: "urgent-fix", name: "Urgent Fix", icon: "U", position: [0, 0.55, -360], entrance: [0, 1], color: "#ff5d5d", accent: "#d7263d" },
  { id: "performance", name: "Performance", icon: "P", position: [0, 0.55, -435], entrance: [0, 1], color: "#c77dff", accent: "#8a2be2" },
  { id: "site-improvement", name: "Site Improvement", icon: "S", position: [0, 0.55, -510], entrance: [0, 1], color: "#70e4ff", accent: "#2a9df4" },
  { id: "showcase", name: "Showcase", icon: "SC", position: [0, 0.55, -585], entrance: [0, 1], color: "#E8ECEF", accent: "#E8ECEF" },
];

export const levelOrder = hubSections.map(({ id }) => id);
