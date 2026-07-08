import { useFrame, useThree } from "@react-three/fiber";
import { MutableRefObject, useRef } from "react";
import { MathUtils, Vector3 } from "three";
import { RapierRigidBody } from "@react-three/rapier";
import { KeyboardControls } from "./useKeyboardControls";

type ThirdPersonCameraProps = {
  controlsRef: MutableRefObject<KeyboardControls>;
  movementDirectionRef: MutableRefObject<Vector3>;
  playerYawRef: MutableRefObject<number>;
  targetRef: MutableRefObject<RapierRigidBody | null>;
  cameraYawRef: MutableRefObject<number>;
};

const cameraSettings = {
  distance: 7.6,
  height: 2,
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
}: ThirdPersonCameraProps) {
  const camera = useThree((state) => state.camera);
  const pitchRef = useRef(cameraSettings.pitch);
  const smoothedYawRef = useRef(cameraYawRef.current);
  const smoothedPitchRef = useRef(cameraSettings.pitch);
  const hasCameraStateRef = useRef(false);

  useFrame((_, delta) => {
    const body = targetRef.current;
    if (!body) return;
    const frameDelta = Math.min(delta, maxFrameDelta);

    const translation = body.translation();
    cameraTarget.set(translation.x, translation.y + cameraSettings.targetHeight, translation.z);
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

    camera.rotation.z = 0;
    camera.updateMatrixWorld();
  });

  return null;
}
