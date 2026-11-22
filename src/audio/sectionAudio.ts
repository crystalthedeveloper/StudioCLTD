let stopActiveSectionAudio: (() => void) | null = null;

export function beginSectionAudio(stopCurrent: () => void) {
  stopActiveSectionAudio?.();
  stopActiveSectionAudio = stopCurrent;
}

export function stopSectionAudio() {
  stopActiveSectionAudio?.();
  stopActiveSectionAudio = null;
}
