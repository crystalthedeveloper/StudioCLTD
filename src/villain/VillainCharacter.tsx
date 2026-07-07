import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Dispatch, SetStateAction, useEffect, useMemo, useRef } from "react";
import { Group, MathUtils, Mesh, Vector3 } from "three";
import { SkeletonUtils } from "three-stdlib";

export type VillainStatus = "idle" | "walking" | "running" | "hit" | "dead";

type VillainCharacterProps = {
  allowPatrol?: boolean;
  basePosition: Vector3;
  setVillainStatus: Dispatch<SetStateAction<VillainStatus>>;
  villainStatus: VillainStatus;
};

const animationByStatus: Record<VillainStatus, string> = {
  idle: "idle",
  walking: "walk",
  running: "run",
  hit: "hit",
  dead: "die",
};

export function VillainCharacter({ allowPatrol = true, basePosition, setVillainStatus, villainStatus }: VillainCharacterProps) {
  const model = useGLTF("/models/temp-villain.gltf");
  const scene = useMemo(() => SkeletonUtils.clone(model.scene), [model.scene]);
  const groupRef = useRef<Group>(null);
  const lastStatusRef = useRef<VillainStatus>(villainStatus);
  const statusStartedAtRef = useRef(performance.now());
  const patrolDirectionRef = useRef(1);
  const patrolOffsetRef = useRef(0);
  const { actions } = useAnimations(model.animations, groupRef);

  useEffect(() => {
    scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
  }, [scene]);

  useEffect(() => {
    if (lastStatusRef.current !== villainStatus) {
      lastStatusRef.current = villainStatus;
      statusStartedAtRef.current = performance.now();
      console.log("[StudioCLTD villain] State changed", villainStatus);
    }

    const action = actions[animationByStatus[villainStatus]];
    if (!action) return;

    action.reset().fadeIn(0.14).play();

    return () => {
      action.fadeOut(0.14);
    };
  }, [actions, villainStatus]);

  useEffect(() => {
    if (!allowPatrol || villainStatus !== "idle") return;

    const timeout = window.setTimeout(() => {
      setVillainStatus((current) => (current === "idle" ? "walking" : current));
    }, 1400);

    return () => window.clearTimeout(timeout);
  }, [allowPatrol, setVillainStatus, villainStatus]);

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;

    const elapsedStatus = performance.now() - statusStartedAtRef.current;
    if (villainStatus === "hit" && elapsedStatus > 720) {
      setVillainStatus("walking");
    }

    const speed = villainStatus === "running" ? 2.1 : villainStatus === "walking" ? 0.72 : 0;
    if (speed > 0) {
      patrolOffsetRef.current += patrolDirectionRef.current * speed * delta;
      if (Math.abs(patrolOffsetRef.current) > 3.2) {
        patrolOffsetRef.current = MathUtils.clamp(patrolOffsetRef.current, -3.2, 3.2);
        patrolDirectionRef.current *= -1;
      }
    }

    const hitPulse = villainStatus === "hit" ? Math.sin(Math.min(elapsedStatus / 720, 1) * Math.PI) : 0;
    const defeatedLean = villainStatus === "dead" ? -Math.PI * 0.46 : 0;
    const walkBob = speed > 0 ? Math.abs(Math.sin(clock.elapsedTime * (villainStatus === "running" ? 10 : 5))) * 0.08 : 0;

    groupRef.current.position.set(
      basePosition.x + patrolOffsetRef.current,
      basePosition.y + walkBob + hitPulse * 0.28,
      basePosition.z
    );
    groupRef.current.rotation.y = patrolDirectionRef.current > 0 ? Math.PI * 0.22 : -Math.PI * 0.22;
    groupRef.current.rotation.z = defeatedLean + hitPulse * -0.24;
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} scale={1.16} />
      <pointLight color="#ff273a" intensity={8} distance={8} position={[0, 1.8, 0]} />
    </group>
  );
}

useGLTF.preload("/models/temp-villain.gltf");
