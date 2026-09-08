import { gameNow, gameTimers, isGameFocused } from "./gameFocus";
export const powerModes = {
  standard: { label: "01", name: "Standard", pickupSize: 0.24, color: "#339DFF", impactDuration: 0.24, impactSize: 1 },
  rapid: { label: "02", name: "Rapid", pickupSize: 0.36, color: "#FFD60A", impactDuration: 0.18, impactSize: 0.65 },
  power: { label: "03", name: "Power", pickupSize: 0.5, color: "#FF3838", impactDuration: 0.34, impactSize: 1.5 },
} as const;
export type PowerMode = keyof typeof powerModes;

export const powerDurations = { standard: 6000, rapid: 10000, power: 15000 } as const;
export const fixPowerRespawnMs = 20000;
const emptyCharges = (): Record<PowerMode, boolean> => ({ standard: false, rapid: false, power: false });
let charges = emptyCharges();
let selected: PowerMode | null = null;
let cursor: PowerMode | null = null;
let active: PowerMode | null = null;
let activeUntil = 0;
let expiry: number | undefined;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());
export const subscribePowers = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getFixCharges = () => charges;
export const getSelectedPower = () => selected;
export const getPowerRemainingMs = () => Math.max(0, activeUntil - gameNow());
export const getActivePower = () => getPowerRemainingMs() > 0 ? active : null;
export const isPowerActive = () => getActivePower() !== null;
export const hasPowerSpeedBoost = () => getActivePower() === "rapid";
export const canActivatePower = () => !isPowerActive() && selected !== null && charges[selected];
export function getPowerStatus(mode: PowerMode) {
  if (getActivePower() === mode) return "ACTIVE";
  if (selected === mode && charges[mode]) return "SELECTED";
  return charges[mode] ? "READY" : "EMPTY";
}
export function collectFixPower(mode: PowerMode) {
  if (!isGameFocused()) return false;
  if (getActivePower() === mode) {
    startPowerTimer(mode);
    notify();
    return true;
  }
  if (charges[mode]) return false;
  charges = { ...charges, [mode]: true };
  notify();
  return true;
}
export function selectFixPower(mode: PowerMode) {
  if (!isGameFocused() || !charges[mode]) return false;
  selected = cursor = mode;
  notify();
  return true;
}
export function cycleFixPower() {
  const modes = Object.keys(powerModes) as PowerMode[];
  const start = cursor === null ? -1 : modes.indexOf(cursor);
  for (let offset = 1; offset <= modes.length; offset++) {
    const mode = modes[(start + offset) % modes.length];
    if (charges[mode]) return selectFixPower(mode);
  }
  return false;
}
function startPowerTimer(mode: PowerMode) {
  activeUntil = gameNow() + powerDurations[mode];
  gameTimers.clearTimeout(expiry);
  expiry = gameTimers.setTimeout(() => {
    active = null;
    activeUntil = 0;
    expiry = undefined;
    notify();
  }, powerDurations[mode]);
}
export function activateSelectedPower() {
  if (!isGameFocused() || !canActivatePower() || selected === null) return false;
  active = selected;
  charges = { ...charges, [selected]: false };
  selected = null;
  startPowerTimer(active);
  notify();
  return true;
}
export function handlePowerShortcut(code: string) {
  if (code === "KeyG") return cycleFixPower();
  if (code === "Space") return activateSelectedPower();
  return false;
}
/** Shared by both villain types; only real, unobstructed contact can defeat them. */
export function resolvePowerContact(touching: boolean, defeat: (mode: PowerMode) => void) {
  const mode = getActivePower();
  if (!isGameFocused() || !touching || mode === null) return false;
  defeat(mode);
  return true;
}
export function resetTemporaryPowers() {
  gameTimers.clearTimeout(expiry);
  expiry = undefined;
  charges = emptyCharges();
  selected = cursor = active = null;
  activeUntil = 0;
  notify();
}
