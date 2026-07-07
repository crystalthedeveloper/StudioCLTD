let trackpadActive = false;

export function setTrackpadCameraInputBlocked(active: boolean) {
  trackpadActive = active;
}

export function isTrackpadCameraInputBlocked() {
  return trackpadActive;
}
