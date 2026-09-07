import { gameNow, gameTimers, isGameFocused, subscribeGameFocus } from "./gameFocus";

export const fixShotCooldownMs = 180;
export const maxFixShots = 8;
const held = new Set<string>();
const active = new Set<number>();
const shotListeners = new Set<(id: number) => void>();
const inputListeners = new Set<() => void>();
let nextId = 0;
let nextShotAt = 0;
let repeatTimer: number | undefined;
export let lastFixShotAt = -Infinity;
export let lastFixHitAt = -Infinity;
export const isFixHeld = () => held.size > 0;
export function subscribeFixInput(listener: () => void) {
  inputListeners.add(listener);
  return () => { inputListeners.delete(listener); };
}
export function subscribeFixShot(listener: (id: number) => void) {
  shotListeners.add(listener);
  return () => { shotListeners.delete(listener); };
}
export function releaseFixShot(id: number) { active.delete(id); }
export function recordFixHit() { lastFixHitAt = gameNow(); }
export function fireFixShot() {
  if (!isGameFocused() || gameNow() < nextShotAt || active.size >= maxFixShots || shotListeners.size === 0) return false;
  const id = ++nextId;
  active.add(id);
  lastFixShotAt = gameNow();
  nextShotAt = lastFixShotAt + fixShotCooldownMs;
  shotListeners.forEach((listener) => listener(id));
  return true;
}
function repeat() {
  gameTimers.clearTimeout(repeatTimer);
  if (!isFixHeld() || !isGameFocused()) return;
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
  nextShotAt = 0;
  lastFixShotAt = lastFixHitAt = -Infinity;
}
subscribeGameFocus((running) => { if (!running) releaseFixInput(); });
