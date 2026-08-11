export type HubSection = {
  id: string;
  name: string;
  icon: string;
  position: [number, number, number];
  entrance: [number, number];
  color: string;
  accent: string;
};

const blockSpacing = 48;
export const destinationPlatformRadius = 14;
export const sectionRampApproachLength = 14;
export const sectionRampWidth = 4.2;

export const hubSections: HubSection[] = [
  { id: "tips", name: "Tips", icon: "T", position: [-blockSpacing, 1.5, -blockSpacing], entrance: [0, 1], color: "#63d8ff", accent: "#1aa7ff" },
  { id: "offers", name: "Offers", icon: "O", position: [0, 2.1, -blockSpacing], entrance: [0, 1], color: "#FFE600", accent: "#ff9f1c" },
  { id: "value", name: "Value", icon: "V", position: [blockSpacing, 2.7, -blockSpacing], entrance: [0, 1], color: "#7dffb2", accent: "#26d07c" },
  { id: "quick-fix", name: "Quick Fix", icon: "Q", position: [-blockSpacing, 1.8, 0], entrance: [1, 0], color: "#ffbc75", accent: "#ff6b35" },
  { id: "performance", name: "Performance", icon: "P", position: [blockSpacing, 3, 0], entrance: [-1, 0], color: "#c77dff", accent: "#8a2be2" },
  { id: "urgent-fix", name: "Urgent Fix", icon: "U", position: [-blockSpacing, 2.4, blockSpacing], entrance: [0, -1], color: "#ff5d5d", accent: "#d7263d" },
  { id: "site-improvement", name: "Site Improvement", icon: "S", position: [0, 2.2, blockSpacing], entrance: [0, -1], color: "#70e4ff", accent: "#2a9df4" },
  { id: "showcase", name: "Showcase", icon: "SC", position: [blockSpacing, 1.7, blockSpacing], entrance: [0, -1], color: "#FFE600", accent: "#FFE600" },
];
