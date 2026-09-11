import { useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { powerIcons } from "../../player/powerIcons";
import { useLayoutEffect, useMemo, useRef } from "react";
import { DoubleSide, InstancedMesh, Object3D, SRGBColorSpace } from "three";
import { playCollectibleSound } from "../../audio/collectibleSounds";
import { type PowerMode, collectFixPower, fixPowerRespawnMs } from "../../player/temporaryPowers";
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

const ignoreRaycast = () => {};

/** Three instanced SVG draws, with baked icon-shaped glow and no extra lights. */
export function FixPowerPickups() {
  const camera = useThree((state) => state.camera);
  const textures = useTexture(pickupModes.map((mode) => powerIcons[mode].worldSrc));
  const icons = useRef<(InstancedMesh | null)[]>([]);
  const states = useMemo(() => locations.map(() => ({ collectedAt: -Infinity })), []);
  const transform = useMemo(() => new Object3D(), []);
  const updateVisual = (index: number, now: number, elapsed: number) => {
    const [x, y, z] = locations[index];
    const available = elapsed >= fixPowerRespawnMs;
    const pickupProgress = Math.min(elapsed / 300, 1);
    const size = available ? 0.7125 : 0.7125 * (1 - pickupProgress);
    transform.position.set(x, y + 0.65 + (available ? Math.sin(now / 850 + index) * 0.06 : pickupProgress * 0.9), z);
    // Gentle bobbing only: keep the SVG fully camera-facing and upright.
    transform.quaternion.copy(camera.quaternion);
    transform.scale.setScalar(size);
    transform.updateMatrix();
    icons.current[index % pickupModes.length]?.setMatrixAt(Math.floor(index / pickupModes.length), transform.matrix);
  };
  useGameFrame(() => {
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
      updateVisual(index, now, elapsed);
    });
    icons.current.forEach((mesh) => { if (mesh) mesh.instanceMatrix.needsUpdate = true; });
  });
  // Initialize the paused first render without collecting or advancing timers.
  useLayoutEffect(() => {
    textures.forEach((texture) => { texture.colorSpace = SRGBColorSpace; texture.needsUpdate = true; });
    const now = gameNow();
    locations.forEach((_, index) => updateVisual(index, now, now - states[index].collectedAt));
    icons.current.forEach((mesh) => { if (mesh) mesh.instanceMatrix.needsUpdate = true; });
  }, [textures, camera, states, transform]);
  return <group name="FixPowerPickups">
    {pickupModes.map((mode, index) => (
      <instancedMesh key={mode} name={`PowerIcon:${powerIcons[mode].name}`}
        ref={(mesh) => { icons.current[index] = mesh; }}
        args={[undefined, undefined, Math.ceil((locations.length - index) / pickupModes.length)]}
        frustumCulled={false} raycast={ignoreRaycast}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={textures[index]} transparent alphaTest={0.005}
          side={DoubleSide} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    ))}
  </group>;
}
