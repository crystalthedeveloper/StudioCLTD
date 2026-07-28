import { BallCollider, CollisionEnterPayload, RapierRigidBody, RigidBody } from "@react-three/rapier";
import { useEffect, useRef } from "react";

const ballRadius = 0.58;
const brandYellow = "#facc15";
const hitImpulse = 1.65;
const upwardImpulse = 0.48;
const maxHorizontalSpeed = 15;
const maxVerticalSpeed = 7;
const safeBallSpawns = [
  [-15, ballRadius + 0.08, -1],
  [14, ballRadius + 0.08, -8],
  [-11, ballRadius + 0.08, 21],
  [22, ballRadius + 0.08, -3],
] as const;
const ballSpawn = safeBallSpawns[Math.floor(Math.random() * safeBallSpawns.length)];

export function InteractiveBall({ restartKey }: { restartKey: number }) {
  const bodyRef = useRef<RapierRigidBody | null>(null);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;

    body.setTranslation({ x: ballSpawn[0], y: ballSpawn[1], z: ballSpawn[2] }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }, [restartKey]);

  const handleCollisionEnter = ({ other }: CollisionEnterPayload) => {
    if (other.rigidBodyObject?.name !== "StudioCLTDPlayer") return;

    const ball = bodyRef.current;
    const player = other.rigidBody;
    if (!ball || !player) return;

    const ballPosition = ball.translation();
    const playerPosition = player.translation();
    const deltaX = ballPosition.x - playerPosition.x;
    const deltaZ = ballPosition.z - playerPosition.z;
    const distance = Math.hypot(deltaX, deltaZ) || 1;

    ball.applyImpulse(
      {
        x: (deltaX / distance) * hitImpulse,
        y: upwardImpulse,
        z: (deltaZ / distance) * hitImpulse,
      },
      true,
    );

    const velocity = ball.linvel();
    const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
    const horizontalScale = horizontalSpeed > maxHorizontalSpeed ? maxHorizontalSpeed / horizontalSpeed : 1;
    ball.setLinvel(
      {
        x: velocity.x * horizontalScale,
        y: Math.min(velocity.y, maxVerticalSpeed),
        z: velocity.z * horizontalScale,
      },
      true,
    );
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
      mass={0.45}
      linearDamping={0.055}
      angularDamping={0.12}
      onCollisionEnter={handleCollisionEnter}
    >
      <BallCollider args={[ballRadius]} friction={0.38} restitution={0.46} />
      <mesh castShadow={false} receiveShadow={false}>
        <sphereGeometry args={[ballRadius, 20, 14]} />
        <meshStandardMaterial color={brandYellow} metalness={0.04} roughness={0.56} envMapIntensity={0.24} />
      </mesh>
    </RigidBody>
  );
}
