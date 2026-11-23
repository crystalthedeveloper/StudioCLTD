import { hasPowerSpeedBoost } from "./temporaryPowers";
import { useGameFrame } from "./useGameFrame";
import { CuboidCollider, RigidBody, RapierRigidBody, type RapierCollider } from "@react-three/rapier";
import { useEffect, useMemo, useRef } from "react";
import { MathUtils, Vector3 } from "three";
import { playerCenterHeightReduction } from "./playerDimensions";
import { PlayerCharacter } from "./PlayerCharacter";
import { ThirdPersonCamera } from "./ThirdPersonCamera";
import { getTouchSteering, getTouchThrottle, useKeyboardControls, cancelCruise } from "./useKeyboardControls";
import { DialogueMessage } from "../ui/DialogueBubble";
import { playerWorldState } from "../world/playerWorldState";
import type { TransportDestination } from "../world/systems/TransportPads";
import { installFootstepAudioUnlock } from "./footsteps";
import { isCompactVisualBudget } from "../world/visualQuality";

const moveDirection = new Vector3();
const playerForward = new Vector3();
const targetVelocity = { x: 0, z: 0 };
const nextVelocity = { x: 0, y: 0, z: 0 };
const baseRunSpeed = 23;
const boostedRunSpeed = 39.6;
const reverseSpeed = 18;
const mobileRunSpeed = 18;
const mobileBoostedRunSpeed = 30;
const mobileReverseSpeed = 15;
const turnSpeed = 2.2;
const mobileTurnSpeed = 1.35;
const acceleration = 9;
const braking = 15;
const maxFrameDelta = 1 / 30;

type CharacterControllerProps = {
  damageFlashUntil: number;
  dialogue: DialogueMessage | null;
  onReset: () => void;
  returning: boolean;
  respawnCameraSnap: boolean;
  carHidden: boolean;
  startCamera: boolean;
  restartKey: number;
  transportDestination: TransportDestination | null;
  checkpoint: [number, number, number];
};

export function CharacterController({
  damageFlashUntil,
  dialogue,
  onReset,
  returning,
  respawnCameraSnap,
  carHidden,
  startCamera,
  restartKey,
  transportDestination,
  checkpoint,
}: CharacterControllerProps) {
  const bodyRef = useRef<RapierRigidBody | null>(null);
  const colliderRef = useRef<RapierCollider | null>(null);
  const yawRef = useRef(0);
  const cameraYawRef = useRef(0);
  const controls = useKeyboardControls();
  const compactControls = useMemo(isCompactVisualBudget, []);
  const controlsRef = useRef(controls);
  const movementDirectionRef = useRef(new Vector3());
  const forwardBackSpeedRef = useRef(0);
  const mobileSteeringRef = useRef(0);
  const spawn = useMemo<[number, number, number]>(() => [0, 1.34, 18], []);
  const checkpointRef = useRef<[number, number, number]>(spawn);
  const teleportTimerRef = useRef<number | null>(null);
  const fallResetPendingRef = useRef(false);
  const returnProgressRef = useRef(0);
  const returnStartRef = useRef(new Vector3());

  useEffect(() => { checkpointRef.current = checkpoint; }, [checkpoint]);
  useEffect(() => installFootstepAudioUnlock(), []);

  useEffect(() => {
    colliderRef.current?.setEnabled(!returning);
    if (returning) {
      const translation = bodyRef.current?.translation();
      if (translation) returnStartRef.current.set(translation.x, translation.y, translation.z);
      returnProgressRef.current = 0;
      bodyRef.current?.setLinvel({ x: 0, y: 0, z: 0 }, true);
      bodyRef.current?.setAngvel({ x: 0, y: 0, z: 0 }, true);
      bodyRef.current?.sleep();
    } else {
      bodyRef.current?.wakeUp();
    }
  }, [returning]);

  useEffect(() => {
    const body = bodyRef.current;

    fallResetPendingRef.current = false;
    yawRef.current = 0;
    cameraYawRef.current = 0;
    forwardBackSpeedRef.current = 0;
    movementDirectionRef.current.set(0, 0, 0);
    playerWorldState.position.set(spawn[0], spawn[1], spawn[2]);

    if (!body) return;

    body.setTranslation({ x: spawn[0], y: spawn[1], z: spawn[2] }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }, [restartKey, spawn]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body || !transportDestination) return;

    const [x, destinationY, z] = transportDestination.position;
    const y = destinationY - playerCenterHeightReduction;
    checkpointRef.current = [x, y, z];
    yawRef.current = transportDestination.yaw;
    cameraYawRef.current = transportDestination.yaw;
    forwardBackSpeedRef.current = 0;
    movementDirectionRef.current.set(0, 0, 0);
    playerWorldState.position.set(x, y, z);
    body.setTranslation({ x, y, z }, true);
    body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    body.wakeUp();
    colliderRef.current?.setEnabled(false);
    if (teleportTimerRef.current !== null) window.clearTimeout(teleportTimerRef.current);
    teleportTimerRef.current = window.setTimeout(() => { colliderRef.current?.setEnabled(true); body.wakeUp(); teleportTimerRef.current = null; }, 120);
    return () => { if (teleportTimerRef.current !== null) window.clearTimeout(teleportTimerRef.current); };
  }, [transportDestination]);

  useGameFrame(({ clock }, delta) => {
    const body = bodyRef.current;
    if (!body) return;
    if (returning) {
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      body.sleep();
      playerWorldState.position.set(body.translation().x, body.translation().y, body.translation().z);
      return;
    }
    const frameDelta = Math.min(delta, maxFrameDelta);
    controlsRef.current = controls;

    const velocity = body.linvel();
    const translation = body.translation();
    playerWorldState.position.set(translation.x, translation.y, translation.z);
    if (controls.backward) cancelCruise();
    const touchThrottle = getTouchThrottle();
    const throttle = Math.abs(touchThrottle) > 0.001
      ? touchThrottle
      : Number(controls.forward || (controls as typeof controls & { cruise?: boolean }).cruise) - Number(controls.backward);
    const touchSteering = getTouchSteering();
    const steeringTarget = compactControls && Math.abs(touchSteering) > 0.001
      ? touchSteering
      : Number(controls.left) - Number(controls.right);
    mobileSteeringRef.current = compactControls
      ? MathUtils.damp(mobileSteeringRef.current, steeringTarget, 10, frameDelta)
      : steeringTarget;
    const turnInput = mobileSteeringRef.current;
    const forwardBackSpeed = hasPowerSpeedBoost()
      ? (compactControls ? mobileBoostedRunSpeed : boostedRunSpeed)
      : (compactControls ? mobileRunSpeed : baseRunSpeed);
    const speed = forwardBackSpeedRef.current;
    const steeringGrip = Math.min(1, Math.abs(speed) / 3.2);
    const highSpeedStability = 1 - 0.28 * Math.min(1, Math.abs(speed) / forwardBackSpeed);
    if (turnInput !== 0 && steeringGrip > 0.02) {
      yawRef.current += turnInput * (compactControls ? mobileTurnSpeed : turnSpeed) * steeringGrip * highSpeedStability * (speed < 0 ? -1 : 1) * frameDelta;
    }

    playerForward.set(-Math.sin(yawRef.current), 0, -Math.cos(yawRef.current));

    // Direction changes target the requested signed speed immediately. The
    // damped rate carries the car smoothly through zero without a double press.
    const targetSpeed = throttle > 0
      ? forwardBackSpeed
      : throttle < 0
        ? -Math.max(compactControls ? mobileReverseSpeed : reverseSpeed, forwardBackSpeed)
        : 0;
    const reversingAgainstMotion = throttle < 0 && speed > 0;
    const acceleratingAgainstMotion = throttle > 0 && speed < 0;
    const rate = throttle === 0 ? braking : (reversingAgainstMotion || acceleratingAgainstMotion ? braking : acceleration);
    forwardBackSpeedRef.current = MathUtils.damp(speed, targetSpeed, rate, frameDelta);
    if (Math.abs(forwardBackSpeedRef.current) < 0.04 && throttle === 0) forwardBackSpeedRef.current = 0;

    moveDirection.set(0, 0, 0);
    moveDirection.addScaledVector(playerForward, forwardBackSpeedRef.current);

    const isMoving = Math.abs(forwardBackSpeedRef.current) > 0.08;
    const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
    targetVelocity.x = isMoving ? moveDirection.x : 0;
    targetVelocity.z = isMoving ? moveDirection.z : 0;

    if (isMoving) {
      moveDirection.normalize();
    }
    movementDirectionRef.current.copy(moveDirection);

    const velocityBlend = 1 - Math.exp(-frameDelta * (isMoving ? 12 : 16));
    nextVelocity.x = MathUtils.lerp(velocity.x, targetVelocity.x, velocityBlend);
    nextVelocity.y = velocity.y;
    nextVelocity.z = MathUtils.lerp(velocity.z, targetVelocity.z, velocityBlend);

    body.setLinvel(nextVelocity, true);

    if (translation.y < -10) {
      if (fallResetPendingRef.current) return;
      fallResetPendingRef.current = true;
      forwardBackSpeedRef.current = 0;
      const [x, y, z] = checkpointRef.current;
      body.setTranslation({ x, y, z }, true);
      body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      body.wakeUp();
      onReset();
    }

  });

  return (
    <>
      <ThirdPersonCamera
        cameraYawRef={cameraYawRef}
        controlsRef={controlsRef}
        movementDirectionRef={movementDirectionRef}
        playerYawRef={yawRef}
        targetRef={bodyRef}
        returning={returning}
        respawnCameraSnap={respawnCameraSnap}
        startCamera={startCamera}
      />
      <RigidBody
        ref={bodyRef}
        name="StudioCLTDPlayer"
        colliders={false}
        position={spawn}
        enabledRotations={[false, false, false]}
        linearDamping={0}
        angularDamping={1}
        canSleep={false}
      >
        <CuboidCollider ref={colliderRef} args={[0.68, 0.42, 1.3]} friction={0} restitution={0} />
        <group visible={!carHidden}>
          <PlayerCharacter
            damageFlashUntil={damageFlashUntil}
            dialogue={dialogue}
            yawRef={yawRef}
          />
        </group>
      </RigidBody>
    </>
  );
}
