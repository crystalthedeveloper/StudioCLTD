import { Vector3 } from "three";
import { KeyboardControls } from "../player/useKeyboardControls";

type FrameWrite = {
  frame: number;
  source: string;
};

type MovementDebug = {
  animationState: string;
  keyboard: KeyboardControls;
  movementDirection: Vector3;
  mouseDelta: { x: number; y: number };
  playerPosition: Vector3;
  playerYaw: number;
};

type CameraDebug = {
  cameraPosition: Vector3;
  cameraRotation: { x: number; y: number; z: number };
  cameraTarget: Vector3;
  distance: number;
  damping: {
    lookAtDamping: number;
    targetDamping: number;
    yawDamping: number;
  };
  pitch: number;
  yaw: number;
};

const debugState = {
  cameraWriter: null as FrameWrite | null,
  frame: -1,
  lastCameraTarget: new Vector3(),
  lastLogTime: 0,
  lastMouseDelta: { x: 0, y: 0 },
  playerRotationWriter: null as FrameWrite | null,
};

export function isControllerDebugEnabled() {
  return globalThis.localStorage?.getItem("studiocltd-debug") === "true";
}

export function recordMouseDelta(x: number, y: number) {
  debugState.lastMouseDelta = { x, y };
}

export function getLastMouseDelta() {
  return debugState.lastMouseDelta;
}

export function markCameraUpdate(frame: number, source: string) {
  if (debugState.frame !== frame) {
    debugState.frame = frame;
    debugState.cameraWriter = null;
    debugState.playerRotationWriter = null;
  }

  debugState.cameraWriter = { frame, source };
}

export function markPlayerRotationUpdate(frame: number, source: string) {
  if (debugState.frame !== frame) {
    debugState.frame = frame;
    debugState.cameraWriter = null;
    debugState.playerRotationWriter = null;
  }

  debugState.playerRotationWriter = { frame, source };
}

export function logTargetChange(cameraTarget: Vector3) {
  debugState.lastCameraTarget.copy(cameraTarget);
}

export function logControllerDebug(nowMs: number, player: MovementDebug, camera: CameraDebug) {
  debugState.lastLogTime = nowMs;
  void player;
  void camera;
}
