import { useFrame, useThree } from "@react-three/fiber";
import { MutableRefObject, useEffect, useRef } from "react";
import { MathUtils, Vector3 } from "three";
import { RapierRigidBody, useRapier } from "@react-three/rapier";
import {
  getLastMouseDelta,
  logControllerDebug,
  logTargetChange,
  markCameraUpdate,
  recordMouseDelta,
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
  distance: 5,
  minZoom: 3.4,
  maxZoom: 7.2,
  minDistance: 2.1,
  height: 1.0,
  targetHeight: 1.25,
  pitch: -0.22,
  minPitch: -0.72,
  maxPitch: 0.28,
  sensitivity: 0.0021,
  positionLerp: 0.11,
  rotationLerp: 0.12,
  orbitLerp: 0.14,
};

const cameraTarget = new Vector3();
const desiredPosition = new Vector3();
const collisionDirection = new Vector3();
const lookAt = new Vector3();
const smoothedLookAt = new Vector3();

export function ThirdPersonCamera({
  animationStateRef,
  cameraYawRef,
  controlsRef,
  movementDirectionRef,
  playerYawRef,
  targetRef,
}: ThirdPersonCameraProps) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const { rapier, world } = useRapier();
  const pitchRef = useRef(cameraSettings.pitch);
  const distanceRef = useRef(cameraSettings.distance);
  const smoothedYawRef = useRef(cameraYawRef.current);
  const smoothedPitchRef = useRef(cameraSettings.pitch);
  const smoothedDistanceRef = useRef(cameraSettings.distance);
  const hasCameraStateRef = useRef(false);

  useEffect(() => {
    const canvas = gl.domElement;

    const handleClick = () => {
      canvas.requestPointerLock?.();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (document.pointerLockElement !== canvas) return;

      recordMouseDelta(event.movementX, event.movementY);
      console.log("[StudioCLTD camera debug] PointerLockControls-style mouse camera input", {
        movementX: event.movementX,
        movementY: event.movementY,
      });
      cameraYawRef.current -= event.movementX * cameraSettings.sensitivity;
      pitchRef.current = MathUtils.clamp(
        pitchRef.current - event.movementY * cameraSettings.sensitivity,
        cameraSettings.minPitch,
        cameraSettings.maxPitch
      );
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      distanceRef.current = MathUtils.clamp(
        distanceRef.current + event.deltaY * 0.004,
        cameraSettings.minZoom,
        cameraSettings.maxZoom
      );
    };

    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    document.addEventListener("pointermove", handlePointerMove);

    return () => {
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("wheel", handleWheel);
      document.removeEventListener("pointermove", handlePointerMove);
    };
  }, [cameraYawRef, gl.domElement]);

  useFrame((_, delta) => {
    const body = targetRef.current;
    if (!body) return;

    const debugFrame = Math.floor(_.clock.elapsedTime * 60);
    markCameraUpdate(debugFrame, "ThirdPersonCamera");
    const translation = body.translation();
    cameraTarget.set(translation.x, translation.y + cameraSettings.targetHeight, translation.z);
    logTargetChange(cameraTarget);
    if (!hasCameraStateRef.current) {
      smoothedLookAt.copy(cameraTarget);
      hasCameraStateRef.current = true;
    }

    smoothedYawRef.current = MathUtils.lerp(smoothedYawRef.current, cameraYawRef.current, cameraSettings.orbitLerp);
    smoothedPitchRef.current = MathUtils.lerp(smoothedPitchRef.current, pitchRef.current, cameraSettings.orbitLerp);
    smoothedDistanceRef.current = MathUtils.lerp(
      smoothedDistanceRef.current,
      distanceRef.current,
      cameraSettings.positionLerp
    );

    const yaw = smoothedYawRef.current;
    const pitch = smoothedPitchRef.current;
    const cameraDistance = smoothedDistanceRef.current;
    const horizontalDistance = Math.cos(pitch) * cameraDistance;
    const verticalOffset = cameraSettings.height + Math.sin(pitch) * cameraDistance;

    desiredPosition.set(
      cameraTarget.x + Math.sin(yaw) * horizontalDistance,
      cameraTarget.y + verticalOffset,
      cameraTarget.z + Math.cos(yaw) * horizontalDistance
    );
    lookAt.copy(cameraTarget);
    smoothedLookAt.lerp(lookAt, cameraSettings.rotationLerp);

    collisionDirection.copy(desiredPosition).sub(cameraTarget);
    const desiredDistance = collisionDirection.length();
    collisionDirection.normalize();

    const hit = world.castRay(
      new rapier.Ray(cameraTarget, collisionDirection),
      desiredDistance,
      true
    );

    if (hit && hit.timeOfImpact > cameraSettings.minDistance) {
      desiredPosition.copy(cameraTarget).addScaledVector(collisionDirection, hit.timeOfImpact - 0.24);
    }

    const frameScale = Math.min(delta * 60, 2);
    const positionSmoothing = 1 - Math.pow(1 - cameraSettings.positionLerp, frameScale);
    const rotationSmoothing = 1 - Math.pow(1 - cameraSettings.rotationLerp, frameScale);

    camera.position.lerp(desiredPosition, positionSmoothing);
    camera.lookAt(smoothedLookAt);
    camera.rotation.z = MathUtils.lerp(camera.rotation.z, 0, rotationSmoothing);

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
        orbitLerp: cameraSettings.orbitLerp,
        positionLerp: cameraSettings.positionLerp,
        rotationLerp: cameraSettings.rotationLerp,
      },
      distance: cameraDistance,
      pitch,
      yaw,
    });
  });

  return null;
}
