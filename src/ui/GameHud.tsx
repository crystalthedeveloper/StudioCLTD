import { PowerMeter } from "./PowerMeter";
import { powerModes, type PowerMode, activateSelectedPower, canActivatePower, getActivePower, getFixCharges, getSelectedPower, getPowerStatus, selectFixPower, subscribePowers, fixPowerRespawnMs } from "../player/temporaryPowers";
import { useGameFocus } from "../player/gameFocus";
import { useSpeedBoostRemainingMs, speedBoostDurationMs } from "../player/speedBoost";
import { setGameAudioEnabled, useGameAudioEnabled } from "../audio/gameAudio";
import { getActiveVillainVoiceId, subscribeVillainVoice } from "../audio/villainAudio";
import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { DirectionControls } from "./DirectionControls";

type GameHudProps = {
  completedSectionCount: number;
  health: number;
  onOpenWebsite: () => void;
  onRestart: () => void;
  points: number;
};

const villainVoiceLabels: Record<string, string> = {
  "quick-fix": "Quick Fix",
  "urgent-fix": "Urgent Fix",
  performance: "Performance",
  "site-improvement": "Site Improvement",
};

export function GameHud({ completedSectionCount, health, onOpenWebsite, onRestart, points }: GameHudProps) {
  const gameFocused = useGameFocus();
  const charges = useSyncExternalStore(subscribePowers, getFixCharges);
  const mode = useSyncExternalStore(subscribePowers, getSelectedPower);
  const activePower = useSyncExternalStore(subscribePowers, getActivePower);
  const activationReady = useSyncExternalStore(subscribePowers, canActivatePower);
  const [guideOpen, setGuideOpen] = useState(false);
  const audioEnabled = useGameAudioEnabled();
  const activeVillainVoiceId = useSyncExternalStore(
    subscribeVillainVoice,
    getActiveVillainVoiceId,
    getActiveVillainVoiceId,
  );
  const activeVillainVoiceLabel = activeVillainVoiceId ? villainVoiceLabels[activeVillainVoiceId] : null;
  const remainingMs = useSpeedBoostRemainingMs();
  const active = remainingMs > 0;
  const progress = active ? Math.min(100, (remainingMs / speedBoostDurationMs) * 100) : 0;

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable)) return;

      const shortcut = event.code === "Digit1" || event.code === "Numpad1" ? 1
        : event.code === "Digit2" || event.code === "Numpad2" ? 2
          : event.code === "Digit3" || event.code === "Numpad3" ? 3
            : event.code === "Digit4" || event.code === "Numpad4" ? 4
              : 0;
      if (!shortcut) return;

      event.preventDefault();
      if (shortcut === 1) {
        setGuideOpen((open) => {
          if (!open) document.exitPointerLock?.();
          return !open;
        });
      } else if (shortcut === 2) {
        setGameAudioEnabled(!audioEnabled);
      } else if (shortcut === 3) {
        onRestart();
      } else {
        onOpenWebsite();
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [audioEnabled, onOpenWebsite, onRestart]);

  useEffect(() => {
    if (!guideOpen) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGuideOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [guideOpen]);

  return (
    <aside className="game-hud" aria-label="Game controls and status">
      <div className="game-hud__left">
        <div className="game-hud__actions">
          <button
            type="button"
            className="studio-button game-hud__guide-button"
            aria-label="Open game guide"
            aria-expanded={guideOpen}
            title="Game Guide"
            onClick={() => {
              document.exitPointerLock?.();
              setGuideOpen(true);
            }}
          >
            <span aria-hidden="true">ⓘ</span>
            <small className="game-hud__shortcut" aria-hidden="true">1</small>
          </button>
          <button
            type="button"
            className={activeVillainVoiceLabel ? "studio-button game-hud__sound-button game-hud__sound-button--speaking" : "studio-button game-hud__sound-button"}
            onClick={() => setGameAudioEnabled(!audioEnabled)}
            aria-label={audioEnabled ? "Mute game audio" : "Enable game audio"}
            aria-pressed={!audioEnabled}
            title={audioEnabled ? "Sound On" : "Sound Off"}
          >
            <span className="game-hud__sound-icon" aria-hidden="true">{audioEnabled ? "🔊" : "🔇"}</span>
            {activeVillainVoiceLabel && <span className="game-hud__sound-label">{activeVillainVoiceLabel}</span>}
            <small className="game-hud__shortcut" aria-hidden="true">2</small>
          </button>
          <button className="studio-button" type="button" onClick={onRestart} aria-label="Restart world" title="Restart">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 11a8 8 0 1 0-2.34 5.66M20 4v7h-7" />
            </svg>
            <small className="game-hud__shortcut" aria-hidden="true">3</small>
          </button>
          <button className="studio-button" type="button" onClick={onOpenWebsite} aria-label="Open My Site" title="My Site">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3c2.4 2.45 3.65 5.45 3.65 9S14.4 18.55 12 21M12 3C9.6 5.45 8.35 8.45 8.35 12S9.6 18.55 12 21" />
            </svg>
            <small className="game-hud__shortcut" aria-hidden="true">4</small>
          </button>
        </div>

        <section className="game-hud__health" aria-label={`${health} of 3 hearts`} aria-live="polite">
          <span className="game-hud__stat-label">Health</span>
          <strong aria-hidden="true">
            {Array.from({ length: 3 }, (_, index) => index < health ? "❤️" : "♡").join(" ")}
          </strong>
        </section>

        <section className="game-hud__stat" aria-label={`${completedSectionCount} of 8 sections complete`} aria-live="polite">
          <span className="game-hud__stat-label">Progress</span>
          <strong>{completedSectionCount >= 8 ? "🏆" : `${completedSectionCount}/8`}</strong>
        </section>

        <section className="game-hud__stat game-hud__stat--points" aria-label={`${points} points`} aria-live="polite">
          <span className="game-hud__stat-label">Score</span>
          <strong>{points}</strong>
        </section>

        <div className="game-hud__speed-meter">
          <span>Speed</span>
          <div className="game-hud__meter-track game-hud__meter-track--speed" role="progressbar" aria-label="Speed boost time remaining" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
            <i style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="game-hud__powers" role="group" aria-label="Temporary powers. G selects; Space or Fix activates.">
        {(Object.keys(powerModes) as PowerMode[]).map((weapon) => (
          <button key={weapon} type="button" className="studio-button game-hud__power"
            style={{ "--power-color": powerModes[weapon].color } as CSSProperties}
            disabled={!gameFocused || !charges[weapon]}
            aria-pressed={mode === weapon && charges[weapon]}
            data-active={activePower === weapon}
            aria-label={`Power ${powerModes[weapon].label} ${powerModes[weapon].name}, ${getPowerStatus(weapon)}`}
            onClick={() => selectFixPower(weapon)}>
            <strong>{powerModes[weapon].label}</strong>
            <span>{getPowerStatus(weapon)}</span>
            <small className="game-hud__power-shortcut" aria-hidden="true">G</small>
          </button>
        ))}
        <PowerMeter />
      </div>

      {gameFocused && <div className="game-hud__bottom">
        <DirectionControls />
        <button
          type="button"
          className="studio-button game-hud__fix"
          aria-label="Activate selected power"
          title={activePower ? "Power active — collect a matching pickup to refill" : "Activate selected power (Space)"}
          disabled={!activationReady}
          onClick={activateSelectedPower}
        >
          <span aria-hidden="true">⚡</span>
          <small>FIX</small>
        </button>
      </div>}

      {guideOpen && createPortal(
        <div className="game-guide" role="dialog" aria-modal="true" aria-labelledby="game-guide-title">
          <button className="studio-button studio-button--backdrop game-guide__backdrop" type="button" aria-label="Close game guide" onClick={() => setGuideOpen(false)} />
          <section className="game-guide__panel">
            <button className="studio-button game-guide__close" type="button" aria-label="Close game guide" onClick={() => setGuideOpen(false)}>×</button>
            <h2 id="game-guide-title">Game Guide</h2>
            <h3>Controls</h3>
            <dl>
              <div><dt>WASD / Arrow Keys</dt><dd>Move</dd></div>
              <div><dt>On-screen Arrows</dt><dd>Move</dd></div>
              <div><dt>G / Power boxes</dt><dd>Select a collected power</dd></div>
              <div><dt>Space / ⚡ Fix</dt><dd>Activate selected power</dd></div>
            </dl>
            <p className="game-guide__tip">Collect one of each power: 01 Blue lasts 6 seconds, 02 Yellow lasts 10 seconds and increases speed, and 03 Red lasts 15 seconds with the strongest contact impact. G or a power box selects; Space or ⚡ Fix consumes the selected charge and starts its aura and POWER timer. Touch villains to defeat them without taking contact damage while powered. Collecting the active power again immediately refills its timer. Only one power can be active at a time. At zero, the aura and power end. The timer pauses with the game. Pickups return after {fixPowerRespawnMs / 1000} seconds.</p>
            <h3>Logo Guide</h3>
            <ul className="game-guide__logos">
              <li><span>🟢</span> Green — Coin / Score</li>
              <li><span>🟡</span> Yellow — Speed Boost</li>
              <li><span>🔴</span> Red — Penalty</li>
              <li><span>🔵</span> Blue — Contact</li>
              <li><span>🟣</span> Purple — Share</li>
              <li><span>⚪</span> White — Decorative</li>
              <li><span>⚫</span> Black — Health</li>
            </ul>
          </section>
        </div>,
        document.body,
      )}
    </aside>
  );
}
