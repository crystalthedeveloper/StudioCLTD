import type { GameAudioState } from "../player/footsteps";
import { getActiveGameAudioState, trackGameOscillator } from "../player/footsteps";
import { isGameAudioEnabled, isGameAudioLocked } from "./gameAudio";
import { playGameMedia, registerGameMedia, stopGameMedia, stopAllGameMedia } from "./gameMedia";
import { stopAllGameWebAudio } from "../player/footsteps";
import { beginSectionAudio } from "./sectionAudio";

const powerPickupAudio = typeof Audio === "undefined" ? null : new Audio("/audio/power.mp3");
const playerDeathAudio = typeof Audio === "undefined" ? null : new Audio("/audio/die.mp3");
const generalFixedAudio = typeof Audio === "undefined" ? null : new Audio("/audio/fixed.mp3");
const playerFixedAudio = typeof Audio === "undefined" ? null : new Audio("/audio/player-fixed.mp3");
if (powerPickupAudio) {
  powerPickupAudio.preload = "auto";
  powerPickupAudio.volume = 0.72;
  powerPickupAudio.muted = !isGameAudioEnabled();
  powerPickupAudio.load();
  registerGameMedia(powerPickupAudio);
}
if (playerDeathAudio) {
  playerDeathAudio.preload = "auto";
  playerDeathAudio.volume = 0.78;
  playerDeathAudio.muted = !isGameAudioEnabled();
  playerDeathAudio.load();
  registerGameMedia(playerDeathAudio);
}
if (generalFixedAudio) {
  generalFixedAudio.preload = "auto";
  generalFixedAudio.volume = 0.72;
  generalFixedAudio.muted = !isGameAudioEnabled();
  generalFixedAudio.load();
  registerGameMedia(generalFixedAudio);
}
if (playerFixedAudio) {
  playerFixedAudio.preload = "auto";
  playerFixedAudio.volume = 0.72;
  playerFixedAudio.muted = !isGameAudioEnabled();
  playerFixedAudio.load();
  registerGameMedia(playerFixedAudio);
}

export function playSectionFixedSound() {
  if (!playerFixedAudio || isGameAudioLocked()) return;
  if (generalFixedAudio) stopGameMedia(generalFixedAudio);
  stopGameMedia(playerFixedAudio);
  playerFixedAudio.currentTime = 0;
  playerFixedAudio.muted = !isGameAudioEnabled();
  beginSectionAudio(() => stopGameMedia(playerFixedAudio));
  void playGameMedia(playerFixedAudio);
}

export function playGeneralFixedSound() {
  if (!generalFixedAudio || isGameAudioLocked()) return;
  if (playerFixedAudio) stopGameMedia(playerFixedAudio);
  stopGameMedia(generalFixedAudio);
  generalFixedAudio.currentTime = 0;
  generalFixedAudio.muted = !isGameAudioEnabled();
  beginSectionAudio(() => stopGameMedia(generalFixedAudio));
  void playGameMedia(generalFixedAudio);
}

export function playPlayerDeathSound() {
  if (!playerDeathAudio) return;
  stopAllGameMedia();
  stopAllGameWebAudio();
  stopGameMedia(playerDeathAudio);
  playerDeathAudio.currentTime = 0;
  playerDeathAudio.muted = !isGameAudioEnabled();
  // The death sound is the only media explicitly allowed through the lock.
  playerDeathAudio.play().catch(() => undefined);
}

export type CollectibleSound = "power" | "coin" | "penalty" | "contact" | "health" | "damage" | "splat";

type ToneOptions = {
  delay?: number;
  duration: number;
  endFrequency: number;
  gain: number;
  startFrequency: number;
  type: OscillatorType;
};

function playTone({ context, masterGain }: GameAudioState, options: ToneOptions) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = context.currentTime + (options.delay ?? 0);
  const end = start + options.duration;

  oscillator.type = options.type;
  oscillator.frequency.setValueAtTime(options.startFrequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, end);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(options.gain, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  oscillator.connect(gain);
  gain.connect(masterGain);
  trackGameOscillator(oscillator);
  oscillator.start(start);
  oscillator.stop(end + 0.01);
}

export function playCollectibleSound(sound: CollectibleSound) {
  if (isGameAudioLocked()) return;
  const state = getActiveGameAudioState();
  if (!state) return;

  if (sound === "power") {
    if (powerPickupAudio) {
      stopGameMedia(powerPickupAudio);
      powerPickupAudio.currentTime = 0;
      powerPickupAudio.muted = !isGameAudioEnabled();
      void playGameMedia(powerPickupAudio);
    }
    return;
  }

  if (sound === "coin") {
    playTone(state, { type: "sine", startFrequency: 720, endFrequency: 980, duration: 0.16, gain: 0.034 });
    playTone(state, { type: "sine", startFrequency: 1020, endFrequency: 1320, duration: 0.13, gain: 0.024, delay: 0.065 });
    return;
  }

  if (sound === "penalty") {
    playTone(state, { type: "sawtooth", startFrequency: 165, endFrequency: 105, duration: 0.24, gain: 0.018 });
    playTone(state, { type: "square", startFrequency: 92, endFrequency: 72, duration: 0.18, gain: 0.009, delay: 0.025 });
    return;
  }

  if (sound === "health") {
    playTone(state, { type: "sine", startFrequency: 520, endFrequency: 760, duration: 0.22, gain: 0.027 });
    playTone(state, { type: "sine", startFrequency: 690, endFrequency: 1040, duration: 0.2, gain: 0.021, delay: 0.08 });
    return;
  }

  if (sound === "damage") {
    playTone(state, { type: "sawtooth", startFrequency: 150, endFrequency: 72, duration: 0.16, gain: 0.026 });
    playTone(state, { type: "triangle", startFrequency: 92, endFrequency: 58, duration: 0.12, gain: 0.014, delay: 0.025 });
    return;
  }

  if (sound === "splat") {
    playTone(state, { type: "sawtooth", startFrequency: 118, endFrequency: 46, duration: 0.14, gain: 0.034 });
    playTone(state, { type: "triangle", startFrequency: 260, endFrequency: 82, duration: 0.09, gain: 0.018, delay: 0.012 });
    return;
  }

  playTone(state, { type: "sine", startFrequency: 420, endFrequency: 880, duration: 0.42, gain: 0.027 });
  playTone(state, { type: "sine", startFrequency: 650, endFrequency: 1320, duration: 0.34, gain: 0.021, delay: 0.075 });
}
