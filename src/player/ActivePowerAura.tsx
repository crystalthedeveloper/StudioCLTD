import { useEffect, useMemo, useSyncExternalStore } from "react";
import { powerModes, powerDurations, type PowerMode, getActivePowerMask, powerOrder, getPowerRemainingMs, subscribePowers } from "./temporaryPowers";
import { gameNow } from "./gameFocus";
import { useGameFrame } from "./useGameFrame";
import { isCompactVisualBudget } from "../world/visualQuality";
import { createPowerSmoke, powerSmokeStrength } from "./powerSmoke";

export function ActivePowerAura() {
  const mask = useSyncExternalStore(subscribePowers, getActivePowerMask, getActivePowerMask);
  return <>{powerOrder.map((mode, index) => mask & (1 << index) ? <PowerAura key={mode} mode={mode} /> : null)}</>;
}

function PowerAura({ mode }: { mode: PowerMode }) {
  const smoke = useMemo(() => createPowerSmoke(powerModes[mode].color, isCompactVisualBudget()), [mode]);
  useEffect(() => () => {
    smoke.geometry.dispose();
    smoke.material.dispose();
  }, [smoke]);
  useGameFrame(() => {
    smoke.material.uniforms.uTime.value = gameNow() / 1000;
    smoke.material.uniforms.uStrength.value = powerSmokeStrength(getPowerRemainingMs(mode), powerDurations[mode]);
  });
  // Local to the player's feet: it follows movement, turning and transport naturally.
  return <mesh name="ActivePowerSmoke" geometry={smoke.geometry} material={smoke.material} frustumCulled={false} />;
}
