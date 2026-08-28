import { PointerEvent, useEffect, useRef } from "react";
import { setTouchCameraInputBlocked } from "../player/cameraInputGuard";
import { setGameFocused } from "../player/gameFocus";
import { MovementControls, setTouchControls, useKeyboardControls } from "../player/useKeyboardControls";

type Direction = keyof MovementControls;

const releasedControls: MovementControls = {
  forward: false,
  backward: false,
  left: false,
  right: false,
};

const directionButtons: Array<{ direction: Direction; label: string; symbol: string }> = [
  { direction: "forward", label: "Forward", symbol: "↑" },
  { direction: "left", label: "Turn or move left", symbol: "←" },
  { direction: "backward", label: "Backward", symbol: "↓" },
  { direction: "right", label: "Turn or move right", symbol: "→" },
];

export function DirectionControls() {
  const activePointersRef = useRef(new Map<number, Direction>());
  const pressed = useKeyboardControls();

  const publishControls = () => {
    const next = { ...releasedControls };
    activePointersRef.current.forEach((direction) => {
      next[direction] = true;
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

  const pressDirection = (direction: Direction, event: PointerEvent<HTMLButtonElement>) => {
    blockGameInput(event);
    activePointersRef.current.set(event.pointerId, direction);
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
      {directionButtons.map(({ direction, label, symbol }) => (
        <button
          key={direction}
          type="button"
          className={`direction-controls__button direction-controls__button--${direction}${pressed[direction] ? " direction-controls__button--pressed" : ""}`}
          aria-label={label}
          aria-pressed={pressed[direction]}
          onContextMenu={(event) => event.preventDefault()}
          onLostPointerCapture={releaseDirection}
          onPointerCancel={releaseDirection}
          onPointerDown={(event) => pressDirection(direction, event)}
          onPointerUp={releaseDirection}
        >
          {symbol}
        </button>
      ))}
    </div>
  );
}
