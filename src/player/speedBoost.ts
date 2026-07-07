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
  console.log("Speed power-up picked up");
  console.log("Speed boost active");
  activeUntil = Date.now() + boostDurationMs;

  if (endTimeout !== null) {
    window.clearTimeout(endTimeout);
  }

  endTimeout = window.setTimeout(() => {
    activeUntil = 0;
    endTimeout = null;
    console.log("Speed boost ended");
    emitSpeedBoostChange();
  }, boostDurationMs);

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
