export type WorldPoint = {
  position: [number, number, number];
  scale: number;
  rotation: number;
  variant: number;
};

export function seededRandom(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;

  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

export function scatterPoints(count: number, radius: number, seed: number, centerClearance = 12): WorldPoint[] {
  const random = seededRandom(seed);
  const points: WorldPoint[] = [];

  while (points.length < count) {
    const angle = random() * Math.PI * 2;
    const distance = centerClearance + random() * radius;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;

    points.push({
      position: [x, 0, z],
      scale: 0.65 + random() * 1.75,
      rotation: random() * Math.PI * 2,
      variant: Math.floor(random() * 4),
    });
  }

  return points;
}
