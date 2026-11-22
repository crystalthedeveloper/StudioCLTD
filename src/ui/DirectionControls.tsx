import { PointerEvent, useEffect, useRef, useState } from "react";
import { setTouchCameraInputBlocked } from "../player/cameraInputGuard";
import { isGameFocused, subscribeGameFocus } from "../player/gameFocus";
import { MovementControls, setTouchControls, useKeyboardControls } from "../player/useKeyboardControls";

const deadZone = 0.18;
const releasedControls: MovementControls = { cruise: false, forward: false, backward: false, left: false, right: false };

function controlsFromStick(x: number, y: number): MovementControls {
  return { cruise: false, forward: y < -deadZone, backward: y > deadZone, left: x < -deadZone, right: x > deadZone };
}

export function DirectionControls() {
  const baseRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const pressed = useKeyboardControls();

  const releaseJoystick = () => {
    pointerIdRef.current = null;
    setKnob({ x: 0, y: 0 });
    setTouchControls(releasedControls);
    setTouchCameraInputBlocked(false);
  };

  useEffect(() => {
    const release = () => releaseJoystick();
    const unsubscribe = subscribeGameFocus((running) => { if (!running) release(); });
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", release);
    return () => {
      unsubscribe();
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", release);
      release();
    };
  }, []);

  const updateJoystick = (event: PointerEvent<HTMLDivElement>) => {
    const base = baseRef.current;
    if (!base || !isGameFocused()) return;
    const bounds = base.getBoundingClientRect();
    const radius = Math.min(bounds.width, bounds.height) * 0.5;
    let x = event.clientX - (bounds.left + bounds.width * 0.5);
    let y = event.clientY - (bounds.top + bounds.height * 0.5);
    const distance = Math.hypot(x, y);
    if (distance > radius) { x = (x / distance) * radius; y = (y / distance) * radius; }
    const normalizedX = x / radius;
    const normalizedY = y / radius;
    setKnob({ x: normalizedX * 50, y: normalizedY * 50 });
    setTouchControls(controlsFromStick(normalizedX, normalizedY));
  };

  const blockPointer = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation?.();
  };

  const startJoystick = (event: PointerEvent<HTMLDivElement>) => {
    blockPointer(event);
    if (!isGameFocused()) return;
    pointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    setTouchCameraInputBlocked(true);
    updateJoystick(event);
  };

  const moveJoystick = (event: PointerEvent<HTMLDivElement>) => {
    blockPointer(event);
    if (pointerIdRef.current === event.pointerId) updateJoystick(event);
  };

  const endJoystick = (event: PointerEvent<HTMLDivElement>) => {
    blockPointer(event);
    if (pointerIdRef.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    releaseJoystick();
  };

  const active = pressed.forward || pressed.backward || pressed.left || pressed.right;
  return (
    <div className="direction-controls" aria-label="Virtual driving joystick">
      <div
        ref={baseRef}
        className={`direction-controls__joystick${active ? " direction-controls__joystick--active" : ""}`}
        role="application"
        aria-label="Drag up to accelerate, down to reverse, and left or right to steer"
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={startJoystick}
        onPointerMove={moveJoystick}
        onPointerUp={endJoystick}
        onPointerCancel={endJoystick}
        onLostPointerCapture={endJoystick}
      >
        <span className="direction-controls__joystick-mark direction-controls__joystick-mark--up">▲</span>
        <span className="direction-controls__joystick-mark direction-controls__joystick-mark--down">▼</span>
        <span className="direction-controls__joystick-knob" style={{ transform: `translate(calc(-50% + ${knob.x}%), calc(-50% + ${knob.y}%))` }} />
      </div>
    </div>
  );
}
