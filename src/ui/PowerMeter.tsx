import { useEffect, useState, type CSSProperties } from "react";
import { isGameFocused, subscribeGameFocus } from "../player/gameFocus";
import { getPowerRemainingMs, powerDurations, powerModes, getPowerStatus, type PowerMode, subscribePowers } from "../player/temporaryPowers";

/** Update only the meter each animation frame. Pausing stops rendering work as well as game time. */
export function PowerMeter({ mode }: { mode: PowerMode }) {
  const [remaining, setRemaining] = useState(() => getPowerRemainingMs(mode));
  useEffect(() => {
    let frame: number | undefined;
    const update = () => {
      frame = undefined;
      setRemaining(getPowerRemainingMs(mode));
      if (isGameFocused() && getPowerRemainingMs(mode) > 0) frame = window.requestAnimationFrame(update);
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
  }, [mode]);
  const progress = Math.min(1, remaining / powerDurations[mode]);
  const status = getPowerStatus(mode);
  const power = powerModes[mode];
  return (
    <button type="button" className="studio-button game-hud__power-bar"
      style={{ "--power-color": powerModes[mode].color } as CSSProperties}
      aria-label={`${power.name} power, ${status}, ${Math.ceil(remaining / 1000)} seconds remaining`}
      aria-pressed={remaining > 0}
      title={`${power.name}: ${status}`}
      disabled={!isGameFocused() || remaining <= 0}>
      <span className="game-hud__power-fill" aria-hidden="true" style={{ transform: `scaleX(${progress})` }} />
      <span className="game-hud__power-dot-slot" aria-hidden="true"><span className="game-hud__power-dot" /></span>
      <span className="game-hud__power-amount" role="progressbar" aria-label={`${power.name} time remaining`}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}
        aria-valuetext={`${status}, ${Math.ceil(remaining / 1000)} seconds remaining`}>
        {Math.ceil(remaining / 1000)}s
      </span>
    </button>
  );
}
