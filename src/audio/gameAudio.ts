import { useSyncExternalStore } from "react";

const storageKey = "studiocltd:audio-enabled";
const subscribers = new Set<() => void>();

function readStoredPreference() {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(storageKey) !== "false";
  } catch {
    return true;
  }
}

let audioEnabled = readStoredPreference();
let gameAudioLocked = false;

export function isGameAudioEnabled() {
  return audioEnabled;
}

export function isGameAudioLocked() {
  return gameAudioLocked;
}

export function beginGameAudioLock() {
  gameAudioLocked = true;
}

export function endGameAudioLock() {
  gameAudioLocked = false;
}

export function setGameAudioEnabled(enabled: boolean) {
  if (audioEnabled === enabled) return;
  audioEnabled = enabled;
  try {
    window.localStorage.setItem(storageKey, String(enabled));
  } catch {
    // Audio still toggles for this visit if storage is unavailable.
  }
  subscribers.forEach((subscriber) => subscriber());
}

export function subscribeGameAudio(subscriber: () => void) {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

export function useGameAudioEnabled() {
  return useSyncExternalStore(subscribeGameAudio, isGameAudioEnabled, () => true);
}
