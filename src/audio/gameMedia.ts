import { isGameFocused, subscribeGameFocus } from "../player/gameFocus";
import { isGameAudioLocked } from "./gameAudio";

const media = new Set<HTMLMediaElement>();
const resumeOnPlay = new Set<HTMLMediaElement>();

export function registerGameMedia(element: HTMLMediaElement) {
  media.add(element);
  element.addEventListener("ended", () => resumeOnPlay.delete(element));
  element.addEventListener("play", () => {
    if (!isGameFocused()) {
      resumeOnPlay.add(element);
      element.pause();
    }
  });
}

export function playGameMedia(element: HTMLMediaElement): Promise<boolean> {
  if (isGameAudioLocked()) {
    stopGameMedia(element);
    return Promise.resolve(false);
  }
  resumeOnPlay.add(element);
  if (!isGameFocused()) return Promise.resolve(true);
  return element.play().then(() => {
    if (!isGameFocused()) element.pause();
    return true;
  }).catch(() => { resumeOnPlay.delete(element); return false; });
}

export function stopGameMedia(element: HTMLMediaElement) {
  resumeOnPlay.delete(element);
  element.pause();
  try { element.currentTime = 0; } catch { /* media may not be seekable yet */ }
}

export function stopAllGameMedia() {
  resumeOnPlay.clear();
  media.forEach((element) => {
    element.pause();
    try { element.currentTime = 0; } catch { /* media may not be seekable yet */ }
  });
}

subscribeGameFocus((running) => {
  if (running) {
    if (isGameAudioLocked()) return;
    resumeOnPlay.forEach((element) => { void playGameMedia(element); });
  } else {
    media.forEach((element) => {
      if (!element.paused && !element.ended) resumeOnPlay.add(element);
      element.pause();
    });
  }
});
