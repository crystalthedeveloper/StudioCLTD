import { BallCollider, CollisionEnterPayload, RapierRigidBody, RigidBody } from "@react-three/rapier";
import { useEffect, useRef } from "react";

const brandYellow = "#facc15";
const beachBallRadius = 0.78;
const forwardImpulse = 0.35;
const upwardImpulse = 1.15;
const minimumLaunchSpeed = 8;
const maxHorizontalSpeed = 8;
const maxVerticalSpeed = 10;
const hitCooldownMs = 300;
const floorContactGraceMs = 180;
const safeBallSpawns = [
  [-15, beachBallRadius + 0.08, -1],
  [14, beachBallRadius + 0.08, -8],
  [-11, beachBallRadius + 0.08, 21],
  [22, beachBallRadius + 0.08, -3],
] as const;
const ballSpawn = safeBallSpawns[Math.floor(Math.random() * safeBallSpawns.length)];

type InteractiveBallProps = {
  onFloorContact: () => void;
  onPlayerHit: () => void;
  restartKey: number;
};

export function InteractiveBall({ onFloorContact, onPlayerHit, restartKey }: InteractiveBallProps) {
  const bodyRef = useRef<RapierRigidBody | null>(null);
  const lastHitTimeRef = useRef(-Infinity);

  useEffect(() => {
    const body = bodyRef.current;
    lastHitTimeRef.current = -Infinity;
    if (!body) return;

    body.setTranslation({ x: ballSpawn[0], y: ballSpawn[1], z: ballSpawn[2] }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }, [restartKey]);

  const handleCollisionEnter = ({ other }: CollisionEnterPayload) => {
    const now = performance.now();

    if (other.rigidBodyObject?.name === "StudioCLTDFloor") {
      if (now - lastHitTimeRef.current < floorContactGraceMs) return;
      onFloorContact();
      return;
    }

    if (other.rigidBodyObject?.name !== "StudioCLTDPlayer") return;
    if (now - lastHitTimeRef.current < hitCooldownMs) return;

    const ball = bodyRef.current;
    const player = other.rigidBody;
    if (!ball || !player) return;
    lastHitTimeRef.current = now;

    const ballPosition = ball.translation();
    const playerPosition = player.translation();
    const deltaX = ballPosition.x - playerPosition.x;
    const deltaZ = ballPosition.z - playerPosition.z;
    const distance = Math.hypot(deltaX, deltaZ) || 1;

    ball.applyImpulse(
      {
        x: (deltaX / distance) * forwardImpulse,
        y: upwardImpulse,
        z: (deltaZ / distance) * forwardImpulse,
      },
      true,
    );

    const velocity = ball.linvel();
    const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
    const horizontalScale = horizontalSpeed > maxHorizontalSpeed ? maxHorizontalSpeed / horizontalSpeed : 1;
    ball.setLinvel(
      {
        x: velocity.x * horizontalScale,
        y: Math.min(maxVerticalSpeed, Math.max(velocity.y, minimumLaunchSpeed)),
        z: velocity.z * horizontalScale,
      },
      true,
    );
    onPlayerHit();
  };

  return (
    <RigidBody
      ref={bodyRef}
      name="InteractiveCLTDBall"
      type="dynamic"
      colliders={false}
      position={ballSpawn}
      canSleep
      ccd
      mass={0.28}
      gravityScale={0.42}
      linearDamping={0.24}
      angularDamping={0.3}
      onCollisionEnter={handleCollisionEnter}
    >
      <BallCollider args={[beachBallRadius]} friction={0.32} restitution={0.58} />
      <mesh castShadow={false} receiveShadow={false}>
        <sphereGeometry args={[beachBallRadius, 20, 14]} />
        <meshStandardMaterial color={brandYellow} metalness={0.04} roughness={0.56} envMapIntensity={0.24} />
      </mesh>
    </RigidBody>
  );
}
