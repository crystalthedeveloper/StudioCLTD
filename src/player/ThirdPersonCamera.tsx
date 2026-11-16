import { useThree, useFrame } from "@react-three/fiber";
import { MutableRefObject, useRef } from "react";
import { MathUtils, Vector3 } from "three";
import { RapierRigidBody } from "@react-three/rapier";
import { KeyboardControls } from "./useKeyboardControls";
import { getDamageShake } from "./damageFeedback";

type ThirdPersonCameraProps = {
  controlsRef: MutableRefObject<KeyboardControls>;
  movementDirectionRef: MutableRefObject<Vector3>;
  playerYawRef: MutableRefObject<number>;
  targetRef: MutableRefObject<RapierRigidBody | null>;
  cameraYawRef: MutableRefObject<number>;
  returning: boolean;
  respawnCameraSnap: boolean;
  startCamera: boolean;
};

const cameraSettings = {
  distance: 5.4,
  height: 0.68,
  targetHeight: 0.86,
  pitch: -0.04,
  shoulderOffset: 0,
  framingLookOffset: 0.06,
  minPitch: MathUtils.degToRad(-35),
  maxPitch: MathUtils.degToRad(55),
  lookAtDamping: 9,
  pitchDamping: 9,
  targetDamping: 10,
  yawDamping: 7,
  yawFollowDamping: 4.8,
};

const cameraTarget = new Vector3();
const smoothedCameraTarget = new Vector3();
const desiredPosition = new Vector3();
const lookDirection = new Vector3();
const lookAt = new Vector3();
const smoothedLookAt = new Vector3();
const worldUp = new Vector3(0, 1, 0);
const maxFrameDelta = 1 / 30;

function dampAngle(current: number, target: number, lambda: number, delta: number) {
  const angleDelta = MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
  return current + angleDelta * (1 - Math.exp(-lambda * delta));
}

export function ThirdPersonCamera({
  cameraYawRef,
  controlsRef,
  movementDirectionRef,
  playerYawRef,
  targetRef,
  returning,
  respawnCameraSnap,
  startCamera,
}: ThirdPersonCameraProps) {
  const camera = useThree((state) => state.camera);
  const pitchRef = useRef(cameraSettings.pitch);
  const smoothedYawRef = useRef(cameraYawRef.current);
  const smoothedPitchRef = useRef(cameraSettings.pitch);
  const hasCameraStateRef = useRef(false);
  const startBlendRef = useRef(0);
  const wasStartCameraRef = useRef(startCamera);

  // Keep the exact chase-camera pose rendered while paused/startup as well as
  // during gameplay, preventing a camera jump when Play is clicked.
  useFrame((_, delta) => {
    const body = targetRef.current;
    if (!body) return;
    const frameDelta = Math.min(delta, maxFrameDelta);

    const translation = body.translation();
    if (returning && !respawnCameraSnap) return;
    cameraTarget.set(translation.x, translation.y + cameraSettings.targetHeight, translation.z);
    if (startCamera && !returning) {
      const yaw = playerYawRef.current;
      const startPitch = MathUtils.degToRad(-8);
      const startDistance = 8;
      const horizontal = Math.cos(startPitch) * startDistance;
      desiredPosition.set(
        cameraTarget.x + Math.sin(yaw) * horizontal - Math.cos(yaw) * 0.85,
        translation.y + 3.35,
        cameraTarget.z + Math.cos(yaw) * horizontal + Math.sin(yaw) * 0.85,
      );
      camera.position.copy(desiredPosition);
      smoothedCameraTarget.copy(cameraTarget);
      smoothedLookAt.copy(cameraTarget);
      smoothedYawRef.current = yaw;
      hasCameraStateRef.current = true;
      lookAt.copy(cameraTarget);
      lookAt.z -= 3.5;
      lookAt.y -= 0.25;
      camera.lookAt(lookAt);
      camera.updateMatrixWorld();
      return;
    }
    if (wasStartCameraRef.current && !startCamera) startBlendRef.current = 0;
    wasStartCameraRef.current = startCamera;
    if (returning && respawnCameraSnap) {
      // The car has already been teleported while black. Reset every camera
      // smoothing value to the normal follow pose; no travel through the world.
      const yaw = playerYawRef.current;
      const horizontalDistance = Math.cos(cameraSettings.pitch) * cameraSettings.distance;
      const verticalOffset = cameraSettings.height + Math.sin(cameraSettings.pitch) * cameraSettings.distance;
      desiredPosition.set(
        cameraTarget.x + Math.sin(yaw) * horizontalDistance,
        cameraTarget.y + verticalOffset,
        cameraTarget.z + Math.cos(yaw) * horizontalDistance,
      );
      smoothedCameraTarget.copy(cameraTarget);
      smoothedLookAt.copy(cameraTarget);
      smoothedYawRef.current = yaw;
      smoothedPitchRef.current = cameraSettings.pitch;
      hasCameraStateRef.current = true;
      camera.position.copy(desiredPosition);
      lookAt.copy(cameraTarget);
      lookAt.y += cameraSettings.framingLookOffset;
      camera.lookAt(lookAt);
      camera.up.copy(worldUp);
      camera.updateMatrixWorld();
      return;
    }
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
    const cameraDistance = returning ? 8.4 : cameraSettings.distance;
    const horizontalDistance = Math.cos(pitch) * cameraDistance;
    const verticalOffset = cameraSettings.height + Math.sin(pitch) * cameraDistance;

    desiredPosition.set(
      smoothedCameraTarget.x + Math.sin(yaw) * horizontalDistance + Math.cos(yaw) * cameraSettings.shoulderOffset,
      smoothedCameraTarget.y + verticalOffset + (returning ? 2.2 : 0),
      smoothedCameraTarget.z + Math.cos(yaw) * horizontalDistance - Math.sin(yaw) * cameraSettings.shoulderOffset
    );
    const shake = getDamageShake();
    if (shake.amount > 0) {
      const t = performance.now() * 0.045;
      desiredPosition.x += Math.sin(t + shake.seed * 2.3) * 0.035 * shake.amount;
      desiredPosition.y += Math.cos(t * 1.2 + shake.seed) * 0.025 * shake.amount;
      desiredPosition.z += Math.sin(t * 0.8 + shake.seed * 1.7) * 0.03 * shake.amount;
    }
    lookAt.copy(cameraTarget);
    lookAt.y += cameraSettings.framingLookOffset;
    smoothedLookAt.lerp(lookAt, 1 - Math.exp(-frameDelta * cameraSettings.lookAtDamping));

    // This also provides the soft blend back from the return camera to the
    // normal driving camera when the sequence releases control.
    const blendFactor = startBlendRef.current < 1
      ? Math.min(1, startBlendRef.current += frameDelta / 0.7)
      : 1;
    const cameraDamping = blendFactor < 1 ? blendFactor : 1 - Math.exp(-frameDelta * 12);
    camera.position.lerp(desiredPosition, cameraDamping);
    camera.up.copy(worldUp);
    lookDirection.copy(smoothedLookAt).sub(camera.position).normalize();
    const cameraYaw = Math.atan2(-lookDirection.x, -lookDirection.z);
    const cameraPitch = Math.asin(MathUtils.clamp(lookDirection.y, -1, 1));

    camera.rotation.order = "YXZ";
    camera.rotation.set(cameraPitch, cameraYaw, 0);

    camera.rotation.z = 0;
    camera.updateMatrixWorld();
  });

  return null;
}
