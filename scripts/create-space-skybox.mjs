import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const width = 8192;
const height = 4096;

function crc32(buffer) {
  let crc = ~0;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const name = Buffer.from(type);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([length, name, data, checksum]);
}

function seededRandom(seed) {
  let value = seed % 2147483647;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

const random = seededRandom(20260707);
const nebulae = Array.from({ length: 15 }, (_, index) => ({
  x: random(),
  y: 0.18 + random() * 0.52,
  radius: 0.055 + random() * 0.12,
  color:
    index % 3 === 0
      ? [111, 66, 196]
      : index % 3 === 1
        ? [35, 126, 211]
        : [219, 84, 55],
  strength: 0.12 + random() * 0.26,
}));

const stars = Array.from({ length: 26000 }, () => ({
  x: Math.floor(random() * width),
  y: Math.floor(random() * height),
  size: random() > 0.985 ? 2 : 1,
  intensity: 95 + random() * 160,
  tint: random(),
}));

const rows = [];
const starMap = new Map();
for (const star of stars) {
  const key = `${star.x}:${star.y}`;
  starMap.set(key, star);
}

for (let y = 0; y < height; y += 1) {
  const row = Buffer.alloc(1 + width * 3);
  row[0] = 0;
  const v = y / height;

  for (let x = 0; x < width; x += 1) {
    const u = x / width;
    let r = 2 + 8 * (1 - Math.abs(v - 0.5));
    let g = 4 + 7 * (1 - Math.abs(v - 0.48));
    let b = 13 + 22 * (1 - Math.abs(v - 0.42));

    for (const nebula of nebulae) {
      const dx = Math.min(Math.abs(u - nebula.x), 1 - Math.abs(u - nebula.x));
      const dy = (v - nebula.y) * 1.8;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const glow = Math.max(0, 1 - distance / nebula.radius) ** 2 * nebula.strength;
      r += nebula.color[0] * glow;
      g += nebula.color[1] * glow;
      b += nebula.color[2] * glow;
    }

    const star = starMap.get(`${x}:${y}`);
    if (star) {
      const warm = star.tint > 0.86;
      const cool = star.tint < 0.18;
      r += star.intensity * (cool ? 0.72 : 1);
      g += star.intensity * (warm ? 0.86 : 1);
      b += star.intensity * (warm ? 0.58 : cool ? 1.15 : 1);

      if (star.size > 1) {
        r += 70;
        g += 70;
        b += 80;
      }
    }

    const index = 1 + x * 3;
    row[index] = clamp(r);
    row[index + 1] = clamp(g);
    row[index + 2] = clamp(b);
  }

  rows.push(row);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(width, 0);
ihdr.writeUInt32BE(height, 4);
ihdr[8] = 8;
ihdr[9] = 2;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(Buffer.concat(rows), { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

writeFileSync("public/images/space_nebula_skybox_8k.png", png);
