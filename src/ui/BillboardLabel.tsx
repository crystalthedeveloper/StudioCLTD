import { useGameFrame } from "../player/useGameFrame";
import { Text } from "@react-three/drei";
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
  outlineColor?: string;
  outlineWidth?: number;
  extruded?: boolean;
};

export function BillboardLabel({
  children,
  color = "#ffffff",
  fontSize = 0.28,
  lineHeight,
  maxWidth = 2.8,
  position = [0, 1.05, 0],
  outlineColor = "#05070b",
  outlineWidth = 0.012,
  extruded = false,
}: BillboardLabelProps) {
  const groupRef = useRef<Group>(null);

  useGameFrame(({ camera }) => {
    const group = groupRef.current;
    if (!group) return;

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
      {extruded && <Text
        position={[0, 0, -0.028]}
        material-depthTest={true}
        material-depthWrite={true}
        anchorX="center"
        anchorY="middle"
        color="#070a10"
        font={gameTextFont}
        fontSize={fontSize}
        lineHeight={lineHeight}
        maxWidth={maxWidth}
      >
        {children}
      </Text>}
      <Text
        material-depthTest={true}
        material-depthWrite={true}
        anchorX="center"
        anchorY="middle"
        color={color}
        font={gameTextFont}
        fontSize={fontSize}
        lineHeight={lineHeight}
        maxWidth={maxWidth}
        outlineColor={outlineColor}
        outlineWidth={outlineWidth}
      >
        {children}
      </Text>
    </group>
  );
}
