import { gameNow } from "./gameFocus";
import { gameTimers } from "./gameFocus";
import { useEffect, useState } from "react";

export const speedBoostDurationMs = 10000;
let activeUntil = 0;
let endTimeout: number | null = null;
const subscribers = new Set<() => void>();

function emitSpeedBoostChange() {
  subscribers.forEach((subscriber) => subscriber());
}

export function isSpeedBoostActive() {
  return gameNow() < activeUntil;
}

export function subscribeSpeedBoostChange(subscriber: () => void) {
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
  };
}

export function getSpeedBoostRemainingMs() {
  return Math.max(0, activeUntil - gameNow());
}

export function activateSpeedBoost() {
  activeUntil = gameNow() + speedBoostDurationMs;

  if (endTimeout !== null) {
    gameTimers.clearTimeout(endTimeout);
  }

  endTimeout = gameTimers.setTimeout(() => {
    activeUntil = 0;
    endTimeout = null;
    emitSpeedBoostChange();
  }, speedBoostDurationMs);

  emitSpeedBoostChange();
}

export function resetSpeedBoost() {
  activeUntil = 0;

  if (endTimeout !== null) {
    gameTimers.clearTimeout(endTimeout);
    endTimeout = null;
  }

  emitSpeedBoostChange();
}

export function useSpeedBoostRemainingMs() {
  const [remainingMs, setRemainingMs] = useState(getSpeedBoostRemainingMs);

  useEffect(() => {
    const update = () => setRemainingMs(getSpeedBoostRemainingMs());
    const interval = gameTimers.setInterval(update, 100);
    const unsubscribe = subscribeSpeedBoostChange(update);
    update();

    return () => {
      gameTimers.clearInterval(interval);
      unsubscribe();
    };
  }, []);

  return remainingMs;
}
