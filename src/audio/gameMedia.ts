import { isGameFocused, subscribeGameFocus } from "../player/gameFocus";

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
}

subscribeGameFocus((running) => {
  if (running) {
    resumeOnPlay.forEach((element) => { void playGameMedia(element); });
  } else {
    media.forEach((element) => {
      if (!element.paused && !element.ended) resumeOnPlay.add(element);
      element.pause();
    });
  }
});
