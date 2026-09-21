import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { powerModes } from "../player/temporaryPowers";

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
                <li>Explore the world and collect Wind, Shock, and Fire smoke.</li>
                <li>Each Power activates immediately, makes you move faster, and lets you defeat villains on contact.</li>
                <li>Defeat all 8 villains to complete the game.</li>
                <li>Collect $ symbols to increase your cash.</li>
                <li>Collect hearts to restore health.</li>
              </ul>}
              {index === 1 && <dl className="game-guide__controls">
                <div><dt>WASD / Arrow Keys</dt><dd>Move; any active Power automatically makes you faster</dd></div>
                <div><dt>On-screen arrows</dt><dd>Use the same movement controls on touch screens</dd></div>
                <div><dt>Spacebar / Jump</dt><dd>With any Power active, jump from the ground; steer while airborne</dd></div>
                <div><dt>ESC</dt><dd>Pause</dd></div>
              </dl>}
              {index === 2 && <>
                <ul className="game-guide__icon-grid">
                  <Item image={<span className="game-guide__power-dot" style={{ backgroundColor: powerModes.standard.color }} aria-hidden="true" />}><strong>Wind</strong>Green smoke — 6 seconds of Power and faster movement</Item>
                  <Item image={<span className="game-guide__power-dot" style={{ backgroundColor: powerModes.rapid.color }} aria-hidden="true" />}><strong>Shock</strong>Gold smoke — 10 seconds of Power and faster movement</Item>
                  <Item image={<span className="game-guide__power-dot" style={{ backgroundColor: powerModes.power.color }} aria-hidden="true" />}><strong>Fire</strong>Red smoke — 15 seconds of Power, faster movement, and the strongest contact impact</Item>
                </ul>
                <ul className="game-guide__notes">
                  <li>All three Powers grant powered jumps and contact attacks. Their timers are stacked at the top right.</li>
                  <li>Powers can run together with independent timers and separate coloured smoke wisps.</li>
                  <li>Faster movement does not stack: it continues until the last active Power expires, then normal movement returns.</li>
                  <li>Collecting smoke activates that power immediately.</li>
                  <li>Collecting the same power restarts only its timer.</li>
                </ul>
              </>}
              {index === 3 && <ul className="game-guide__icon-grid">
                <Item image={icon("/images/pickups/dollar.svg")}><strong>Green $</strong>Cash</Item>
                <Item image={icon("/images/pickups/heart.svg")}><strong>Red heart</strong>Health</Item>
                <Item image={<span className="game-guide__power-dot" style={{ backgroundColor: powerModes.standard.color }} aria-hidden="true" />}><strong>Green smoke</strong>Wind Power + faster movement</Item>
                <Item image={<span className="game-guide__power-dot" style={{ backgroundColor: powerModes.rapid.color }} aria-hidden="true" />}><strong>Gold smoke</strong>Shock Power + faster movement</Item>
                <Item image={<span className="game-guide__power-dot" style={{ backgroundColor: powerModes.power.color }} aria-hidden="true" />}><strong>Red smoke</strong>Fire Power + faster movement</Item>
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
