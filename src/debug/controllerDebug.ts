import { Euler, Vector3 } from "three";
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
  cameraRotation: Euler;
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

const targetChangeThreshold = 0.035;
const logIntervalMs = 250;

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

  if (debugState.cameraWriter && debugState.cameraWriter.source !== source) {
    console.warn("[StudioCLTD camera debug] Multiple camera writers in frame", {
      current: source,
      frame,
      previous: debugState.cameraWriter.source,
    });
  }

  debugState.cameraWriter = { frame, source };
}

export function markPlayerRotationUpdate(frame: number, source: string) {
  if (debugState.frame !== frame) {
    debugState.frame = frame;
    debugState.cameraWriter = null;
    debugState.playerRotationWriter = null;
  }

  if (debugState.playerRotationWriter && debugState.playerRotationWriter.source !== source) {
    console.warn("[StudioCLTD camera debug] Multiple player rotation writers in frame", {
      current: source,
      frame,
      previous: debugState.playerRotationWriter.source,
    });
  }

  debugState.playerRotationWriter = { frame, source };
}

export function logTargetChange(cameraTarget: Vector3) {
  if (!isControllerDebugEnabled()) return;
  if (debugState.lastCameraTarget.distanceTo(cameraTarget) <= targetChangeThreshold) return;

  console.log("[StudioCLTD camera debug] Camera target changed", {
    from: vectorToLog(debugState.lastCameraTarget),
    to: vectorToLog(cameraTarget),
  });
  debugState.lastCameraTarget.copy(cameraTarget);
}

export function logControllerDebug(nowMs: number, player: MovementDebug, camera: CameraDebug) {
  if (!isControllerDebugEnabled()) return;
  if (nowMs - debugState.lastLogTime < logIntervalMs) return;
  debugState.lastLogTime = nowMs;

  console.log("[StudioCLTD camera debug] frame snapshot", {
    camera: {
      damping: camera.damping,
      distance: round(camera.distance),
      pitch: round(camera.pitch),
      position: vectorToLog(camera.cameraPosition),
      rotation: eulerToLog(camera.cameraRotation),
      target: vectorToLog(camera.cameraTarget),
      yaw: round(camera.yaw),
    },
    input: {
      keyboard: {
        A: player.keyboard.left,
        D: player.keyboard.right,
        S: player.keyboard.backward,
        W: player.keyboard.forward,
      },
      mouseDelta: {
        x: round(player.mouseDelta.x),
        y: round(player.mouseDelta.y),
      },
    },
    player: {
      animationState: player.animationState,
      movementDirection: vectorToLog(player.movementDirection),
      position: vectorToLog(player.playerPosition),
      rotationY: round(player.playerYaw),
    },
    writers: {
      camera: debugState.cameraWriter?.source ?? "none",
      playerRotation: debugState.playerRotationWriter?.source ?? "none",
    },
  });
}

function vectorToLog(vector: Vector3) {
  return {
    x: round(vector.x),
    y: round(vector.y),
    z: round(vector.z),
  };
}

function eulerToLog(euler: Euler) {
  return {
    x: round(euler.x),
    y: round(euler.y),
    z: round(euler.z),
  };
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
