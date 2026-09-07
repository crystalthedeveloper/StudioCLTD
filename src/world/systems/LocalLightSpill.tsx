import { useEffect, useRef, useState } from "react";
import { Group, PointLight, Vector3 } from "three";
import { useGameFrame } from "../../player/useGameFrame";
import { playerWorldState } from "../playerWorldState";
import { isCompactVisualBudget } from "../visualQuality";

const sources = new Set<{ object: Group; color: string; intensity: number; distance: number; position: Vector3 }>();

/** Register a visual light source without allocating another GPU light. */
export function LocalLightSpill({ color = "#b9d5e6", intensity = 3, distance = 7, position = [0, 0.5, 0] }: {
  color?: string; intensity?: number; distance?: number; position?: [number, number, number];
}) {
  const ref = useRef<Group>(null);
  useEffect(() => {
    if (!ref.current) return;
    const source = { object: ref.current, color, intensity, distance, position: new Vector3() };
    sources.add(source);
    return () => { sources.delete(source); };
  }, [color, intensity, distance]);
  return <group ref={ref} position={position} />;
}

/** Fixed light count keeps shader cost bounded regardless of the number of pads. */
export function LocalLightPool() {
  const [count] = useState(() => isCompactVisualBudget() ? 2 : 4);
  const lights = useRef<(PointLight | null)[]>([]);
  const previousUpdate = useRef(-Infinity);
  useGameFrame(({ clock }) => {
    if (clock.elapsedTime - previousUpdate.current < 0.1) return;
    previousUpdate.current = clock.elapsedTime;
    const nearby = [...sources].filter((source) => {
      source.object.getWorldPosition(source.position);
      return source.position.distanceToSquared(playerWorldState.position) < 24 * 24;
    }).sort((a, b) => a.position.distanceToSquared(playerWorldState.position) - b.position.distanceToSquared(playerWorldState.position));
    lights.current.forEach((light, index) => {
      if (!light) return;
      const source = nearby[index];
      light.intensity = source?.intensity ?? 0;
      if (!source) return;
      light.position.copy(source.position);
      light.color.set(source.color);
      light.distance = source.distance;
    });
  });
  return <>{Array.from({ length: count }, (_, index) => (
    <pointLight key={index} ref={(light) => { lights.current[index] = light; }} intensity={0} decay={2} />
  ))}</>;
}
