import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { resolve, relative } from 'node:path';

const root = resolve(import.meta.dirname, '..');
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
const publicRoot = resolve(root, 'public');
const assets = files(publicRoot);
const sources = [...files(resolve(root, 'src')), resolve(root, 'index.html')]
  .filter(path => /\.(tsx?|jsx?|css|html)$/.test(path));
const source = sources.map(path => readFileSync(path, 'utf8')).join('\n');
// Public URLs are literal in this project; review this scan if dynamic paths are added.
const references = new Set([...source.matchAll(/["'`](\/(?:audio|videos|images|characters|logo|fonts)\/[^"'`\s]+)["'`]/g)].map(match => match[1]));
for (const url of references) assert.ok(existsSync(resolve(publicRoot, url.slice(1))), `Missing asset: ${url}`);
const licenseFiles = new Set(['/fonts/IBMPlexSans-OFL.txt']);
const hashes = new Map();
for (const path of assets) {
  const url = '/' + relative(publicRoot, path);
  assert.ok(references.has(url) || licenseFiles.has(url), `Review unreferenced public asset: ${url}`);
  const hash = createHash('sha256').update(readFileSync(path)).digest('hex');
  assert.ok(!hashes.has(hash), `Duplicate public asset: ${url} and ${hashes.get(hash)}`);
  hashes.set(hash, url);
}
const dist = resolve(root, 'dist');
if (existsSync(dist)) {
  const built = files(dist);
  for (const path of assets) {
    const output = resolve(dist, relative(publicRoot, path));
    assert.ok(existsSync(output), `Missing built asset: ${output}`);
    assert.ok(readFileSync(path).equals(readFileSync(output)), `Built asset differs: ${output}`);
  }
  const copies = new Map();
  for (const path of built) {
    const hash = createHash('sha256').update(readFileSync(path)).digest('hex');
    if (hashes.has(hash)) copies.set(hash, (copies.get(hash) ?? 0) + 1);
  }
  for (const [hash, url] of hashes) assert.equal(copies.get(hash), 1, `Expected one build copy of ${url}`);
  const allowed = new Set(assets.map(path => relative(publicRoot, path)));
  for (const path of built) {
    const name = relative(dist, path);
    assert.ok(allowed.has(name) || name === 'index.html' || /^assets\/[^/]+\.(js|css)$/.test(name), `Unexpected build file: ${name}`);
  }
  console.log(`Production output: ${(built.reduce((n, p) => n + statSync(p).size, 0) / 1e6).toFixed(2)} MB; one copy per public asset.`);
}
console.log(`Asset audit passed: ${assets.length} public files, ${references.size} referenced URLs, no missing or duplicate assets.`);
