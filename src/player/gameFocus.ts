import { useEffect, useState } from "react";

let focused = false;
const subscribers = new Set<(nextFocused: boolean) => void>();

export function isGameFocused() {
  return focused;
}

export function setGameFocused(nextFocused: boolean) {
  if (focused === nextFocused) return;
  focused = nextFocused;
  subscribers.forEach((subscriber) => subscriber(focused));
}

export function subscribeGameFocus(subscriber: (nextFocused: boolean) => void) {
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
  };
}

export function useGameFocus() {
  const [isFocused, setIsFocused] = useState(focused);

  useEffect(() => subscribeGameFocus(setIsFocused), []);

  return isFocused;
}
