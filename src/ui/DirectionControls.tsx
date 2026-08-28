import { PointerEvent, useEffect, useRef } from "react";
import { setTouchCameraInputBlocked } from "../player/cameraInputGuard";
import { setGameFocused } from "../player/gameFocus";
import { MovementControls, setTouchControls, useKeyboardControls } from "../player/useKeyboardControls";

type Direction = keyof MovementControls;
type DirectionButton = {
  directions: readonly Direction[];
  id: string;
  label: string;
  symbol: string;
};

const releasedControls: MovementControls = {
  forward: false,
  backward: false,
  left: false,
  right: false,
};

const directionButtons: DirectionButton[] = [
  { directions: ["forward", "left"], id: "forward-left", label: "Forward and left", symbol: "↖" },
  { directions: ["forward"], id: "forward", label: "Forward", symbol: "↑" },
  { directions: ["forward", "right"], id: "forward-right", label: "Forward and right", symbol: "↗" },
  { directions: ["left"], id: "left", label: "Turn or move left", symbol: "←" },
  { directions: ["backward"], id: "backward", label: "Backward", symbol: "↓" },
  { directions: ["right"], id: "right", label: "Turn or move right", symbol: "→" },
];

export function DirectionControls() {
  const activePointersRef = useRef(new Map<number, readonly Direction[]>());
  const pressed = useKeyboardControls();

  const publishControls = () => {
    const next = { ...releasedControls };
    activePointersRef.current.forEach((directions) => {
      directions.forEach((direction) => {
        next[direction] = true;
      });
    });
    setTouchControls(next);
    setTouchCameraInputBlocked(activePointersRef.current.size > 0);
  };

  const releaseAll = () => {
    activePointersRef.current.clear();
    setTouchControls(releasedControls);
    setTouchCameraInputBlocked(false);
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) releaseAll();
    };
    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      releaseAll();
    };
  }, []);

  const blockGameInput = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation?.();
  };

  const pressDirection = (directions: readonly Direction[], event: PointerEvent<HTMLButtonElement>) => {
    blockGameInput(event);
    activePointersRef.current.set(event.pointerId, directions);
    event.currentTarget.setPointerCapture(event.pointerId);
    setGameFocused(true);
    document.exitPointerLock?.();
    publishControls();
  };

  const releaseDirection = (event: PointerEvent<HTMLButtonElement>) => {
    blockGameInput(event);
    activePointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    publishControls();
  };

  return (
    <div className="direction-controls" aria-label="Movement controls">
      {directionButtons.map(({ directions, id, label, symbol }) => {
        const active = directions.every((direction) => pressed[direction]);
        return (
        <button
          key={id}
          type="button"
          className={`direction-controls__button direction-controls__button--${id}${active ? " direction-controls__button--pressed" : ""}`}
          aria-label={label}
          aria-pressed={active}
          onContextMenu={(event) => event.preventDefault()}
          onLostPointerCapture={releaseDirection}
          onPointerCancel={releaseDirection}
          onPointerDown={(event) => pressDirection(directions, event)}
          onPointerUp={releaseDirection}
        >
          {symbol}
        </button>
        );
      })}
    </div>
  );
}
