import { gameNow } from "./gameFocus";

const shakeDurationMs = 280;
let shakeUntil = 0;
let shakeSeed = 0;

export function triggerDamageFeedback() {
  shakeUntil = gameNow() + shakeDurationMs;
  shakeSeed += 1;
}

export function getDamageShake(now = gameNow()) {
  if (now >= shakeUntil) return { amount: 0, seed: shakeSeed };
  return { amount: 1 - (now - (shakeUntil - shakeDurationMs)) / shakeDurationMs, seed: shakeSeed };
}
