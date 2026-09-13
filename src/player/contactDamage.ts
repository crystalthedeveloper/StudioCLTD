import { gameNow, isGameFocused } from './gameFocus';
import { isPowerActive } from './temporaryPowers';

export const contactDamageCooldownMs = 1250;

/** One player-wide cooldown prevents simultaneous villains/events stacking hits. */
export function createContactDamageGate() {
  let nextHitAt = 0;
  return {
    reset() { nextHitAt = 0; },
    claim() {
      if (!isGameFocused() || isPowerActive()) return null;
      const now = gameNow();
      if (now < nextHitAt) return null;
      nextHitAt = now + contactDamageCooldownMs;
      return nextHitAt;
    },
  };
}
