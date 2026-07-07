import { useFrame, useThree } from "@react-three/fiber";
import { MutableRefObject, useRef } from "react";
import { MathUtils, Vector3 } from "three";
import { RapierRigidBody } from "@react-three/rapier";
import {
  getLastMouseDelta,
  isControllerDebugEnabled,
  logControllerDebug,
  logTargetChange,
  markCameraUpdate,
} from "../debug/controllerDebug";
import { KeyboardControls } from "./useKeyboardControls";

type ThirdPersonCameraProps = {
  animationStateRef: MutableRefObject<string>;
  controlsRef: MutableRefObject<KeyboardControls>;
  movementDirectionRef: MutableRefObject<Vector3>;
  playerYawRef: MutableRefObject<number>;
  targetRef: MutableRefObject<RapierRigidBody | null>;
  cameraYawRef: MutableRefObject<number>;
};

const cameraSettings = {
  distance: 7.4,
  height: 3,
  targetHeight: 1.45,
  pitch: -0.24,
  minPitch: MathUtils.degToRad(-35),
  maxPitch: MathUtils.degToRad(55),
  lookAtDamping: 12,
  pitchDamping: 12,
  targetDamping: 20,
  yawDamping: 10,
  yawFollowDamping: 5.8,
};

const cameraTarget = new Vector3();
const smoothedCameraTarget = new Vector3();
const desiredPosition = new Vector3();
const lookDirection = new Vector3();
const lookAt = new Vector3();
const smoothedLookAt = new Vector3();
const worldUp = new Vector3(0, 1, 0);
const rollTolerance = 0.0005;
const pitchTolerance = 0.0005;
const distanceDriftTolerance = 0.55;
const maxFrameDelta = 1 / 30;

function dampAngle(current: number, target: number, lambda: number, delta: number) {
  const angleDelta = MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
  return current + angleDelta * (1 - Math.exp(-lambda * delta));
}

export function ThirdPersonCamera({
  animationStateRef,
  cameraYawRef,
  controlsRef,
  movementDirectionRef,
  playerYawRef,
  targetRef,
}: ThirdPersonCameraProps) {
  const camera = useThree((state) => state.camera);
  const pitchRef = useRef(cameraSettings.pitch);
  const smoothedYawRef = useRef(cameraYawRef.current);
  const smoothedPitchRef = useRef(cameraSettings.pitch);
  const hasCameraStateRef = useRef(false);
  const lastRollWarningRef = useRef(0);
  const lastDistanceLogRef = useRef(0);
  const lastFpsLogRef = useRef(0);

  useFrame((_, delta) => {
    const body = targetRef.current;
    if (!body) return;
    const debugEnabled = isControllerDebugEnabled();
    const frameDelta = Math.min(delta, maxFrameDelta);

    const debugFrame = Math.floor(_.clock.elapsedTime * 60);
    markCameraUpdate(debugFrame, "ThirdPersonCamera");
    const translation = body.translation();
    cameraTarget.set(translation.x, translation.y + cameraSettings.targetHeight, translation.z);
    logTargetChange(cameraTarget);
    if (!hasCameraStateRef.current) {
      smoothedLookAt.copy(cameraTarget);
      smoothedCameraTarget.copy(cameraTarget);
      smoothedYawRef.current = cameraYawRef.current;
      hasCameraStateRef.current = true;
    }

    const velocity = body.linvel();
    const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
    const movingFast = horizontalSpeed > 10;
    const movingForwardOrTurning = movementDirectionRef.current.lengthSq() > 0.001 || controlsRef.current.left || controlsRef.current.right;
    if (movingForwardOrTurning) {
      cameraYawRef.current = dampAngle(
        cameraYawRef.current,
        playerYawRef.current,
        movingFast ? cameraSettings.yawFollowDamping * 1.25 : cameraSettings.yawFollowDamping,
        frameDelta
      );
    }

    smoothedYawRef.current = dampAngle(smoothedYawRef.current, cameraYawRef.current, cameraSettings.yawDamping, frameDelta);
    smoothedPitchRef.current = MathUtils.damp(smoothedPitchRef.current, pitchRef.current, cameraSettings.pitchDamping, frameDelta);
    smoothedCameraTarget.lerp(cameraTarget, 1 - Math.exp(-frameDelta * cameraSettings.targetDamping));

    const yaw = smoothedYawRef.current;
    const pitch = smoothedPitchRef.current;
    if (
      (pitch < cameraSettings.minPitch - pitchTolerance || pitch > cameraSettings.maxPitch + pitchTolerance) &&
      debugEnabled &&
      performance.now() - lastRollWarningRef.current > 250
    ) {
      lastRollWarningRef.current = performance.now();
      console.warn("[StudioCLTD camera debug] Camera pitch outside clamp", {
        maxPitch: cameraSettings.maxPitch,
        minPitch: cameraSettings.minPitch,
        pitch,
      });
    }
    const cameraDistance = cameraSettings.distance;
    const horizontalDistance = Math.cos(pitch) * cameraDistance;
    const verticalOffset = cameraSettings.height + Math.sin(pitch) * cameraDistance;

    desiredPosition.set(
      smoothedCameraTarget.x + Math.sin(yaw) * horizontalDistance,
      smoothedCameraTarget.y + verticalOffset,
      smoothedCameraTarget.z + Math.cos(yaw) * horizontalDistance
    );
    lookAt.copy(cameraTarget);
    smoothedLookAt.lerp(lookAt, 1 - Math.exp(-frameDelta * cameraSettings.lookAtDamping));

    camera.position.copy(desiredPosition);
    camera.up.copy(worldUp);
    lookDirection.copy(smoothedLookAt).sub(camera.position).normalize();
    const cameraYaw = Math.atan2(-lookDirection.x, -lookDirection.z);
    const cameraPitch = Math.asin(MathUtils.clamp(lookDirection.y, -1, 1));

    camera.rotation.order = "YXZ";
    camera.rotation.set(cameraPitch, cameraYaw, 0);

    if (debugEnabled && Math.abs(camera.rotation.z) > rollTolerance && performance.now() - lastRollWarningRef.current > 250) {
      lastRollWarningRef.current = performance.now();
      console.warn("[StudioCLTD camera debug] Camera roll detected after yaw/pitch solve", {
        pitch: cameraPitch,
        roll: camera.rotation.z,
        yaw: cameraYaw,
      });
    }
    camera.rotation.z = 0;
    camera.updateMatrixWorld();

    if (performance.now() - lastDistanceLogRef.current > 1000) {
      lastDistanceLogRef.current = performance.now();
      const distanceToPlayer = camera.position.distanceTo(smoothedCameraTarget);
      const expectedDistance = desiredPosition.distanceTo(smoothedCameraTarget);
      console.log("[StudioCLTD camera debug] Camera distance to player", {
        configuredDistance: cameraSettings.distance,
        distanceToPlayer,
        expectedDistance,
      });

      if (debugEnabled && Math.abs(distanceToPlayer - expectedDistance) > distanceDriftTolerance) {
        console.warn("[StudioCLTD camera debug] Camera distance drift detected", {
          configuredDistance: cameraSettings.distance,
          distanceToPlayer,
          expectedDistance,
        });
      }
    }

    if (performance.now() - lastFpsLogRef.current > 1000) {
      lastFpsLogRef.current = performance.now();
      console.log("[StudioCLTD camera debug] FPS", {
        fps: Math.round(1 / Math.max(delta, 0.0001)),
      });
    }

    logControllerDebug(performance.now(), {
      animationState: animationStateRef.current,
      keyboard: controlsRef.current,
      movementDirection: movementDirectionRef.current,
      mouseDelta: getLastMouseDelta(),
      playerPosition: new Vector3(translation.x, translation.y, translation.z),
      playerYaw: playerYawRef.current,
    }, {
      cameraPosition: camera.position,
      cameraRotation: camera.rotation,
      cameraTarget,
      damping: {
        lookAtDamping: cameraSettings.lookAtDamping,
        targetDamping: cameraSettings.targetDamping,
        yawDamping: cameraSettings.yawDamping,
      },
      distance: cameraDistance,
      pitch: cameraPitch,
      yaw: cameraYaw,
    });
  });

  return null;
}
