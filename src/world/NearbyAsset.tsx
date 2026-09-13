import { Suspense, useRef, useState, type ReactNode } from 'react';
import { useGameFrame } from '../player/useGameFrame';
import { playerWorldState } from './playerWorldState';
import { isCompactVisualBudget } from './visualQuality';

/** Load ahead of interaction, then retain state across departures and revisits.
 * Physics floors/ramps stay mounted independently, including teleport landings.
 */
export function NearbyAsset({ position, children }: { position: readonly number[]; children: ReactNode }) {
  const [loaded, setLoaded] = useState(() => !isCompactVisualBudget()
    || Math.hypot(position[0] - playerWorldState.position.x, position[2] - playerWorldState.position.z) < 36);
  const previousCheck = useRef(-Infinity);
  useGameFrame(({ clock }) => {
    if (loaded || clock.elapsedTime - previousCheck.current < 0.1) return;
    previousCheck.current = clock.elapsedTime;
    if (Math.hypot(position[0] - playerWorldState.position.x, position[2] - playerWorldState.position.z) < 65) setLoaded(true);
  });
  return loaded ? <Suspense fallback={null}>{children}</Suspense> : null;
}
