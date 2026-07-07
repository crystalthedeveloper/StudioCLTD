export type HubSection = {
  id: string;
  name: string;
  icon: string;
  position: [number, number, number];
  color: string;
  accent: string;
};

const radius = 52;

export const hubSections: HubSection[] = [
  { id: "tips", name: "Tips", icon: "T", position: [0, 0, -radius], color: "#63d8ff", accent: "#1aa7ff" },
  { id: "offers", name: "Offers", icon: "O", position: [37, 0, -37], color: "#ffd166", accent: "#ff9f1c" },
  { id: "value", name: "Value", icon: "V", position: [radius, 0, 0], color: "#7dffb2", accent: "#26d07c" },
  { id: "quick-fix", name: "Quick Fix", icon: "Q", position: [37, 0, 37], color: "#ffbc75", accent: "#ff6b35" },
  { id: "urgent-fix", name: "Urgent Fix", icon: "U", position: [0, 0, radius], color: "#ff5d5d", accent: "#d7263d" },
  { id: "performance", name: "Performance", icon: "P", position: [-37, 0, 37], color: "#c77dff", accent: "#8a2be2" },
  { id: "site-improvement", name: "Site Improvement", icon: "S", position: [-radius, 0, 0], color: "#70e4ff", accent: "#2a9df4" },
  { id: "showcase", name: "Showcase", icon: "SC", position: [-37, 0, -37], color: "#f9f871", accent: "#f2c94c" },
];
