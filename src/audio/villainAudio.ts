import { isGameAudioEnabled, subscribeGameAudio } from "./gameAudio";

const defeatAudioPath = "/audio/defeat.mp3";
const villainVoicePaths: Record<string, string> = {
  performance: "/audio/Performance.mp3",
  "quick-fix": "/audio/Quick-Fix.mp3",
  "site-improvement": "/audio/Site-Improvement.mp3",
  "urgent-fix": "/audio/Urgent-Fix.mp3",
};

const audioElements = new Map<string, HTMLAudioElement>();
const voiceListenersInstalled = new Set<string>();
const voiceStateListeners = new Set<() => void>();
let activeVillainVoiceId: string | null = null;
let audioSubscriptionInstalled = false;

function setActiveVillainVoiceId(sectionId: string | null) {
  if (activeVillainVoiceId === sectionId) return;
  activeVillainVoiceId = sectionId;
  voiceStateListeners.forEach((listener) => listener());
}

function getVoiceAudio(sectionId: string, path: string) {
  const audio = getAudio(path, 0.48);
  if (voiceListenersInstalled.has(sectionId)) return audio;

  voiceListenersInstalled.add(sectionId);
  audio.addEventListener("play", () => setActiveVillainVoiceId(sectionId));
  audio.addEventListener("pause", () => {
    if (activeVillainVoiceId === sectionId) setActiveVillainVoiceId(null);
  });
  audio.addEventListener("ended", () => {
    if (activeVillainVoiceId === sectionId) setActiveVillainVoiceId(null);
  });
  return audio;
}

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
  Object.entries(villainVoicePaths).forEach(([sectionId, path]) => getVoiceAudio(sectionId, path));
}

export function hasVillainVoice(sectionId: string) {
  return sectionId in villainVoicePaths;
}

export function playVillainVoice(sectionId: string) {
  const path = villainVoicePaths[sectionId];
  if (!path) return;
  installAudioSubscription();
  playFromStart(getVoiceAudio(sectionId, path));
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
  setActiveVillainVoiceId(null);
}

export function getActiveVillainVoiceId() {
  return activeVillainVoiceId;
}

export function subscribeVillainVoice(listener: () => void) {
  voiceStateListeners.add(listener);
  return () => voiceStateListeners.delete(listener);
}
