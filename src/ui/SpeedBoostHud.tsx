import { useSpeedBoostRemainingSeconds } from "../player/speedBoost";

export function SpeedBoostHud() {
  const remainingSeconds = useSpeedBoostRemainingSeconds();

  if (remainingSeconds <= 0) return null;

  return <div className="speed-boost-hud">{`Speed Boost: ${remainingSeconds}s`}</div>;
}
