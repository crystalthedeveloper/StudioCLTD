let touchControlsActive = false;

export function setTouchCameraInputBlocked(active: boolean) {
  touchControlsActive = active;
}

export function isTouchControlsCameraInputBlocked() {
  return touchControlsActive;
}
