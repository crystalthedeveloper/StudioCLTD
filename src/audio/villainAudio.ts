import { isGameAudioEnabled, subscribeGameAudio } from "./gameAudio";

const defeatAudioPath = "/audio/defeat.mp3";
const villainVoicePaths: Record<string, string> = {
  performance: "/audio/Performance.mp3",
  "quick-fix": "/audio/Quick-Fix.mp3",
  "site-improvement": "/audio/Site-Improvement.mp3",
  "urgent-fix": "/audio/Urgent-Fix.mp3",
};

const audioElements = new Map<string, HTMLAudioElement>();
let audioSubscriptionInstalled = false;

function getAudio(path: string, volume: number) {
  const cached = audioElements.get(path);
  if (cached) return cached;

  const audio = new Audio(path);
  audio.preload = "auto";
  audio.volume = volume;
  audio.muted = !isGameAudioEnabled();
  audio.load();
  audioElements.set(path, audio);
  return audio;
}

function installAudioSubscription() {
  if (audioSubscriptionInstalled) return;
  audioSubscriptionInstalled = true;
  subscribeGameAudio(() => {
    const muted = !isGameAudioEnabled();
    audioElements.forEach((audio) => {
      audio.muted = muted;
    });
  });
}

function playFromStart(audio: HTMLAudioElement) {
  audio.pause();
  audio.currentTime = 0;
  audio.muted = !isGameAudioEnabled();
  void audio.play().catch(() => {
    // Playback can be rejected until the player's first interaction.
  });
}

function stopAndRewind(audio?: HTMLAudioElement) {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
}

export function preloadVillainAudio() {
  installAudioSubscription();
  getAudio(defeatAudioPath, 0.5);
  Object.values(villainVoicePaths).forEach((path) => getAudio(path, 0.48));
}

export function hasVillainVoice(sectionId: string) {
  return sectionId in villainVoicePaths;
}

export function playVillainVoice(sectionId: string) {
  const path = villainVoicePaths[sectionId];
  if (!path) return;
  installAudioSubscription();
  playFromStart(getAudio(path, 0.48));
}

export function stopVillainVoice(sectionId: string) {
  const path = villainVoicePaths[sectionId];
  if (path) stopAndRewind(audioElements.get(path));
}

export function playVillainDefeatSound() {
  installAudioSubscription();
  playFromStart(getAudio(defeatAudioPath, 0.5));
}

export function stopAllVillainAudio() {
  audioElements.forEach(stopAndRewind);
}
