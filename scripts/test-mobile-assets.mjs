import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MeshoptDecoder } from 'meshoptimizer';
const variants = JSON.parse(readFileSync('src/world/mobile-assets.json', 'utf8'));
function glb(path) {
  const bytes = readFileSync(`public${path}`);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const length = bytes.readUInt32LE(12);
  return { doc: JSON.parse(bytes.subarray(20,20+length)), bin: bytes.subarray(28+length) };
}
await MeshoptDecoder.ready;
for (const [original, mobile] of Object.entries(variants)) {
  assert(readFileSync(`public${mobile}`).length < readFileSync(`public${original}`).length, `${mobile} must be smaller`);
  if (!original.endsWith('.glb')) continue;
  const before = glb(original), after = glb(mobile);
  for (const key of ['meshes', 'skins', 'animations', 'nodes', 'accessors']) assert.deepEqual(after.doc[key], before.doc[key], `${key} preserved`);
  const images = new Set(before.doc.images.map(i => i.bufferView));
  after.doc.bufferViews.forEach((view, i) => {
    const old = before.doc.bufferViews[i];
    if (view.buffer === 0 && !images.has(i)) {
      assert.deepEqual(after.bin.subarray(view.byteOffset, view.byteOffset + view.byteLength), before.bin.subarray(old.byteOffset, old.byteOffset + old.byteLength), 'Non-image data preserved');
    }
    const ext = view.extensions?.EXT_meshopt_compression, oldExt = old.extensions?.EXT_meshopt_compression;
    if (!ext) return;
    const compressed = after.bin.subarray(ext.byteOffset, ext.byteOffset + ext.byteLength);
    assert.deepEqual(compressed, before.bin.subarray(oldExt.byteOffset, oldExt.byteOffset + oldExt.byteLength));
    const decoded = new Uint8Array(ext.count * ext.byteStride);
    MeshoptDecoder.decodeGltfBuffer(decoded, ext.count, ext.byteStride, compressed, ext.mode, ext.filter);
  });
  for (const image of after.doc.images) {
    const view = after.doc.bufferViews[image.bufferView];
    assert.equal(after.bin.toString('ascii',view.byteOffset,view.byteOffset+4), 'RIFF');
    assert.equal(after.bin.toString('ascii',view.byteOffset+8,view.byteOffset+12), 'WEBP');
    assert(view.byteOffset + view.byteLength <= after.bin.length);
  }
}
console.log('Mobile asset tests passed: all variants smaller; rigs, animations and geometry preserved; every Meshopt buffer decodes.');
