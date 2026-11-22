export type RunScore = {
  level: number;
  villains: number;
  cash: number;
  survivalSeconds: number;
};

export function villainsRequired(level: number) {
  return Math.min(24, 8 + Math.max(0, level - 1) * 2);
}

export function villainDifficulty(level: number) {
  return {
    speed: 1 + Math.min(0.55, Math.max(0, level - 1) * 0.045),
    spawnDelay: Math.max(1800, 6500 - Math.max(0, level - 1) * 360),
  };
}

const bestKey = "studioCLTD.personalBest";

export function readPersonalBest(): RunScore | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(bestKey) ?? "null");
    return parsed && typeof parsed.level === "number" ? parsed : null;
  } catch {
    return null;
  }
}

export function savePersonalBest(score: RunScore) {
  try {
    const current = readPersonalBest();
    const better = !current || score.level > current.level || (score.level === current.level && score.villains > current.villains);
    if (better) localStorage.setItem(bestKey, JSON.stringify(score));
    return better;
  } catch {
    return false;
  }
}
