import { useEffect, useState } from "react";

const boostDurationMs = 10000;
let activeUntil = 0;
let endTimeout: number | null = null;
const subscribers = new Set<() => void>();

function emitSpeedBoostChange() {
  subscribers.forEach((subscriber) => subscriber());
}

export function isSpeedBoostActive() {
  return Date.now() < activeUntil;
}

export function getSpeedBoostRemainingMs() {
  return Math.max(0, activeUntil - Date.now());
}

export function activateSpeedBoost() {
  activeUntil = Date.now() + boostDurationMs;

  if (endTimeout !== null) {
    window.clearTimeout(endTimeout);
  }

  endTimeout = window.setTimeout(() => {
    activeUntil = 0;
    endTimeout = null;
    emitSpeedBoostChange();
  }, boostDurationMs);

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

export function useSpeedBoostRemainingSeconds() {
  const [remainingSeconds, setRemainingSeconds] = useState(() => Math.ceil(getSpeedBoostRemainingMs() / 1000));

  useEffect(() => {
    const update = () => setRemainingSeconds(Math.ceil(getSpeedBoostRemainingMs() / 1000));
    const interval = window.setInterval(update, 200);

    subscribers.add(update);
    update();

    return () => {
      window.clearInterval(interval);
      subscribers.delete(update);
    };
  }, []);

  return remainingSeconds;
}
