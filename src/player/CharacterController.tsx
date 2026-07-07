import { CapsuleCollider, RigidBody, RapierRigidBody } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { MathUtils, Vector3 } from "three";
import { PlayerCharacter } from "./PlayerCharacter";
import { ThirdPersonCamera } from "./ThirdPersonCamera";
import { CharacterAnimationState } from "./playerTypes";
import { isSpeedBoostActive } from "./speedBoost";
import { useKeyboardControls } from "./useKeyboardControls";
import { isControllerDebugEnabled, markPlayerRotationUpdate } from "../debug/controllerDebug";
import { playerWorldState } from "../world/playerWorldState";

const moveDirection = new Vector3();
const playerForward = new Vector3();
const baseRunSpeed = 13.2;
const boostedRunSpeed = 18.4;
const turnSpeed = 1.15;
const forwardBackSmoothing = 11;
const forwardBackStopSmoothing = 12;
const maxFrameDelta = 1 / 30;

export function CharacterController() {
  const bodyRef = useRef<RapierRigidBody | null>(null);
  const yawRef = useRef(0);
  const cameraYawRef = useRef(0);
  const controls = useKeyboardControls();
  const controlsRef = useRef(controls);
  const movementDirectionRef = useRef(new Vector3());
  const animationStateRef = useRef<CharacterAnimationState>("idle");
  const forwardBackSpeedRef = useRef(0);
  const lastMovementLogRef = useRef(0);
  const [animationState, setAnimationState] = useState<CharacterAnimationState>("idle");
  const spawn = useMemo<[number, number, number]>(() => [0, 2.8, 8], []);

  useFrame((_, delta) => {
    const body = bodyRef.current;
    if (!body) return;
    const frameDelta = Math.min(delta, maxFrameDelta);
    controlsRef.current = controls;

    const velocity = body.linvel();
    const translation = body.translation();
    playerWorldState.position.set(translation.x, translation.y, translation.z);
    const hasForwardBackInput = controls.forward !== controls.backward;
    const turnInput = Number(controls.left) - Number(controls.right);
    const forwardBackSpeed = isSpeedBoostActive() ? boostedRunSpeed : baseRunSpeed;

    if (turnInput !== 0) {
      markPlayerRotationUpdate(Math.floor(_.clock.elapsedTime * 60), "CharacterController");
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

    if (isControllerDebugEnabled() && performance.now() - lastMovementLogRef.current > 500) {
      lastMovementLogRef.current = performance.now();
      console.log("[StudioCLTD movement debug] FPS / velocity / input", {
        fps: Math.round(1 / Math.max(delta, 0.0001)),
        input: controls,
        smoothedForwardBackSpeed: forwardBackSpeedRef.current,
        velocity: {
          x: nextVelocity.x,
          y: nextVelocity.y,
          z: nextVelocity.z,
        },
      });
    }

    if (translation.y < -10) {
      console.log("Player fell off world — respawning.");
      forwardBackSpeedRef.current = 0;
      body.setTranslation({ x: spawn[0], y: spawn[1], z: spawn[2] }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }

    const nextState: CharacterAnimationState = isMoving ? "run" : "idle";

    if (animationStateRef.current !== nextState) {
      animationStateRef.current = nextState;
      setAnimationState(nextState);
    }
  });

  return (
    <>
      <ThirdPersonCamera
        animationStateRef={animationStateRef}
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
        <PlayerCharacter animationState={animationState} yawRef={yawRef} />
      </RigidBody>
    </>
  );
}
