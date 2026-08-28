import { useSpeedBoostRemainingMs, speedBoostDurationMs } from "../player/speedBoost";
import { setGameAudioEnabled, useGameAudioEnabled } from "../audio/gameAudio";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { DirectionControls } from "./DirectionControls";

type GameHudProps = {
  completedSectionCount: number;
  onOpenWebsite: () => void;
  onRestart: () => void;
  onShoot: () => void;
  points: number;
  shootPressed: boolean;
  setShootPressed: (pressed: boolean) => void;
};

export function GameHud({ completedSectionCount, onOpenWebsite, onRestart, onShoot, points, setShootPressed, shootPressed }: GameHudProps) {
  const [guideOpen, setGuideOpen] = useState(false);
  const audioEnabled = useGameAudioEnabled();
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
            className="game-hud__guide-button"
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
            onClick={() => setGameAudioEnabled(!audioEnabled)}
            aria-label={audioEnabled ? "Mute game audio" : "Enable game audio"}
            aria-pressed={!audioEnabled}
            title={audioEnabled ? "Sound On" : "Sound Off"}
          >
            <span className="game-hud__sound-icon" aria-hidden="true">{audioEnabled ? "🔊" : "🔇"}</span>
            <small className="game-hud__shortcut" aria-hidden="true">2</small>
          </button>
          <button type="button" onClick={onRestart} aria-label="Restart world" title="Restart">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 11a8 8 0 1 0-2.34 5.66M20 4v7h-7" />
            </svg>
            <small className="game-hud__shortcut" aria-hidden="true">3</small>
          </button>
          <button type="button" onClick={onOpenWebsite} aria-label="Open My Site" title="My Site">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3c2.4 2.45 3.65 5.45 3.65 9S14.4 18.55 12 21M12 3C9.6 5.45 8.35 8.45 8.35 12S9.6 18.55 12 21" />
            </svg>
            <small className="game-hud__shortcut" aria-hidden="true">4</small>
          </button>
        </div>

        <section className="game-hud__stat" aria-label={`${completedSectionCount} of 8 sections complete`} aria-live="polite">
          <strong>{`${completedSectionCount}/8`}</strong>
        </section>

        <section className="game-hud__stat game-hud__stat--points" aria-label={`${points} points`} aria-live="polite">
          <strong>{points}</strong>
        </section>
      </div>

      <DirectionControls />

      <div className="game-hud__right">
        <div className="game-hud__speed-meter">
          <span>Speed</span>
          <div className="game-hud__meter-track game-hud__meter-track--speed" role="progressbar" aria-label="Speed boost time remaining" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
            <i style={{ width: `${progress}%` }} />
          </div>
        </div>
        <button
          type="button"
          className={`game-hud__shoot${shootPressed ? " game-hud__shoot--pressed" : ""}`}
          aria-label="Shoot to fix villain"
          aria-pressed={shootPressed}
          title="Shoot / Fix (Space)"
          onPointerDown={(event) => {
            event.preventDefault();
            setShootPressed(true);
            onShoot();
          }}
          onPointerUp={() => setShootPressed(false)}
          onPointerCancel={() => setShootPressed(false)}
          onPointerLeave={() => setShootPressed(false)}
        >
          <span aria-hidden="true">⚡</span>
          <small>FIX</small>
        </button>
      </div>

      {guideOpen && createPortal(
        <div className="game-guide" role="dialog" aria-modal="true" aria-labelledby="game-guide-title">
          <button className="game-guide__backdrop" type="button" aria-label="Close game guide" onClick={() => setGuideOpen(false)} />
          <section className="game-guide__panel">
            <button className="game-guide__close" type="button" aria-label="Close game guide" onClick={() => setGuideOpen(false)}>×</button>
            <h2 id="game-guide-title">Game Guide</h2>
            <h3>Controls</h3>
            <dl>
              <div><dt>WASD / Arrow Keys</dt><dd>Move</dd></div>
              <div><dt>On-screen Arrows</dt><dd>Move</dd></div>
              <div><dt>Space / Shoot button</dt><dd>Shoot/Fix</dd></div>
            </dl>
            <p className="game-guide__tip">Hold two directions together for diagonal movement.</p>
            <h3>Logo Guide</h3>
            <ul className="game-guide__logos">
              <li><span>🟢</span> Green — Coin / Score</li>
              <li><span>🟡</span> Yellow — Speed Boost</li>
              <li><span>🔴</span> Red — Penalty</li>
              <li><span>🔵</span> Blue — Contact</li>
              <li><span>🟣</span> Purple — Share</li>
              <li><span>⚪</span> White — Decorative</li>
              <li><span>⚫</span> Black — Decorative</li>
            </ul>
          </section>
        </div>,
        document.body,
      )}
    </aside>
  );
}
