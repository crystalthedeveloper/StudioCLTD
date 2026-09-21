import { BallCollider, RigidBody, type RapierCollider, type IntersectionEnterPayload, type IntersectionExitPayload } from "@react-three/rapier";
import { useEffect, useMemo, useRef, useState } from "react";
import { pickupSurfaceGap, usePickupSurfaces, type PickupSurface } from "../pickupSurface";
import { routePowerPositions } from "../worldLayout";
import { hubSections } from "../hubSections";
import { homeBaseCenter } from "./HomeBase";
import { isPlayerObject } from "../playerCollision";
import { playCollectibleSound } from "../../audio/collectibleSounds";
import { powerOrder, powerModes, collectFixPower, fixPowerRespawnMs, type PowerMode } from "../../player/temporaryPowers";
import { createPowerSmoke } from "../../player/powerSmoke";
import { gameNow, gameTimers } from "../../player/gameFocus";
import { useGameFrame } from "../../player/useGameFrame";

import { isCompactVisualBudget } from "../visualQuality";
import { PickupSmokeGlow } from "./PickupSmokeGlow";

const locations: [number, number, number][] = [
  ...routePowerPositions,
  ...hubSections.map(({ position: [x, y, z], entrance: [dx, dz] }): [number, number, number] =>
    [x + dx * 9 - dz * 5, y, z + dz * 9 + dx * 5]),
  [homeBaseCenter[0] - 5, homeBaseCenter[1], homeBaseCenter[2]],
  [homeBaseCenter[0] + 5, homeBaseCenter[1], homeBaseCenter[2]],
];

const pickupRadius = 0.24;
export function FixPowerPickups() {
  const surfaces = usePickupSurfaces(locations);
  return <group name="FixPowerPickups">{locations.map(([x, , z], index) =>
    <SmokePickup key={index} x={x} z={z} surface={surfaces[index]} mode={powerOrder[index % powerOrder.length]} />
  )}</group>;
}
function SmokePickup({ x, z, surface, mode }: { x: number; z: number; surface: PickupSurface; mode: PowerMode }) {
  const smoke = useMemo(() => createPowerSmoke(powerModes[mode].color, isCompactVisualBudget(), 0.52), [mode]);
  const collider = useRef<RapierCollider>(null);
  const available = useRef(true);
  const [visible, setVisible] = useState(true);
  const overlaps = useRef(new Set<number>());
  const timer = useRef<number>();
  const collect = () => {
    if (!available.current || overlaps.current.size === 0 || !collectFixPower(mode)) return;
    available.current = false;
    overlaps.current.clear();
    collider.current?.setEnabled(false);
    setVisible(false);
    playCollectibleSound("power");
    timer.current = gameTimers.setTimeout(() => {
      available.current = true;
      setVisible(true);
      collider.current?.setEnabled(true);
    }, fixPowerRespawnMs);
  };
  const enter = ({ other }: IntersectionEnterPayload) => {
    if (!isPlayerObject(other.rigidBodyObject) && !isPlayerObject(other.colliderObject)) return;
    overlaps.current.add(other.collider.handle);
    collect();
  };
  const leave = ({ other }: IntersectionExitPayload) => { overlaps.current.delete(other.collider.handle); };
  useGameFrame(() => {
    smoke.material.uniforms.uTime.value = gameNow() / 1000;
    smoke.material.uniforms.uStrength.value = 1;
    // Handles an overlap that began while paused without using distance tests.
    collect();
  });
  useEffect(() => {
    smoke.material.uniforms.uStrength.value = 1;
    return () => { gameTimers.clearTimeout(timer.current); smoke.geometry.dispose(); smoke.material.dispose(); };
  }, [smoke]);
  return <RigidBody type="fixed" colliders={false} position={[x, surface.y + pickupSurfaceGap, z]}>
    <BallCollider ref={collider} sensor args={[pickupRadius]} position={[0, pickupRadius, 0]}
      onIntersectionEnter={enter} onIntersectionExit={leave} />
    <PickupSmokeGlow visible={visible} color={powerModes[mode].color} surface={surface} />
    <mesh name={`PowerSmoke:${mode}`} visible={visible} geometry={smoke.geometry} material={smoke.material}
      frustumCulled={false} dispose={null} />
  </RigidBody>;
}
