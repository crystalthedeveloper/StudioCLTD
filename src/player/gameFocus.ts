import { useSyncExternalStore } from "react";

let focused = false;
let elapsed = 0;
let resumedAt = 0;
const subscribers = new Set<(focused: boolean) => void>();

/** Monotonic simulation time; paused wall time is never included. */
export function gameNow() {
  return elapsed + (focused ? performance.now() - resumedAt : 0);
}
export function isGameFocused() { return focused; }
export function setGameFocused(next: boolean) {
  if (focused === next) return;
  elapsed = gameNow();
  resumedAt = performance.now();
  focused = next;
  subscribers.forEach((subscriber) => subscriber(focused));
}
export function subscribeGameFocus(subscriber: (focused: boolean) => void) {
  subscribers.add(subscriber);
  return () => { subscribers.delete(subscriber); };
}
export function useGameFocus() {
  return useSyncExternalStore(subscribeGameFocus, isGameFocused, () => false);
}

type Timer = { callback: () => void; due: number; interval?: number; native?: number };
const timers = new Map<number, Timer>();
let timerId = 0;
function arm(id: number, timer: Timer) {
  if (!focused) return;
  timer.native = window.setTimeout(() => {
    if (!focused || !timers.has(id)) return;
    if (timer.interval === undefined) timers.delete(id);
    else timer.due = gameNow() + timer.interval;
    timer.callback();
    if (timer.interval !== undefined && timers.has(id)) arm(id, timer);
  }, Math.max(0, timer.due - gameNow()));
}
function schedule(callback: () => void, delay = 0, interval?: number) {
  const id = ++timerId;
  const timer = { callback, due: gameNow() + delay, interval };
  timers.set(id, timer);
  arm(id, timer);
  return id;
}
function clear(id?: number | null) {
  if (id == null) return;
  window.clearTimeout(timers.get(id)?.native);
  timers.delete(id);
}
export const gameTimers = {
  setTimeout: (callback: () => void, delay = 0) => schedule(callback, delay),
  setInterval: (callback: () => void, delay = 0) => schedule(callback, delay, Math.max(1, delay)),
  clearTimeout: clear,
  clearInterval: clear,
};
subscribeGameFocus((running) => {
  timers.forEach((timer, id) => {
    window.clearTimeout(timer.native);
    if (running) arm(id, timer);
  });
});
