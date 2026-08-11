import { useEffect, useState } from "react";
import { isGameFocused, subscribeGameFocus } from "./gameFocus";

export type MovementControls = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
};

export type KeyboardControls = MovementControls;

const keyMap: Record<string, keyof MovementControls> = {
  KeyW: "forward",
  ArrowUp: "forward",
  KeyS: "backward",
  ArrowDown: "backward",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
};

const initialControls: MovementControls = {
  forward: false,
  backward: false,
  left: false,
  right: false,
};

const keyboardControls = { ...initialControls };
const trackpadControls = { ...initialControls };
const subscribers = new Set<(controls: MovementControls) => void>();

function mergeControls(): MovementControls {
  if (!isGameFocused()) {
    return { ...initialControls };
  }

  return {
    forward: keyboardControls.forward || trackpadControls.forward,
    backward: keyboardControls.backward || trackpadControls.backward,
    left: keyboardControls.left || trackpadControls.left,
    right: keyboardControls.right || trackpadControls.right,
  };
}

function resetControls() {
  (Object.keys(initialControls) as (keyof MovementControls)[]).forEach((key) => {
    keyboardControls[key] = false;
    trackpadControls[key] = false;
  });
  emitControls();
}

function emitControls() {
  const controls = mergeControls();
  subscribers.forEach((subscriber) => subscriber(controls));
}

export function setTrackpadControls(nextControls: MovementControls) {
  if (!isGameFocused()) {
    resetControls();
    return;
  }

  let changed = false;
  (Object.keys(initialControls) as (keyof MovementControls)[]).forEach((key) => {
    if (trackpadControls[key] === nextControls[key]) return;
    trackpadControls[key] = nextControls[key];
    changed = true;
  });

  if (changed) {
    emitControls();
  }
}

export function useKeyboardControls() {
  const [controls, setControls] = useState<MovementControls>(mergeControls);

  useEffect(() => {
    const updateKey = (event: KeyboardEvent, pressed: boolean) => {
      const control = keyMap[event.code];
      if (!control) return;

      event.preventDefault();
      if (!isGameFocused()) {
        resetControls();
        return;
      }

      if (keyboardControls[control] === pressed) return;
      keyboardControls[control] = pressed;
      emitControls();
    };

    const handleKeyDown = (event: KeyboardEvent) => updateKey(event, true);
    const handleKeyUp = (event: KeyboardEvent) => updateKey(event, false);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    const unsubscribeFocus = subscribeGameFocus((focused) => {
      if (!focused) {
        resetControls();
        return;
      }

      emitControls();
    });
    subscribers.add(setControls);
    setControls(mergeControls());

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      unsubscribeFocus();
      subscribers.delete(setControls);
    };
  }, []);

  return controls;
}
