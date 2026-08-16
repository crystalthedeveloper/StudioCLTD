import { useSpeedBoostRemainingMs, speedBoostDurationMs } from "../player/speedBoost";
import { setGameAudioEnabled, useGameAudioEnabled } from "../audio/gameAudio";

type GameHudProps = {
  completedSectionCount: number;
  onOpenWebsite: () => void;
  onRestart: () => void;
  points: number;
};

export function GameHud({ completedSectionCount, onOpenWebsite, onRestart, points }: GameHudProps) {
  const audioEnabled = useGameAudioEnabled();
  const remainingMs = useSpeedBoostRemainingMs();
  const active = remainingMs > 0;
  const progress = active ? Math.min(100, (remainingMs / speedBoostDurationMs) * 100) : 0;
  const sectionProgress = Math.min(100, (completedSectionCount / 8) * 100);

  return (
    <aside className="game-hud" aria-label="Game controls and status">
      <div className="game-hud__actions">
        <button
          type="button"
          onClick={() => setGameAudioEnabled(!audioEnabled)}
          aria-label={audioEnabled ? "Mute game audio" : "Enable game audio"}
          aria-pressed={!audioEnabled}
          title={audioEnabled ? "Sound On" : "Sound Off"}
        >
          <span className="game-hud__sound-icon" aria-hidden="true">{audioEnabled ? "🔊" : "🔇"}</span>
        </button>
        <button type="button" onClick={onRestart} aria-label="Restart world" title="Restart">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 11a8 8 0 1 0-2.34 5.66M20 4v7h-7" />
          </svg>
        </button>
        <button type="button" onClick={onOpenWebsite} aria-label="Open My Site" title="My Site">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3c2.4 2.45 3.65 5.45 3.65 9S14.4 18.55 12 21M12 3C9.6 5.45 8.35 8.45 8.35 12S9.6 18.55 12 21" />
          </svg>
        </button>
      </div>

      <section className="game-hud__panel game-hud__points" aria-label={`${points} points`} aria-live="polite">
        <strong>{points}</strong>
      </section>

      <section
        className="game-hud__panel game-hud__section-progress"
        aria-label={`${completedSectionCount} of 8 sections complete`}
        aria-live="polite"
      >
        <strong>{completedSectionCount === 8 ? "🏆" : `${completedSectionCount} / 8`}</strong>
      </section>

      <section
        className={`game-hud__panel game-hud__speed${active ? " game-hud__speed--active" : ""}`}
        aria-label={active ? `Speed boost active, ${Math.ceil(remainingMs / 1000)} seconds remaining` : "Speed boost inactive"}
        aria-live="polite"
      >
        <svg className="game-hud__bolt" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m13.5 2-8 12h6L10.5 22l8-12h-6z" />
        </svg>
        <div
          className="game-hud__progress"
          role="progressbar"
          aria-label="Speed boost time remaining"
          aria-valuemin={0}
          aria-valuemax={speedBoostDurationMs}
          aria-valuenow={Math.round(remainingMs)}
        >
          <span style={{ height: `${progress}%` }} />
        </div>
      </section>

      <div className="game-hud__mobile-cluster">
        <div className="game-hud__mobile-points" aria-label={`${points} points`} aria-live="polite">
          {points}
        </div>
        <div
          className={`game-hud__mobile-progress-value${completedSectionCount === 8 ? " game-hud__mobile-progress-value--complete" : ""}`}
          aria-label={`${completedSectionCount} of 8 sections complete`}
          aria-live="polite"
        >
          {completedSectionCount === 8 ? "🏆" : completedSectionCount}
        </div>
        <div className="game-hud__mobile-speed-icon" aria-hidden="true">⚡</div>
        <svg className="game-hud__mobile-arcs" viewBox="0 0 240 180" aria-hidden="true">
          <path className="game-hud__mobile-arc-track" d="M 80 25 A 88 88 0 0 0 48 156" pathLength="100" />
          <path
            className="game-hud__mobile-arc game-hud__mobile-arc--progress"
            d="M 80 25 A 88 88 0 0 0 48 156"
            pathLength="100"
            strokeDasharray={`${sectionProgress} 100`}
          />
          <path className="game-hud__mobile-arc-track game-hud__mobile-arc-track--speed" d="M 160 25 A 88 88 0 0 1 192 156" pathLength="100" />
          <path
            className="game-hud__mobile-arc game-hud__mobile-arc--speed"
            d="M 160 25 A 88 88 0 0 1 192 156"
            pathLength="100"
            strokeDasharray={`${progress} 100`}
          />
        </svg>
      </div>
    </aside>
  );
}
