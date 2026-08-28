import { getActiveGameAudioState } from "../player/footsteps";

const activeSources = new Set<AudioScheduledSourceNode>();

function trackSource(source: AudioScheduledSourceNode) {
  activeSources.add(source);
  source.addEventListener("ended", () => activeSources.delete(source), { once: true });
}

function stopPreviousBlast() {
  activeSources.forEach((source) => {
    try {
      source.stop();
    } catch {
      // The source may already have completed between scheduling and cleanup.
    }
  });
  activeSources.clear();
}

export function playEnergyBlastSound() {
  const state = getActiveGameAudioState();
  if (!state) return;

  stopPreviousBlast();
  const { context, masterGain, noise } = state;
  const now = context.currentTime;

  const output = context.createGain();
  output.gain.setValueAtTime(0.0001, now);
  output.gain.exponentialRampToValueAtTime(0.095, now + 0.012);
  output.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
  output.connect(masterGain);

  const bass = context.createOscillator();
  const bassFilter = context.createBiquadFilter();
  bass.type = "sawtooth";
  bass.frequency.setValueAtTime(190, now);
  bass.frequency.exponentialRampToValueAtTime(52, now + 0.3);
  bassFilter.type = "lowpass";
  bassFilter.frequency.setValueAtTime(720, now);
  bassFilter.frequency.exponentialRampToValueAtTime(170, now + 0.3);
  bass.connect(bassFilter);
  bassFilter.connect(output);
  trackSource(bass);
  bass.start(now);
  bass.stop(now + 0.32);

  const energy = context.createOscillator();
  const energyGain = context.createGain();
  energy.type = "triangle";
  energy.frequency.setValueAtTime(680, now);
  energy.frequency.exponentialRampToValueAtTime(135, now + 0.2);
  energyGain.gain.setValueAtTime(0.42, now);
  energyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.23);
  energy.connect(energyGain);
  energyGain.connect(output);
  trackSource(energy);
  energy.start(now);
  energy.stop(now + 0.24);

  const burst = context.createBufferSource();
  const burstFilter = context.createBiquadFilter();
  const burstGain = context.createGain();
  burst.buffer = noise;
  burst.playbackRate.value = 0.58;
  burstFilter.type = "bandpass";
  burstFilter.frequency.value = 460;
  burstFilter.Q.value = 0.65;
  burstGain.gain.setValueAtTime(0.52, now);
  burstGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
  burst.connect(burstFilter);
  burstFilter.connect(burstGain);
  burstGain.connect(output);
  trackSource(burst);
  burst.start(now);
}
