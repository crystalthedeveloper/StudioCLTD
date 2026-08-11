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
    if (state?.context.state === "suspended") void state.context.resume();
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

export function playConcreteFootstep(variation: number) {
  const state = getActiveGameAudioState();
  if (!state) return;

  const source = state.context.createBufferSource();
  const filter = state.context.createBiquadFilter();
  const gain = state.context.createGain();
  const now = state.context.currentTime;

  source.buffer = state.noise;
  source.playbackRate.value = 0.88 + variation * 0.14;
  filter.type = "bandpass";
  filter.frequency.value = 260 + variation * 90;
  filter.Q.value = 0.72;
  gain.gain.setValueAtTime(0.022, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(state.masterGain);
  source.start(now);
  source.stop(now + 0.08);
}

export function getActiveGameAudioState() {
  const state = audioState;
  if (!state || state.context.state !== "running" || !isGameAudioEnabled()) return null;
  return state;
}
