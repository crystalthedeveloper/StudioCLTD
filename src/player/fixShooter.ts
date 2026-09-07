import { gameNow, gameTimers, isGameFocused, subscribeGameFocus } from "./gameFocus";

export const fixModes = {
  standard: { label: "01", shortcut: "G", keyCode: "KeyG", ammo: 10, pickupSize: 0.24, cooldown: 180, damage: 1, speed: 140, size: 1, color: "#FFFFFF", glow: "#FFFFFF", impactDuration: 0.24, flashDuration: 0.09 },
  rapid: { label: "02", shortcut: "H", keyCode: "KeyH", ammo: 20, pickupSize: 0.36, cooldown: 100, damage: 0.4, speed: 160, size: 0.65, color: "#FFD60A", glow: "#FFD60A", impactDuration: 0.18, flashDuration: 0.07 },
  power: { label: "03", shortcut: "J", keyCode: "KeyJ", ammo: 5, pickupSize: 0.5, cooldown: 650, damage: 2, speed: 70, size: 1.9, color: "#FF3838", glow: "#FF3838", impactDuration: 0.34, flashDuration: 0.12 },
} as const;
export type FixMode = keyof typeof fixModes;
export const fixShotCooldownMs = fixModes.standard.cooldown;
export const startingFixAmmo = 0;
export const fixAmmoRespawnMs = 20000;
const emptyReserves = () => ({ standard: startingFixAmmo, rapid: startingFixAmmo, power: startingFixAmmo });
let reserves = emptyReserves();
export const getFixReserves = () => reserves;
let mode: FixMode = "standard";
export const getFixAmmo = () => reserves[mode];
export const getFixMode = () => mode;
function notifyInput() { inputListeners.forEach((listener) => listener()); }
export function selectFixWeapon(nextMode: FixMode) {
  if (!isGameFocused() || reserves[nextMode] <= 0) return false;
  mode = nextMode;
  // A selection never inherits a held firing input or bypasses its cooldown.
  releaseFixInput();
  return true;
}
export function selectFixWeaponByKey(code: string) {
  const next = (Object.keys(fixModes) as FixMode[]).find((key) => fixModes[key].keyCode === code);
  return next ? selectFixWeapon(next) : false;
}
/** Pickups add only to their own reserve; preserve a usable selected weapon. */
export function collectFixAmmo(pickupMode: FixMode) {
  if (!isGameFocused()) return false;
  const needsSelection = getFixAmmo() <= 0;
  reserves = { ...reserves, [pickupMode]: reserves[pickupMode] + fixModes[pickupMode].ammo };
  if (needsSelection) { mode = pickupMode; releaseFixInput(); }
  notifyInput();
  repeat();
  return true;
}
export const maxFixShots = 8;
const held = new Set<string>();
const active = new Set<number>();
const shotListeners = new Set<(id: number, mode: FixMode) => void>();
const inputListeners = new Set<() => void>();
let nextId = 0;
let nextShotAt = 0;
let repeatTimer: number | undefined;
export let lastFixShotAt = -Infinity;
export let lastFixHitAt = -Infinity;
export let lastFixHitMode: FixMode = "standard";
export const isFixHeld = () => held.size > 0;
export function subscribeFixInput(listener: () => void) {
  inputListeners.add(listener);
  return () => { inputListeners.delete(listener); };
}
export function subscribeFixShot(listener: (id: number, mode: FixMode) => void) {
  shotListeners.add(listener);
  return () => { shotListeners.delete(listener); };
}
export function releaseFixShot(id: number) {
  if (active.delete(id) && isFixHeld()) repeat();
}
export function recordFixHit(shotMode: FixMode) { lastFixHitAt = gameNow(); lastFixHitMode = shotMode; }
export function fireFixShot() {
  if (!isGameFocused() || gameNow() < nextShotAt || getFixAmmo() <= 0 || active.size >= maxFixShots || shotListeners.size === 0) return false;
  const id = ++nextId;
  active.add(id);
  const shotMode = mode;
  reserves = { ...reserves, [shotMode]: reserves[shotMode] - 1 };
  notifyInput();
  lastFixShotAt = gameNow();
  nextShotAt = lastFixShotAt + fixModes[shotMode].cooldown;
  shotListeners.forEach((listener) => listener(id, shotMode));
  return true;
}
function repeat() {
  gameTimers.clearTimeout(repeatTimer);
  if (!isFixHeld() || !isGameFocused() || getFixAmmo() <= 0 || active.size >= maxFixShots) return;
  repeatTimer = gameTimers.setTimeout(() => { fireFixShot(); repeat(); }, Math.max(16, nextShotAt - gameNow()));
}
export function setFixHeld(source: string, pressed: boolean) {
  if (pressed && isGameFocused()) {
    if (held.has(source)) return;
    held.add(source);
    fireFixShot();
  } else held.delete(source);
  inputListeners.forEach((listener) => listener());
  repeat();
}
export function releaseFixInput() {
  held.clear();
  gameTimers.clearTimeout(repeatTimer);
  inputListeners.forEach((listener) => listener());
}
export function resetFixShooter() {
  releaseFixInput();
  active.clear();
  reserves = emptyReserves();
  mode = "standard";
  notifyInput();
  nextShotAt = 0;
  lastFixShotAt = lastFixHitAt = -Infinity;
}
subscribeGameFocus((running) => { if (!running) releaseFixInput(); });
