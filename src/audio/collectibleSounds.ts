import type { GameAudioState } from "../player/footsteps";
import { getActiveGameAudioState } from "../player/footsteps";

export type CollectibleSound = "coin" | "speed" | "penalty" | "contact" | "health";

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
  oscillator.start(start);
  oscillator.stop(end + 0.01);
}

export function playCollectibleSound(sound: CollectibleSound) {
  const state = getActiveGameAudioState();
  if (!state) return;

  if (sound === "coin") {
    playTone(state, { type: "sine", startFrequency: 720, endFrequency: 980, duration: 0.16, gain: 0.034 });
    playTone(state, { type: "sine", startFrequency: 1020, endFrequency: 1320, duration: 0.13, gain: 0.024, delay: 0.065 });
    return;
  }

  if (sound === "speed") {
    playTone(state, { type: "triangle", startFrequency: 230, endFrequency: 920, duration: 0.32, gain: 0.032 });
    playTone(state, { type: "sine", startFrequency: 480, endFrequency: 1180, duration: 0.27, gain: 0.022, delay: 0.035 });
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

  playTone(state, { type: "sine", startFrequency: 420, endFrequency: 880, duration: 0.42, gain: 0.027 });
  playTone(state, { type: "sine", startFrequency: 650, endFrequency: 1320, duration: 0.34, gain: 0.021, delay: 0.075 });
}
