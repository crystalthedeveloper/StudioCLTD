import { useEffect, useMemo, useState } from "react";
import { hubSections } from "../world/hubSections";
import { playerWorldState } from "../world/playerWorldState";

type HubOverlayProps = {
  activeSection: string | null;
};

export function HubOverlay({ activeSection }: HubOverlayProps) {
  const [playerPoint, setPlayerPoint] = useState({ x: 50, y: 50 });
  const points = useMemo(
    () =>
      hubSections.map((section) => ({
        ...section,
        x: 50 + (section.position[0] / 62) * 38,
        y: 50 + (section.position[2] / 62) * 38,
      })),
    []
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPlayerPoint({
        x: 50 + (playerWorldState.position.x / 62) * 38,
        y: 50 + (playerWorldState.position.z / 62) * 38,
      });
    }, 100);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <>
      <div className="hub-minimap" aria-label="StudioCLTD section minimap">
        <div className="hub-minimap__ring" />
        {points.map((point) => (
          <div
            key={point.id}
            className="hub-minimap__section"
            style={{
              left: `${point.x}%`,
              top: `${point.y}%`,
            }}
            title={point.name}
          >
            <span />
            <small>{point.name}</small>
          </div>
        ))}
        <div
          className="hub-minimap__player"
          style={{
            left: `${playerPoint.x}%`,
            top: `${playerPoint.y}%`,
          }}
        />
      </div>
      <div className={`hub-section-title ${activeSection ? "hub-section-title--visible" : ""}`}>
        {activeSection}
      </div>
    </>
  );
}
