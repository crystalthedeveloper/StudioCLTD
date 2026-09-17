import { requestPoweredJump, resetPoweredJump } from "./poweredJump";
import { gameNow, gameTimers, isGameFocused } from "./gameFocus";
export const powerModes = {
  standard: { label: "01", name: "Wind", pickupSize: 0.24, color: "#2F6FAF", impactDuration: 0.24, impactSize: 1 },
  rapid: { label: "02", name: "Shock", pickupSize: 0.36, color: "#6B3A8E", impactDuration: 0.18, impactSize: 0.65 },
  power: { label: "03", name: "Fire", pickupSize: 0.5, color: "#B63A3A", impactDuration: 0.34, impactSize: 1.5 },
} as const;
export type PowerMode = keyof typeof powerModes;

export const powerDurations = { standard: 6000, rapid: 10000, power: 15000 } as const;
export const fixPowerRespawnMs = 20000;
export const powerOrder: PowerMode[] = ["standard", "rapid", "power"];
export const powerCashRewards: Record<PowerMode, number> = { standard: 3, rapid: 10, power: 20 };
const activeUntil: Record<PowerMode, number> = { standard: 0, rapid: 0, power: 0 };
const expiry: Partial<Record<PowerMode, number>> = {};
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());
export const subscribePowers = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getPowerRemainingMs = (mode: PowerMode) => Math.max(0, activeUntil[mode] - gameNow());
/** Stable scalar snapshot for React; all timers are independent. */
export const getActivePowerMask = () => powerOrder.reduce((mask, mode, index) => mask | (getPowerRemainingMs(mode) > 0 ? 1 << index : 0), 0);
export const getActivePowers = () => powerOrder.filter(mode => getPowerRemainingMs(mode) > 0);
// One representative colour for existing hit feedback, never for timer ownership.
export const getActivePower = () => getActivePowers().slice(-1)[0] ?? null;
export const isPowerActive = () => getActivePowerMask() !== 0;
export const hasPowerSpeedBoost = () => getPowerRemainingMs("rapid") > 0;
export const getPowerStatus = (mode: PowerMode) => getPowerRemainingMs(mode) > 0 ? "ACTIVE" : "EMPTY";
export function collectFixPower(mode: PowerMode) {
  if (!isGameFocused()) return false;
  gameTimers.clearTimeout(expiry[mode]);
  activeUntil[mode] = gameNow() + powerDurations[mode];
  expiry[mode] = gameTimers.setTimeout(() => {
    activeUntil[mode] = 0;
    delete expiry[mode];
    notify();
  }, powerDurations[mode]);
  notify();
  return true;
}
export function jumpWithPower() {
  return isGameFocused() && isPowerActive() && requestPoweredJump();
}
export function handlePowerShortcut(code: string) {
  return code === "Space" && jumpWithPower();
}
const defeatedByPower = new Set<string>();
export function resetPowerContact(id: string) { defeatedByPower.delete(id); }
/** Snapshot every active reward before invoking effects/rewards; claim each life once. */
export function resolvePowerContact(touching: boolean, id: string, defeat: (mode: PowerMode, reward: number) => void) {
  const modes = getActivePowers();
  if (!isGameFocused() || !touching || modes.length === 0 || defeatedByPower.has(id)) return false;
  defeatedByPower.add(id);
  const reward = modes.reduce((sum, mode) => sum + powerCashRewards[mode], 0);
  defeat(modes[modes.length - 1], reward);
  return true;
}
export function resetTemporaryPowers() {
  defeatedByPower.clear();
  resetPoweredJump();
  powerOrder.forEach(mode => {
    gameTimers.clearTimeout(expiry[mode]);
    delete expiry[mode];
    activeUntil[mode] = 0;
  });
  notify();
}
