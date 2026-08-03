import { CapsuleCollider, RigidBody, RapierRigidBody } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { MathUtils, Vector3 } from "three";
import { PlayerCharacter } from "./PlayerCharacter";
import { ThirdPersonCamera } from "./ThirdPersonCamera";
import { CharacterAnimationState } from "./playerTypes";
import { isSpeedBoostActive } from "./speedBoost";
import { useKeyboardControls } from "./useKeyboardControls";
import { DialogueMessage } from "../ui/DialogueBubble";
import { playerWorldState } from "../world/playerWorldState";
import type { TransportDestination } from "../world/systems/TransportPads";

const moveDirection = new Vector3();
const playerForward = new Vector3();
const baseRunSpeed = 13.2;
const boostedRunSpeed = 18.4;
const turnSpeed = 1.75;
const forwardBackSmoothing = 11;
const forwardBackStopSmoothing = 12;
const maxFrameDelta = 1 / 30;

type CharacterControllerProps = {
  dialogue: DialogueMessage | null;
  fixedAnimationRequest: number;
  movementLocked: boolean;
  onFixedAnimationComplete: () => void;
  restartKey: number;
  transportDestination: TransportDestination | null;
};

export function CharacterController({
  dialogue,
  fixedAnimationRequest,
  movementLocked,
  onFixedAnimationComplete,
  restartKey,
  transportDestination,
}: CharacterControllerProps) {
  const bodyRef = useRef<RapierRigidBody | null>(null);
  const yawRef = useRef(0);
  const cameraYawRef = useRef(0);
  const controls = useKeyboardControls();
  const controlsRef = useRef(controls);
  const movementDirectionRef = useRef(new Vector3());
  const animationStateRef = useRef<CharacterAnimationState>("idle");
  const forwardBackSpeedRef = useRef(0);
  const spawn = useMemo<[number, number, number]>(() => [0, 2.8, 8], []);

  useEffect(() => {
    const body = bodyRef.current;

    yawRef.current = 0;
    cameraYawRef.current = 0;
    forwardBackSpeedRef.current = 0;
    movementDirectionRef.current.set(0, 0, 0);
    animationStateRef.current = "idle";
    playerWorldState.position.set(spawn[0], spawn[1], spawn[2]);

    if (!body) return;

    body.setTranslation({ x: spawn[0], y: spawn[1], z: spawn[2] }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }, [restartKey, spawn]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body || !transportDestination) return;

    const [x, y, z] = transportDestination.position;
    yawRef.current = transportDestination.yaw;
    cameraYawRef.current = transportDestination.yaw;
    forwardBackSpeedRef.current = 0;
    movementDirectionRef.current.set(0, 0, 0);
    playerWorldState.position.set(x, y, z);
    body.setTranslation({ x, y, z }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }, [transportDestination]);

  useFrame((_, delta) => {
    const body = bodyRef.current;
    if (!body) return;
    const frameDelta = Math.min(delta, maxFrameDelta);
    controlsRef.current = controls;

    const velocity = body.linvel();
    const translation = body.translation();
    playerWorldState.position.set(translation.x, translation.y, translation.z);
    if (movementLocked) {
      forwardBackSpeedRef.current = 0;
      movementDirectionRef.current.set(0, 0, 0);
      body.setLinvel({ x: 0, y: velocity.y, z: 0 }, true);

      if (translation.y < -10) {
        body.setTranslation({ x: spawn[0], y: spawn[1], z: spawn[2] }, true);
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }

      animationStateRef.current = "idle";
      return;
    }

    const hasForwardBackInput = controls.forward !== controls.backward;
    const turnInput = Number(controls.left) - Number(controls.right);
    const forwardBackSpeed = isSpeedBoostActive() ? boostedRunSpeed : baseRunSpeed;

    if (turnInput !== 0) {
      yawRef.current += turnInput * turnSpeed * frameDelta;
    }

    playerForward.set(-Math.sin(yawRef.current), 0, -Math.cos(yawRef.current));

    const forwardBackInput = Number(controls.forward) - Number(controls.backward);
    const targetForwardBackSpeed = forwardBackInput * forwardBackSpeed;
    const speedSmoothing = hasForwardBackInput ? forwardBackSmoothing : forwardBackStopSmoothing;
    forwardBackSpeedRef.current = MathUtils.damp(
      forwardBackSpeedRef.current,
      targetForwardBackSpeed,
      speedSmoothing,
      frameDelta
    );

    if (!hasForwardBackInput && Math.abs(forwardBackSpeedRef.current) < 0.04) {
      forwardBackSpeedRef.current = 0;
    }

    moveDirection.set(0, 0, 0);
    moveDirection.addScaledVector(playerForward, forwardBackSpeedRef.current);

    const isMoving = Math.abs(forwardBackSpeedRef.current) > 0.08;
    const targetVelocity = {
      x: isMoving ? moveDirection.x : 0,
      z: isMoving ? moveDirection.z : 0,
    };

    if (isMoving) {
      moveDirection.normalize();
    }
    movementDirectionRef.current.copy(moveDirection);

    const accelerationRate = isMoving ? 8.5 : 10;
    const acceleration = 1 - Math.exp(-frameDelta * accelerationRate);

    const nextVelocity = {
      x: MathUtils.lerp(velocity.x, targetVelocity.x, acceleration),
      y: velocity.y,
      z: MathUtils.lerp(velocity.z, targetVelocity.z, acceleration),
    };

    body.setLinvel(nextVelocity, true);

    if (translation.y < -10) {
      forwardBackSpeedRef.current = 0;
      body.setTranslation({ x: spawn[0], y: spawn[1], z: spawn[2] }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }

    const nextState: CharacterAnimationState = isMoving ? "run" : "idle";

    animationStateRef.current = nextState;
  });

  return (
    <>
      <ThirdPersonCamera
        cameraYawRef={cameraYawRef}
        controlsRef={controlsRef}
        movementDirectionRef={movementDirectionRef}
        playerYawRef={yawRef}
        targetRef={bodyRef}
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
        <CapsuleCollider args={[0.65, 0.38]} friction={0} restitution={0} />
        <PlayerCharacter
          animationStateRef={animationStateRef}
          dialogue={dialogue}
          fixedAnimationRequest={fixedAnimationRequest}
          onFixedAnimationComplete={onFixedAnimationComplete}
          yawRef={yawRef}
        />
      </RigidBody>
    </>
  );
}
