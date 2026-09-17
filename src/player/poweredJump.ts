// Jump launch lock is independent of power timers and contact damage.
let controller: { launch: () => boolean; airborne: () => boolean } | null = null;
let launched = false;
export function registerPoweredJump(next: NonNullable<typeof controller>) {
  controller = next;
  return () => { if (controller === next) { controller = null; resetPoweredJump(); } };
}
export function resetPoweredJump() { launched = false; }
export function requestPoweredJump() {
  if (launched || !controller?.launch()) return false;
  launched = true;
  return true;
}
