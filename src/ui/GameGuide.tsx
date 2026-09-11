import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { powerIcons } from "../player/powerIcons";

const sections = ["How to Play", "Controls", "Powers", "World Pickups"] as const;
const icon = (src: string) => <img src={src} alt="" aria-hidden="true" />;
const logo = (color: string) => <span className="game-guide__logo-icon" style={{ backgroundColor: color }} aria-hidden="true" />;
function Item({ image, children }: { image: ReactNode; children: ReactNode }) {
  return <li className="game-guide__icon-row">{image}<span>{children}</span></li>;
}

export function GameGuide({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState<string | null>("How to Play");
  const panel = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    close.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
      }
      if (event.key === "Tab") {
        const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && (document.activeElement === first || !panel.current?.contains(document.activeElement))) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !panel.current?.contains(document.activeElement))) {
          event.preventDefault(); first?.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKey, true);
    return () => {
      window.removeEventListener("keydown", handleKey, true);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [onClose]);
  return createPortal(
    <div className="game-guide" role="dialog" aria-modal="true" aria-labelledby="game-guide-title">
      <button className="studio-button studio-button--backdrop game-guide__backdrop" type="button" tabIndex={-1} aria-label="Close game guide" onClick={onClose} />
      <section className="game-guide__panel" ref={panel}>
        <header className="game-guide__header">
          <h2 id="game-guide-title">Game Guide</h2>
          <button ref={close} className="studio-button game-guide__close" type="button" aria-label="Close game guide" onClick={onClose}>×</button>
        </header>
        <div className="game-guide__sections">
          {sections.map((section, index) => <section key={section} className="game-guide__section">
            <h3><button className="studio-button game-guide__toggle" type="button"
              aria-expanded={open === section} aria-controls={`guide-section-${index}`} id={`guide-toggle-${index}`}
              onClick={() => setOpen(current => current === section ? null : section)}>
              {section}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </button></h3>
            <div id={`guide-section-${index}`} role="region" aria-labelledby={`guide-toggle-${index}`} hidden={open !== section} className="game-guide__body">
              {index === 0 && <ul className="game-guide__steps">
                <li>Explore the world and collect powers.</li>
                <li>Activate a power before touching a villain.</li>
                <li>Defeat all 8 villains to complete the game.</li>
                <li>Collect $ symbols to increase your score.</li>
                <li>Collect hearts to restore health.</li>
              </ul>}
              {index === 1 && <dl className="game-guide__controls">
                <div><dt>WASD / Arrow Keys</dt><dd>Move</dd></div>
                <div><dt>On-screen arrows</dt><dd>Move</dd></div>
                <div><dt>G / Power icons</dt><dd>Select a collected power</dd></div>
                <div><dt>Spacebar / Fix</dt><dd>Activate or resume the selected power</dd></div>
                <div><dt>ESC</dt><dd>Pause</dd></div>
              </dl>}
              {index === 2 && <>
                <ul className="game-guide__icon-grid">
                  <Item image={icon(powerIcons.standard.worldSrc)}><strong>Wind</strong>6 seconds</Item>
                  <Item image={icon(powerIcons.rapid.worldSrc)}><strong>Lightning</strong>10 seconds and increased speed</Item>
                  <Item image={icon(powerIcons.power.worldSrc)}><strong>Fire</strong>15 seconds and strongest contact impact</Item>
                </ul>
                <ul className="game-guide__notes">
                  <li>Only one power can be active at a time.</li>
                  <li>Switching powers pauses and saves the previous power’s remaining time.</li>
                  <li>Collecting the same power refills it completely.</li>
                </ul>
              </>}
              {index === 3 && <ul className="game-guide__icon-grid">
                <Item image={icon("/images/pickups/dollar.svg")}><strong>Green $</strong>Score</Item>
                <Item image={icon("/images/pickups/heart.svg")}><strong>Red heart</strong>Health</Item>
                <Item image={logo("#facc15")}><strong>Yellow Logo</strong>Speed Boost</Item>
                <Item image={logo("#991b1b")}><strong>Red symbol</strong>Penalty</Item>
                <Item image={logo("#a855f7")}><strong>Purple symbol</strong>Share</Item>
                <Item image={logo("#dedede")}><strong>White logo</strong>Decorative</Item>
              </ul>}
            </div>
          </section>)}
        </div>
      </section>
    </div>, document.body,
  );
}
