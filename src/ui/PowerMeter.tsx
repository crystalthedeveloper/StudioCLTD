import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { powerIcons } from "../player/powerIcons";
import { isGameFocused, subscribeGameFocus } from "../player/gameFocus";
import { getActivePower, getSelectedPower, getPowerRemainingMs, powerDurations, powerModes, getPowerStatus, selectFixPower, type PowerMode, subscribePowers } from "../player/temporaryPowers";

/** Update only the meter each animation frame. Pausing stops rendering work as well as game time. */
export function PowerMeter({ mode }: { mode: PowerMode }) {
  const selected = useSyncExternalStore(subscribePowers, getSelectedPower);
  const [remaining, setRemaining] = useState(() => getPowerRemainingMs(mode));
  useEffect(() => {
    let frame: number | undefined;
    const update = () => {
      frame = undefined;
      setRemaining(getPowerRemainingMs(mode));
      if (isGameFocused() && getActivePower() === mode) frame = window.requestAnimationFrame(update);
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
  const icon = powerIcons[mode];
  return (
    <button type="button" className="studio-button game-hud__power-bar"
      style={{ "--power-color": powerModes[mode].color } as CSSProperties}
      aria-label={`${icon.name} power, ${status}, ${Math.ceil(remaining / 1000)} seconds remaining`}
      aria-pressed={selected === mode}
      title={`${icon.name}: ${status} — G switches powers`}
      disabled={!isGameFocused() || remaining <= 0}
      onClick={() => selectFixPower(mode)}>
      <span className="game-hud__power-fill" aria-hidden="true" style={{ transform: `scaleX(${progress})` }} />
      <img className="game-hud__power-icon" src={icon.src} alt="" aria-hidden="true" draggable={false} />
      <span className="game-hud__power-amount" role="progressbar" aria-label={`${icon.name} time remaining`}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}
        aria-valuetext={`${status}, ${Math.ceil(remaining / 1000)} seconds remaining`}>
        {Math.ceil(remaining / 1000)}s
      </span>
    </button>
  );
}
