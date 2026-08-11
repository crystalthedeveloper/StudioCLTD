function canUseMobileHaptics() {
  if (typeof window === "undefined" || typeof navigator.vibrate !== "function") return false;
  const hasTouch = navigator.maxTouchPoints > 0;
  const hasCoarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  return hasTouch || hasCoarsePointer;
}

function vibrate(pattern: number | number[]) {
  if (!canUseMobileHaptics()) return;
  navigator.vibrate(pattern);
}

export function triggerFixHaptic() {
  vibrate(28);
}

export function triggerTrophyHaptic() {
  vibrate([45, 35, 70]);
}
