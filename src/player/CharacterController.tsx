import { CapsuleCollider, RigidBody, RapierRigidBody } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { MathUtils, Vector3 } from "three";
import { PlayerCharacter } from "./PlayerCharacter";
import { ThirdPersonCamera } from "./ThirdPersonCamera";
import { CharacterAnimationState } from "./playerTypes";
import { useKeyboardControls } from "./useKeyboardControls";
import { markPlayerRotationUpdate } from "../debug/controllerDebug";

const moveDirection = new Vector3();
const facingDirection = new Vector3();

function getGroundHeight(x: number, z: number) {
  const platforms = [
    { x: 28, z: -18, halfX: 12, halfZ: 7, top: 2.1 },
    { x: -34, z: 24, halfX: 9, halfZ: 11, top: 1.5 },
    { x: 5, z: -43, halfX: 17, halfZ: 6, top: 3.2 },
  ];

  for (const platform of platforms) {
    if (Math.abs(x - platform.x) <= platform.halfX && Math.abs(z - platform.z) <= platform.halfZ) {
      return platform.top;
    }
  }

  return 0;
}

export function CharacterController() {
  const bodyRef = useRef<RapierRigidBody | null>(null);
  const yawRef = useRef(0);
  const cameraYawRef = useRef(0);
  const controls = useKeyboardControls();
  const controlsRef = useRef(controls);
  const movementDirectionRef = useRef(new Vector3());
  const animationStateRef = useRef<CharacterAnimationState>("idle");
  const [animationState, setAnimationState] = useState<CharacterAnimationState>("idle");
  const spawn = useMemo<[number, number, number]>(() => [0, 2.8, 8], []);

  useFrame((_, delta) => {
    const body = bodyRef.current;
    if (!body) return;
    controlsRef.current = controls;
    animationStateRef.current = animationState;

    const velocity = body.linvel();
    const translation = body.translation();
    const groundHeight = getGroundHeight(translation.x, translation.z);
    const grounded = translation.y <= groundHeight + 1.13 && velocity.y <= 0.75;
    const speed = controls.run ? 8.2 : 4.6;
    const turnSpeed = controls.run ? 2.85 : 2.35;

    const turnInput = Number(controls.left) - Number(controls.right);
    if (turnInput !== 0) {
      markPlayerRotationUpdate(Math.floor(_.clock.elapsedTime * 60), "CharacterController");
      console.log("[StudioCLTD camera debug] Player rotation updated", {
        delta,
        nextYaw: yawRef.current + turnInput * turnSpeed * delta,
        source: "CharacterController",
        turnInput,
      });
      yawRef.current += turnInput * turnSpeed * delta;
      cameraYawRef.current = MathUtils.lerp(cameraYawRef.current, yawRef.current, 1 - Math.exp(-delta * 5.5));
    }

    facingDirection.set(Math.sin(yawRef.current), 0, Math.cos(yawRef.current));

    moveDirection.set(0, 0, 0);
    if (controls.forward) moveDirection.sub(facingDirection);
    if (controls.backward) moveDirection.add(facingDirection);

    const isMoving = moveDirection.lengthSq() > 0;
    if (isMoving) {
      moveDirection.normalize();
    }
    movementDirectionRef.current.copy(moveDirection);

    const acceleration = 1 - Math.exp(-delta * (isMoving ? 13 : 9));
    const targetVelocity = {
      x: isMoving ? moveDirection.x * speed : 0,
      z: isMoving ? moveDirection.z * speed : 0,
    };

    const nextVelocity = {
      x: MathUtils.lerp(velocity.x, targetVelocity.x, acceleration),
      y: velocity.y,
      z: MathUtils.lerp(velocity.z, targetVelocity.z, acceleration),
    };

    if (controls.jump && grounded) {
      nextVelocity.y = 7.4;
    }

    body.setLinvel(nextVelocity, true);

    if (translation.y < -18) {
      body.setTranslation({ x: spawn[0], y: spawn[1], z: spawn[2] }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }

    const nextState: CharacterAnimationState = !grounded
      ? velocity.y > 0.4
        ? "jump"
        : "fall"
      : isMoving
        ? controls.run
          ? "run"
          : "walk"
        : "idle";

    setAnimationState((current) => (current === nextState ? current : nextState));
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
        colliders={false}
        position={spawn}
        enabledRotations={[false, false, false]}
        linearDamping={0.14}
        angularDamping={1}
        canSleep={false}
      >
        <CapsuleCollider args={[0.65, 0.38]} />
        <PlayerCharacter animationState={animationState} yawRef={yawRef} />
      </RigidBody>
    </>
  );
}
