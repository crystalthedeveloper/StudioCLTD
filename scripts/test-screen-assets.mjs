import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { buildScreenAssets } from './build-screen-assets.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = await buildScreenAssets();
let mobileBytes = 0, desktopBytes = 0;
for (const [source, entry] of Object.entries(manifest)) {
  const bytes = await readFile(`public${source}`);
  assert.equal(hash(bytes), entry.sourceHash);
  for (const [device, limit] of [['mobile', 768], ['desktop', 1536]]) {
    const asset = entry[device];
    const encoded = await readFile(`public${asset.url}`);
    const metadata = await sharp(encoded).metadata();
    assert.equal(metadata.format, 'webp');
    assert(Math.max(metadata.width, metadata.height) <= limit);
    assert(asset.url.includes(hash(Buffer.concat([bytes, encoded])).slice(0, 16)), 'URL hashes current source and output');
  }
  mobileBytes += entry.mobile.bytes; desktopBytes += entry.desktop.bytes;
}
assert(mobileBytes < desktopBytes);
const fixture = await mkdtemp(join(tmpdir(), 'screen-assets-test-'));
try {
  await mkdir(join(fixture, 'src/world/systems'), { recursive: true });
  await mkdir(join(fixture, 'public/images/optimized'), { recursive: true });
  await writeFile(join(fixture, 'src/world/systems/HubSections.tsx'), '"/images/optimized/test.png"; "/images/optimized/unchanged.png"');
  const image = color => sharp({ create: { width: 1600, height: 900, channels: 3, background: color } }).png().toBuffer();
  await writeFile(join(fixture, 'public/images/optimized/test.png'), await image('blue'));
  await writeFile(join(fixture, 'public/images/optimized/unchanged.png'), await image('green'));
  const first = await buildScreenAssets(fixture);
  assert.deepEqual(await buildScreenAssets(fixture), first, 'unchanged builds retain cacheable URLs');
  await writeFile(join(fixture, 'public/images/optimized/test.png'), await image('red'));
  const next = await buildScreenAssets(fixture);
  for (const device of ['mobile', 'desktop']) {
    assert.notEqual(next['/images/optimized/test.png'][device].url, first['/images/optimized/test.png'][device].url, 'changed source invalidates both sizes');
    assert.equal(next['/images/optimized/unchanged.png'][device].url, first['/images/optimized/unchanged.png'][device].url, 'other images keep their cache');
  }
} finally { await rm(fixture, { recursive: true, force: true }); }
console.log(`Screen images passed: ${Object.keys(manifest).length} shared sources, WebP dimensions, content hashes, changed-image invalidation and stable caches. Mobile ${mobileBytes} bytes vs desktop ${desktopBytes} bytes.`);
