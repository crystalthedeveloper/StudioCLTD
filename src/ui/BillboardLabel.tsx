import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { ReactNode, useRef } from "react";
import { Euler, Group, Quaternion, Vector3 } from "three";
import { playerWorldState } from "../world/playerWorldState";
import { gameTextFont } from "./textFont";

const worldPosition = new Vector3();
const parentQuaternion = new Quaternion();
const inverseParentQuaternion = new Quaternion();
const targetQuaternion = new Quaternion();
const yawEuler = new Euler(0, 0, 0, "YXZ");

type BillboardLabelProps = {
  children: ReactNode;
  color?: string;
  fontSize?: number;
  lineHeight?: number;
  maxWidth?: number;
  maxVisibleDistance?: number;
  position?: [number, number, number];
};

export function BillboardLabel({
  children,
  color = "#ffffff",
  fontSize = 0.28,
  lineHeight,
  maxWidth = 2.8,
  maxVisibleDistance,
  position = [0, 1.05, 0],
}: BillboardLabelProps) {
  const groupRef = useRef<Group>(null);
  const lastUpdateRef = useRef(0);
  const visibleRef = useRef(maxVisibleDistance === undefined);

  useFrame(({ camera, clock }) => {
    const updateInterval = visibleRef.current ? 0.1 : 0.35;
    if (clock.elapsedTime - lastUpdateRef.current < updateInterval) return;
    lastUpdateRef.current = clock.elapsedTime;

    const group = groupRef.current;
    if (!group) return;

    group.getWorldPosition(worldPosition);
    if (maxVisibleDistance !== undefined) {
      const deltaX = playerWorldState.position.x - worldPosition.x;
      const deltaY = playerWorldState.position.y - worldPosition.y;
      const deltaZ = playerWorldState.position.z - worldPosition.z;
      const visible = deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ <= maxVisibleDistance * maxVisibleDistance;
      visibleRef.current = visible;
      group.visible = visible;
      if (!visible) return;
    }

    const yaw = Math.atan2(camera.position.x - worldPosition.x, camera.position.z - worldPosition.z);
    yawEuler.set(0, yaw, 0);
    targetQuaternion.setFromEuler(yawEuler);

    if (group.parent) {
      group.parent.getWorldQuaternion(parentQuaternion);
      inverseParentQuaternion.copy(parentQuaternion).invert();
      group.quaternion.copy(inverseParentQuaternion).multiply(targetQuaternion);
      return;
    }

    group.quaternion.copy(targetQuaternion);
  });

  return (
    <group ref={groupRef} position={position} visible={maxVisibleDistance === undefined}>
      <Text
        anchorX="center"
        anchorY="middle"
        color={color}
        font={gameTextFont}
        fontSize={fontSize}
        lineHeight={lineHeight}
        maxWidth={maxWidth}
      >
        {children}
      </Text>
    </group>
  );
}
