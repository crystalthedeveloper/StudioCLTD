import { PointerEvent, useEffect, useRef, useState } from "react";
import { setTouchCameraInputBlocked } from "../player/cameraInputGuard";
import { isGameFocused, subscribeGameFocus } from "../player/gameFocus";
import { MovementControls, setTouchControls, setTouchSteering, setTouchThrottle, useKeyboardControls } from "../player/useKeyboardControls";

const deadZone = 0.18;
const releasedControls: MovementControls = { cruise: false, forward: false, backward: false, left: false, right: false };

function controlsFromStick(x: number, y: number): MovementControls {
  return { cruise: false, forward: y < -deadZone, backward: y > deadZone, left: x > deadZone, right: x < -deadZone };
}

function steeringFromStick(x: number) {
  const magnitude = Math.max(0, (Math.abs(x) - deadZone) / (1 - deadZone));
  return -Math.sign(x) * magnitude * magnitude * magnitude * 0.7;
}

export function DirectionControls() {
  const baseRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [mobile, setMobile] = useState(false);
  const arrowPressedRef = useRef(new Set<keyof MovementControls>());
  const pressed = useKeyboardControls();

  useEffect(() => {
    const query = window.matchMedia("(max-width: 768px), (pointer: coarse)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const updateArrowControls = () => {
    const next = { ...releasedControls };
    arrowPressedRef.current.forEach((key) => { next[key] = true; });
    setTouchControls(next);
    setTouchSteering(0);
    setTouchThrottle(0);
  };

  const pressArrow = (key: keyof MovementControls, event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    arrowPressedRef.current.add(key);
    updateArrowControls();
  };

  const releaseArrow = (key: keyof MovementControls, event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    arrowPressedRef.current.delete(key);
    updateArrowControls();
  };

  const releaseJoystick = () => {
    pointerIdRef.current = null;
    arrowPressedRef.current.clear();
    setKnob({ x: 0, y: 0 });
    setTouchControls(releasedControls);
    setTouchSteering(0);
    setTouchThrottle(0);
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
    setTouchSteering(steeringFromStick(normalizedX));
    setTouchThrottle(normalizedY < -deadZone ? -normalizedY : normalizedY > deadZone ? -normalizedY : 0);
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
  if (mobile) return (
    <div className="direction-controls direction-controls--arrows" aria-label="Mobile driving controls">
      <button className="direction-controls__button direction-controls__button--forward" aria-label="Accelerate" onPointerDown={(event) => pressArrow("forward", event)} onPointerUp={(event) => releaseArrow("forward", event)} onPointerCancel={(event) => releaseArrow("forward", event)} onPointerLeave={(event) => releaseArrow("forward", event)}>▲</button>
      <button className="direction-controls__button direction-controls__button--left" aria-label="Steer left" onPointerDown={(event) => pressArrow("left", event)} onPointerUp={(event) => releaseArrow("left", event)} onPointerCancel={(event) => releaseArrow("left", event)} onPointerLeave={(event) => releaseArrow("left", event)}>◀</button>
      <button className="direction-controls__button direction-controls__button--right" aria-label="Steer right" onPointerDown={(event) => pressArrow("right", event)} onPointerUp={(event) => releaseArrow("right", event)} onPointerCancel={(event) => releaseArrow("right", event)} onPointerLeave={(event) => releaseArrow("right", event)}>▶</button>
      <button className="direction-controls__button direction-controls__button--backward" aria-label="Reverse" onPointerDown={(event) => pressArrow("backward", event)} onPointerUp={(event) => releaseArrow("backward", event)} onPointerCancel={(event) => releaseArrow("backward", event)} onPointerLeave={(event) => releaseArrow("backward", event)}>▼</button>
    </div>
  );
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
