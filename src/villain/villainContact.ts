/** Track collider pairs so enter hits immediately and sustained contact retries.
 * Player-wide cooldown/protection is enforced by the health owner.
 */
export function createVillainContact() {
  const colliders = new Set<number>();
  return {
    enter(handle: number, onContact: () => void) { colliders.add(handle); onContact(); },
    exit(handle: number) { colliders.delete(handle); },
    touching() { return colliders.size > 0; },
    update(onContact: () => void) { if (colliders.size) onContact(); },
  };
}
