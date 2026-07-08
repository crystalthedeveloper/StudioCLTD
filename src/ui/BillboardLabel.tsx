import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { ReactNode, useRef } from "react";
import { Euler, Group, Quaternion, Vector3 } from "three";
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
  position?: [number, number, number];
};

export function BillboardLabel({
  children,
  color = "#ffffff",
  fontSize = 0.28,
  lineHeight,
  maxWidth = 2.8,
  position = [0, 1.05, 0],
}: BillboardLabelProps) {
  const groupRef = useRef<Group>(null);
  const baseYRef = useRef(position[1]);

  useFrame(({ camera, clock }) => {
    const group = groupRef.current;
    if (!group) return;

    group.position.y = baseYRef.current + Math.sin(clock.elapsedTime * 2.1) * 0.045;
    group.getWorldPosition(worldPosition);

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
    <group ref={groupRef} position={position}>
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
