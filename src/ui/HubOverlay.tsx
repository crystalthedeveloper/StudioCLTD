import { useEffect, useMemo, useRef, useState } from "react";
import { hubSections } from "../world/hubSections";
import { playerWorldState } from "../world/playerWorldState";

const enableMinimap = import.meta.env.VITE_ENABLE_MINIMAP === "true";

export function HubOverlay() {
  const [playerPoint, setPlayerPoint] = useState({ x: 50, y: 50 });
  const playerPointRef = useRef(playerPoint);
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
    if (!enableMinimap) return undefined;

    const interval = window.setInterval(() => {
      const nextPoint = {
        x: 50 + (playerWorldState.position.x / 62) * 38,
        y: 50 + (playerWorldState.position.z / 62) * 38,
      };
      const deltaX = Math.abs(nextPoint.x - playerPointRef.current.x);
      const deltaY = Math.abs(nextPoint.y - playerPointRef.current.y);
      if (deltaX < 0.2 && deltaY < 0.2) return;

      playerPointRef.current = nextPoint;
      setPlayerPoint(nextPoint);
    }, 180);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <>
      {enableMinimap && (
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
      )}
    </>
  );
}
