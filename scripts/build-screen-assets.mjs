import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import sharp from 'sharp';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function writeChanged(path, contents) {
  const previous = await readFile(path).catch(() => null);
  if (!previous || !previous.equals(Buffer.from(contents))) await writeFile(path, contents);
}

// The screen configuration is the single source of truth for both device sizes.
export async function buildScreenAssets(root = projectRoot) {
  const config = await readFile(resolve(root, 'src/world/systems/HubSections.tsx'), 'utf8');
  const sources = [...new Set(config.match(/\/images\/optimized\/[\w/.-]+\.(?:webp|jpg|png)/g))].sort();
  if (!sources.length) throw new Error('No screen image sources found');
  const directory = resolve(root, 'public/images/screens');
  await mkdir(directory, { recursive: true });
  const manifest = {};
  const live = new Set();
  for (const source of sources) {
    const bytes = await readFile(resolve(root, `public${source}`));
    const entry = { sourceHash: digest(bytes) };
    for (const [device, limit, quality] of [['mobile', 768, 82], ['desktop', 1536, 88]]) {
      const { data, info } = await sharp(bytes).rotate()
        .resize({ width: limit, height: limit, fit: 'inside', withoutEnlargement: true })
        .webp({ quality, effort: 5 }).toBuffer({ resolveWithObject: true });
      // Source hash also invalidates a derivative when a subtle edit encodes identically.
      const version = digest(Buffer.concat([bytes, data])).slice(0, 16);
      const slug = source.replace('/images/optimized/', '').replace(/\.[^.]+$/, '').replaceAll('/', '-');
      const file = `${slug}-${device}.${version}.webp`;
      live.add(file);
      await writeChanged(resolve(directory, file), data);
      entry[device] = { url: `/images/screens/${file}`, width: info.width, height: info.height, bytes: info.size };
    }
    manifest[source] = entry;
  }
  await writeChanged(resolve(root, 'src/world/screen-assets.json'), JSON.stringify(manifest, null, 2) + '\n');
  for (const file of await readdir(directory)) {
    if (/\.[a-f0-9]{16}\.webp$/.test(file) && !live.has(file)) await unlink(resolve(directory, file));
  }
  return manifest;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = await buildScreenAssets();
  console.log(`Generated ${Object.keys(manifest).length} current screen images in two hashed WebP sizes.`);
}
