import { useEffect, useState } from "react";

export const speedBoostDurationMs = 10000;
let activeUntil = 0;
let endTimeout: number | null = null;
const subscribers = new Set<() => void>();

function emitSpeedBoostChange() {
  subscribers.forEach((subscriber) => subscriber());
}

export function isSpeedBoostActive() {
  return Date.now() < activeUntil;
}

export function subscribeSpeedBoostChange(subscriber: () => void) {
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
  };
}

export function getSpeedBoostRemainingMs() {
  return Math.max(0, activeUntil - Date.now());
}

export function activateSpeedBoost() {
  activeUntil = Date.now() + speedBoostDurationMs;

  if (endTimeout !== null) {
    window.clearTimeout(endTimeout);
  }

  endTimeout = window.setTimeout(() => {
    activeUntil = 0;
    endTimeout = null;
    emitSpeedBoostChange();
  }, speedBoostDurationMs);

  emitSpeedBoostChange();
}

export function resetSpeedBoost() {
  activeUntil = 0;

  if (endTimeout !== null) {
    window.clearTimeout(endTimeout);
    endTimeout = null;
  }

  emitSpeedBoostChange();
}

export function useSpeedBoostRemainingMs() {
  const [remainingMs, setRemainingMs] = useState(getSpeedBoostRemainingMs);

  useEffect(() => {
    const update = () => setRemainingMs(getSpeedBoostRemainingMs());
    const interval = window.setInterval(update, 100);
    const unsubscribe = subscribeSpeedBoostChange(update);
    update();

    return () => {
      window.clearInterval(interval);
      unsubscribe();
    };
  }, []);

  return remainingMs;
}
