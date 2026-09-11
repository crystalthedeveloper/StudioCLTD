import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { isGameFocused, subscribeGameFocus } from "../player/gameFocus";
import { getActivePower, getSelectedPower, getPowerRemainingMs, powerDurations, powerModes, subscribePowers } from "../player/temporaryPowers";

/** Update only the meter each animation frame. Pausing stops rendering work as well as game time. */
export function PowerMeter() {
  const selected = useSyncExternalStore(subscribePowers, getSelectedPower);
  const [remaining, setRemaining] = useState(() => getPowerRemainingMs(getSelectedPower()));
  useEffect(() => {
    let frame: number | undefined;
    const update = () => {
      frame = undefined;
      setRemaining(getPowerRemainingMs(getSelectedPower()));
      if (isGameFocused() && getSelectedPower() !== null && getActivePower() === getSelectedPower()) frame = window.requestAnimationFrame(update);
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
  const progress = selected ? Math.min(1, remaining / powerDurations[selected]) : 0;
  return (
    <div className="game-hud__power-meter" style={{ "--power-color": selected ? powerModes[selected].color : "#777" } as CSSProperties}>
      <span>POWER {selected ? `${Math.ceil(remaining / 1000)}s` : ""}</span>
      <div className="game-hud__meter-track" role="progressbar" aria-label="Selected power time remaining"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
        <i style={{ transform: `scaleX(${progress})` }} />
      </div>
    </div>
  );
}
