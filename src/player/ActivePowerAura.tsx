import { useEffect, useMemo, useSyncExternalStore } from "react";
import { powerModes, powerDurations, type PowerMode, getActivePower, getPowerRemainingMs, subscribePowers } from "./temporaryPowers";
import { gameNow } from "./gameFocus";
import { useGameFrame } from "./useGameFrame";
import { isCompactVisualBudget } from "../world/visualQuality";
import { createPowerSmoke, powerSmokeStrength } from "./powerSmoke";

export function ActivePowerAura() {
  const active = useSyncExternalStore(subscribePowers, getActivePower, getActivePower);
  return active ? <PowerAura key={active} mode={active} /> : null;
}

function PowerAura({ mode }: { mode: PowerMode }) {
  const smoke = useMemo(() => createPowerSmoke(powerModes[mode].color, isCompactVisualBudget()), [mode]);
  useEffect(() => () => {
    smoke.geometry.dispose();
    smoke.material.dispose();
  }, [smoke]);
  useGameFrame(() => {
    smoke.material.uniforms.uTime.value = gameNow() / 1000;
    smoke.material.uniforms.uStrength.value = powerSmokeStrength(getPowerRemainingMs(), powerDurations[mode]);
  });
  // Local to the player's feet: it follows movement, turning and transport naturally.
  return <mesh name="ActivePowerSmoke" geometry={smoke.geometry} material={smoke.material} frustumCulled={false} />;
}
