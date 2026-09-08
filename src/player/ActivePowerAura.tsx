import { useRef, useSyncExternalStore } from "react";
import { AdditiveBlending, Group } from "three";
import { powerModes, type PowerMode, getActivePower, subscribePowers } from "./temporaryPowers";
import { useGameFrame } from "./useGameFrame";

export function ActivePowerAura() {
  const active = useSyncExternalStore(subscribePowers, getActivePower, getActivePower);
  return active ? <PowerAura key={active} mode={active} /> : null;
}

function PowerAura({ mode }: { mode: PowerMode }) {
  const orbit = useRef<Group>(null);
  const elapsed = useRef(0);
  useGameFrame((_, delta) => {
    elapsed.current += delta;
    if (!orbit.current) return;
    orbit.current.rotation.y = elapsed.current * (mode === "rapid" ? 2.8 : 1.3);
    orbit.current.scale.setScalar(1 + Math.sin(elapsed.current * 4) * 0.035);
  });
  const color = powerModes[mode].color;
  return (
    <group name="ActivePowerAura" position={[0, 0.95, 0]} ref={orbit}>
      {[0.35, -0.35].map((tilt, index) => (
        <group key={tilt} rotation={[Math.PI / 2 + tilt, index * Math.PI / 2, 0]}>
          <mesh>
            <torusGeometry args={[0.58, 0.012, 6, 48]} />
            <meshBasicMaterial color={color} transparent opacity={0.8} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh>
            <torusGeometry args={[0.58, 0.035, 6, 48]} />
            <meshBasicMaterial color={color} transparent opacity={0.12} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh position={[0.58, 0, 0]}>
            <sphereGeometry args={[0.035, 8, 6]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
