import { PointerEvent, WheelEvent, useEffect, useRef, useState } from "react";
import { setTrackpadCameraInputBlocked } from "../player/cameraInputGuard";
import { setGameFocused } from "../player/gameFocus";
import { MovementControls, setTrackpadControls } from "../player/useKeyboardControls";

const deadZone = 0.14;

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
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [thumbOffset, setThumbOffset] = useState({ x: 0, y: 0 });

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
    const thumbRadius = (thumbRef.current?.getBoundingClientRect().width ?? 0) / 2;
    const travelRadius = Math.max(0, radius - thumbRadius - 8);

    const nextControls = controlsFromOffset(x, y);
    setThumbOffset({ x: x * travelRadius, y: y * travelRadius });
    setTrackpadControls(nextControls);
  };

  const resetPointer = () => {
    activePointerRef.current = null;
    setTrackpadCameraInputBlocked(false);
    setTrackpadControls({ forward: false, backward: false, left: false, right: false });
    setIsDragging(false);
    setThumbOffset({ x: 0, y: 0 });
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    blockCameraInput(event);
    if (activePointerRef.current !== null) return;

    activePointerRef.current = event.pointerId;
    setIsDragging(true);
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
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resetPointer();
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation?.();
  };

  return (
    <div className="trackpad-shell" aria-label="Movement joystick" onWheel={handleWheel}>
      <div
        ref={padRef}
        className={`trackpad${isDragging ? " trackpad--active" : ""}`}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onLostPointerCapture={resetPointer}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        role="application"
        aria-label="Move character"
      >
        <div
          ref={thumbRef}
          className="trackpad__thumb"
          style={{
            transform: `translate(calc(-50% + ${thumbOffset.x}px), calc(-50% + ${thumbOffset.y}px))`,
          }}
        />
      </div>
    </div>
  );
}
