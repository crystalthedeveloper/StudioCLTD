import { isGameFocused, subscribeGameFocus } from "./gameFocus";
import { isGameAudioEnabled, subscribeGameAudio } from "../audio/gameAudio";

export type GameAudioState = {
  context: AudioContext;
  masterGain: GainNode;
  noise: AudioBuffer;
};

let audioState: GameAudioState | null = null;
let unlockInstalled = false;

function createAudioState() {
  if (audioState || typeof window === "undefined") return audioState;
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return null;

  const context = new AudioContextClass();
  const masterGain = context.createGain();
  masterGain.gain.value = isGameAudioEnabled() ? 1 : 0;
  masterGain.connect(context.destination);
  const noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.075), context.sampleRate);
  const samples = noise.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) {
    const envelope = 1 - index / samples.length;
    samples[index] = (Math.random() * 2 - 1) * envelope * envelope;
  }
  audioState = { context, masterGain, noise };
  const syncPlayback = () => {
    if (isGameFocused()) void context.resume().catch(() => undefined);
    else void context.suspend().catch(() => undefined);
  };
  subscribeGameFocus(syncPlayback);
  syncPlayback();
  subscribeGameAudio(() => {
    if (!audioState) return;
    audioState.masterGain.gain.setValueAtTime(
      isGameAudioEnabled() ? 1 : 0,
      audioState.context.currentTime,
    );
  });
  return audioState;
}

export function installFootstepAudioUnlock() {
  if (unlockInstalled || typeof window === "undefined") return () => undefined;
  unlockInstalled = true;

  const unlock = () => {
    const state = createAudioState();
    if (isGameFocused() && state?.context.state === "suspended") void state.context.resume();
  };

  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("touchstart", unlock, { passive: true });
  window.addEventListener("keydown", unlock);

  return () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("touchstart", unlock);
    window.removeEventListener("keydown", unlock);
    unlockInstalled = false;
  };
}

export function getActiveGameAudioState() {
  const state = audioState;
  if (!isGameFocused() || !state || state.context.state !== "running" || !isGameAudioEnabled()) return null;
  return state;
}
