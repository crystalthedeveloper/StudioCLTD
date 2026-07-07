import { useEffect, useMemo, useState } from "react";

export type KeyboardControls = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  run: boolean;
  jump: boolean;
};

const keyMap: Record<string, keyof KeyboardControls> = {
  KeyW: "forward",
  ArrowUp: "forward",
  KeyS: "backward",
  ArrowDown: "backward",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  ShiftLeft: "run",
  ShiftRight: "run",
  Space: "jump",
};

const initialControls: KeyboardControls = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  run: false,
  jump: false,
};

export function useKeyboardControls() {
  const [controls, setControls] = useState<KeyboardControls>(initialControls);

  useEffect(() => {
    const updateKey = (event: KeyboardEvent, pressed: boolean) => {
      const control = keyMap[event.code];
      if (!control) return;

      event.preventDefault();
      setControls((current) => {
        if (current[control] === pressed) return current;
        return { ...current, [control]: pressed };
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => updateKey(event, true);
    const handleKeyUp = (event: KeyboardEvent) => updateKey(event, false);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  return useMemo(() => controls, [controls]);
}
