import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { isGameFocused, subscribeGameFocus } from "../player/gameFocus";
import { getActivePower, getPowerRemainingMs, powerDurations, powerModes, subscribePowers } from "../player/temporaryPowers";

/** Update only the meter each animation frame. Pausing stops rendering work as well as game time. */
export function PowerMeter() {
  const active = useSyncExternalStore(subscribePowers, getActivePower);
  const [remaining, setRemaining] = useState(getPowerRemainingMs);
  useEffect(() => {
    let frame: number | undefined;
    const update = () => {
      frame = undefined;
      setRemaining(getPowerRemainingMs());
      if (isGameFocused() && getActivePower()) frame = window.requestAnimationFrame(update);
    };
    const sync = () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      update();
    };
    const unsubscribePower = subscribePowers(sync);
    const unsubscribeFocus = subscribeGameFocus(sync);
    sync();
    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      unsubscribePower();
      unsubscribeFocus();
    };
  }, []);
  const progress = active ? Math.min(1, remaining / powerDurations[active]) : 0;
  return (
    <div className="game-hud__power-meter" style={{ "--power-color": active ? powerModes[active].color : "#777" } as CSSProperties}>
      <span>POWER {active ? `${Math.ceil(remaining / 1000)}s` : ""}</span>
      <div className="game-hud__meter-track" role="progressbar" aria-label="Active power time remaining"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
        <i style={{ transform: `scaleX(${progress})` }} />
      </div>
    </div>
  );
}
