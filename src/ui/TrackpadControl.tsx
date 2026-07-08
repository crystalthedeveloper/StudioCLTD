import { PointerEvent, WheelEvent, useEffect, useRef, useState } from "react";
import { setTrackpadCameraInputBlocked } from "../player/cameraInputGuard";
import { setGameFocused } from "../player/gameFocus";
import { MovementControls, setTrackpadControls } from "../player/useKeyboardControls";

const deadZone = 0.18;

function controlsFromOffset(x: number, y: number): MovementControls {
  return {
    forward: y < -deadZone,
    backward: y > deadZone,
    left: x < -deadZone,
    right: x > deadZone,
  };
}

export function TrackpadControl() {
  const padRef = useRef<HTMLDivElement | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const [thumb, setThumb] = useState({ x: 0, y: 0 });

  useEffect(() => {
    return () => {
      setTrackpadCameraInputBlocked(false);
      setTrackpadControls({ forward: false, backward: false, left: false, right: false });
    };
  }, []);

  const blockCameraInput = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation?.();
  };

  const updatePointer = (event: PointerEvent<HTMLDivElement>) => {
    blockCameraInput(event);

    const pad = padRef.current;
    if (!pad) return;

    const rect = pad.getBoundingClientRect();
    const radius = rect.width / 2;
    const centerX = rect.left + radius;
    const centerY = rect.top + radius;
    const rawX = (event.clientX - centerX) / radius;
    const rawY = (event.clientY - centerY) / radius;
    const length = Math.hypot(rawX, rawY);
    const scale = length > 1 ? 1 / length : 1;
    const x = rawX * scale;
    const y = rawY * scale;

    const nextControls = controlsFromOffset(x, y);
    setThumb({ x, y });
    setTrackpadControls(nextControls);
  };

  const resetPointer = (log = true) => {
    const wasActive = activePointerRef.current !== null;
    activePointerRef.current = null;
    setTrackpadCameraInputBlocked(false);
    setThumb({ x: 0, y: 0 });
    setTrackpadControls({ forward: false, backward: false, left: false, right: false });
    void log;
    void wasActive;
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    blockCameraInput(event);
    activePointerRef.current = event.pointerId;
    setTrackpadCameraInputBlocked(true);
    setGameFocused(true);
    document.exitPointerLock?.();
    event.currentTarget.setPointerCapture(event.pointerId);
    updatePointer(event);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    blockCameraInput(event);
    if (activePointerRef.current !== event.pointerId) return;
    updatePointer(event);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    blockCameraInput(event);
    if (activePointerRef.current !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    resetPointer();
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation?.();
  };

  return (
    <div className="trackpad-shell" aria-label="Movement trackpad" onWheel={handleWheel}>
      <div
        ref={padRef}
        className="trackpad"
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerLeave={handlePointerUp}
        onLostPointerCapture={() => resetPointer(false)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        role="application"
      >
        <div
          className="trackpad__thumb"
          style={{
            transform: `translate(calc(-50% + ${thumb.x * 42}px), calc(-50% + ${thumb.y * 42}px))`,
          }}
        />
      </div>
    </div>
  );
}
