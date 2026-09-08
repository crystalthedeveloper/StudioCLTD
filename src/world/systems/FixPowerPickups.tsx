import { BillboardLabel } from "../../ui/BillboardLabel";
import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, Group, InstancedMesh, Object3D } from "three";
import { playCollectibleSound } from "../../audio/collectibleSounds";
import { powerModes, type PowerMode, collectFixPower, fixPowerRespawnMs } from "../../player/temporaryPowers";
import { gameNow } from "../../player/gameFocus";
import { useGameFrame } from "../../player/useGameFrame";
import { hubSections } from "../hubSections";
import { playerWorldState } from "../playerWorldState";
import { homeBaseCenter } from "./HomeBase";

const locations: [number, number, number][] = [
  [-6, 0, 6], [6, 0, 6], [0, 0, 14], [0, 0, -14],
  [-18, 0, 0], [18, 0, 0], [-24, 0, -24], [24, 0, -24],
  [-24, 0, 24], [24, 0, 24],
  ...hubSections.map(({ position: [x, y, z] }): [number, number, number] => [x + 5, y, z + 3]),
  [homeBaseCenter[0] - 5, homeBaseCenter[1], homeBaseCenter[2]],
  [homeBaseCenter[0] + 5, homeBaseCenter[1], homeBaseCenter[2]],
];

const pickupModes: PowerMode[] = ["standard", "rapid", "power"];

/** Two instanced draws for all cubes; no physics bodies or extra light sources. */
export function FixPowerPickups() {
  const labels = useRef<(Group | null)[]>([]);
  const cubes = useRef<InstancedMesh>(null);
  const outlines = useRef<InstancedMesh>(null);
  const states = useMemo(() => locations.map(() => ({ collectedAt: -Infinity })), []);
  const transform = useMemo(() => new Object3D(), []);
  useGameFrame(() => {
    if (!cubes.current || !outlines.current) return;
    const now = gameNow();
    const player = playerWorldState.position;
    locations.forEach(([x, y, z], index) => {
      const state = states[index];
      let elapsed = now - state.collectedAt;
      if (elapsed >= fixPowerRespawnMs && Math.hypot(player.x - x, player.z - z) < 1.15 && Math.abs(player.y - (y + 0.9)) < 1.5) {
        if (collectFixPower(pickupModes[index % pickupModes.length])) {
          state.collectedAt = now;
          elapsed = 0;
          playCollectibleSound("power");
        }
      }
      const available = elapsed >= fixPowerRespawnMs;
      const label = labels.current[index];
      if (label) label.visible = available && Math.hypot(player.x - x, player.z - z) < 14;
      const pickupProgress = Math.min(elapsed / 300, 1);
      const baseSize = powerModes[pickupModes[index % pickupModes.length]].pickupSize;
      const size = available ? baseSize : baseSize * (1 - pickupProgress);
      transform.position.set(x, y + 0.65 + (available ? Math.sin(now / 500 + index) * 0.08 : pickupProgress * 0.9), z);
      transform.rotation.set(0.15, now / 1100 + index, 0.1);
      transform.scale.setScalar(size);
      transform.updateMatrix();
      cubes.current!.setMatrixAt(index, transform.matrix);
      transform.scale.setScalar(size * (available ? 1.4 : 2.5));
      transform.updateMatrix();
      outlines.current!.setMatrixAt(index, transform.matrix);
    });
    cubes.current.instanceMatrix.needsUpdate = true;
    outlines.current.instanceMatrix.needsUpdate = true;
  });
  // Initialize positions before the first paused render, without advancing time.
  const initialize = (mesh: InstancedMesh | null, outline: boolean) => {
    if (!mesh) return;
    locations.forEach(([x, y, z], index) => {
      transform.position.set(x, y + 0.65, z);
      transform.rotation.set(0.15, index, 0.1);
      transform.scale.setScalar(powerModes[pickupModes[index % pickupModes.length]].pickupSize * (outline ? 1.4 : 1));
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
      mesh.setColorAt(index, new Color(powerModes[pickupModes[index % pickupModes.length]].color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };
  useLayoutEffect(() => { initialize(cubes.current, false); initialize(outlines.current, true); }, [transform]);
  return <group name="FixPowerPickups">
    {locations.map(([x, y, z], index) => (
      <group key={index} ref={(group) => { labels.current[index] = group; }} position={[x, y + 1.25, z]}
        visible={Math.hypot(playerWorldState.position.x - x, playerWorldState.position.z - z) < 14}>
        <BillboardLabel position={[0, 0, 0]} color={powerModes[pickupModes[index % pickupModes.length]].color} fontSize={0.18} maxWidth={1.7}>
          {powerModes[pickupModes[index % pickupModes.length]].label}
        </BillboardLabel>
      </group>
    ))}
    <instancedMesh ref={cubes} args={[undefined, undefined, locations.length]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#ffffff" toneMapped={false} />
    </instancedMesh>
    <instancedMesh ref={outlines} args={[undefined, undefined, locations.length]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.35} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  </group>;
}
