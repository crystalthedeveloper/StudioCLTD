# StudioCLTD asset audit — 2026-09-11

Sizes below use decimal MB (1 MB = 1,000,000 bytes), summing file lengths; OS allocated-disk measurements differ. The supplied 517.27 MB could not be reproduced in this checkout. The initial logical total was 742.45 MB (including local dependencies and Git history).

| Scope | Before MB | After MB |
| --- | ---: | ---: |
| Entire local checkout, including Git and dependencies | 742.45 | ~649.09 |
| Source project, excluding `.git`, `node_modules`, `dist` | 36.28 | ~31.58 |
| Production `dist` | 39.31 | 34.59 |
| Public assets | 35.87 | 31.15 |
| `node_modules`, including cache | 313.54 | 229.60 |
| Git history (preserved) | 353.32 | 353.32 |

The production output is **12.0% smaller**, saving 4.72 MB. The local checkout is approximately 93.36 MB smaller. Minor source/report bytes are included in rounded totals.

## Largest items found first

- Git history: 353.32 MB, including a 62.46 MB historical object. No history rewritten or deleted.
- Dependencies and development cache: 313.54 MB.
- Existing production output: 39.31 MB; rebuilt from scratch.
- Public assets: 35.87 MB, led by the 15.64 MB character model and 16.84 MB of responsive video.
- Largest videos: `myWebsite.mp4` 8.97 MB, `myWebsite-mobile.mp4` 3.48 MB, `showcase.mp4` 3.10 MB, `showcase-mobile.mp4` 1.29 MB.
- `src`: 0.28 MB of source, with no orphan binary media assets.

## Applied optimizations

- Character GLB: 15,640,616 → 11,006,464 bytes. Meshopt compression uses no quantization, simplification, animation resampling, or lossy filters. Every compressed buffer was decoded and compared byte-for-byte. All original nodes, meshes, materials, skins, accessors, and eight animations remain present.
- Seven embedded PNG textures became lossless WebP. Decoded RGBA pixels were compared exactly; dimensions and the existing color profile were preserved. No separate texture files or fallback copies were added. Meshopt decoding was already enabled at all three character load sites.
- Five MP3s: removed leading ID3 metadata, including embedded provenance containers, without re-encoding or changing MPEG audio frames. Full decoded PCM comparisons pass, including timing and sample count. An initial remux candidate altered decoder delay and was rejected.
- Removed the generated `node_modules/.vite` cache and 165 extraneous package directories, broken tool links, and empty dependency scope directories, listed below. Required runtime/build dependencies and the lockfile were retained. Offline npm pruning required unavailable registry metadata, so removal used npm's explicit `extraneous` classification; `npm ls --depth=0` and a fresh build passed afterward.
- Removed the old `dist` tree and generated a fresh production build. No `.next` directory or empty public/source folders existed.
- Added `.vercelignore` and explicit Vite build/output settings in `vercel.json`.
- Added `npm run audit:assets` for public reference, missing-file, duplicate-content, and production-copy checks.

### Embedded textures

| Texture | Before bytes | After bytes |
| --- | ---: | ---: |
| `whiteclown_specular` | 952,121 | 596,738 |
| `whiteclown_normal` | 2,696,246 | 1,788,554 |
| `whiteclown_diffuse` | 2,257,277 | 1,518,630 |
| `Daisy_Clown_T` | 1,581,552 | 907,172 |
| `Client_Clown_T` | 2,668,524 | 1,347,356 |
| `Hwhiteclown_diffuse` | 2,611,347 | 2,121,464 |
| `Hero_Mask` | 1,003,428 | 294,498 |

## Public file inventory

All 38 public files were inspected. Thirty-seven have explicit runtime references; the remaining font license must accompany its font. No duplicate public files, unused public assets, or removable source media were found. Existing runtime asset URLs remain unchanged.

| File | Before bytes | After bytes | Action |
| --- | ---: | ---: | --- |
| `public/audio/Performance.mp3` | 137,020 | 120,372 | ID3 metadata removed; audio identical |
| `public/audio/Quick-Fix.mp3` | 99,022 | 82,337 | ID3 metadata removed; audio identical |
| `public/audio/Site-Improvement.mp3` | 92,335 | 75,650 | ID3 metadata removed; audio identical |
| `public/audio/Urgent-Fix.mp3` | 120,756 | 104,071 | ID3 metadata removed; audio identical |
| `public/audio/defeat.mp3` | 37,165 | 20,480 | ID3 metadata removed; audio identical |
| `public/characters/char-optimized.glb` | 15,640,616 | 11,006,464 | Lossless Meshopt + WebP |
| `public/fonts/IBMPlexSans-OFL.txt` | 4,456 | 4,456 | Unchanged |
| `public/fonts/studiocltd-text.ttf` | 20,752 | 20,752 | Unchanged |
| `public/images/cltd-logo.svg` | 5,118 | 5,118 | Unchanged |
| `public/images/optimized/2k_moon.webp` | 433,232 | 433,232 | Unchanged |
| `public/images/optimized/cinematic-cloud-layer.webp` | 96,268 | 96,268 | Unchanged |
| `public/images/optimized/floor/world-weathered-concrete-bump.webp` | 36,022 | 36,022 | Unchanged |
| `public/images/optimized/floor/world-weathered-concrete-normal.webp` | 254,494 | 254,494 | Unchanged |
| `public/images/optimized/floor/world-weathered-concrete-roughness.webp` | 7,400 | 7,400 | Unchanged |
| `public/images/optimized/floor/world-weathered-concrete-seamless.webp` | 43,610 | 43,610 | Unchanged |
| `public/images/optimized/offers/performance.jpg` | 75,418 | 75,418 | Unchanged |
| `public/images/optimized/offers/quick-fix.jpg` | 67,542 | 67,542 | Unchanged |
| `public/images/optimized/offers/site-improvement.jpg` | 78,325 | 78,325 | Unchanged |
| `public/images/optimized/offers/urgent-fix.jpg` | 74,915 | 74,915 | Unchanged |
| `public/images/optimized/performance/performance-bad.webp` | 114,474 | 114,474 | Unchanged |
| `public/images/optimized/performance/performance-good.webp` | 76,326 | 76,326 | Unchanged |
| `public/images/optimized/quickFix/quick-fix-bad.jpg` | 96,174 | 96,174 | Unchanged |
| `public/images/optimized/quickFix/quick-fix-good.jpg` | 88,588 | 88,588 | Unchanged |
| `public/images/optimized/siteImprovement/site-improvement-bad.webp` | 88,706 | 88,706 | Unchanged |
| `public/images/optimized/siteImprovement/site-improvement-good.webp` | 54,012 | 54,012 | Unchanged |
| `public/images/optimized/tips/content-tip.webp` | 62,060 | 62,060 | Unchanged |
| `public/images/optimized/tips/images-tip.webp` | 70,388 | 70,388 | Unchanged |
| `public/images/optimized/tips/navigation-tip.webp` | 67,368 | 67,368 | Unchanged |
| `public/images/optimized/urgentFix/urgent-fix-bad.jpg` | 69,750 | 69,750 | Unchanged |
| `public/images/optimized/urgentFix/urgent-fix-good.jpg` | 122,363 | 122,363 | Unchanged |
| `public/images/optimized/values/value-speed.webp` | 73,406 | 73,406 | Unchanged |
| `public/images/optimized/values/value.webp` | 66,246 | 66,246 | Unchanged |
| `public/images/optimized/venus-surface-2k.webp` | 467,718 | 467,718 | Unchanged |
| `public/logo/logo-optimized.glb` | 192,076 | 192,076 | Unchanged |
| `public/videos/myWebsite-mobile.mp4` | 3,479,293 | 3,479,293 | Unchanged |
| `public/videos/myWebsite.mp4` | 8,965,818 | 8,965,818 | Unchanged |
| `public/videos/showcase-mobile.mp4` | 1,290,576 | 1,290,576 | Unchanged |
| `public/videos/showcase.mp4` | 3,101,293 | 3,101,293 | Unchanged |

## Candidates retained to preserve quality

- All four MP4s already use H.264, 30 fps, and responsive 720p/480p dimensions. High-quality CRF 18 / slow encoding trials on both desktop videos increased size; rejected. Stream-copy metadata/fast-start trials on all four did not reduce size; originals retained byte-for-byte. No video frame, sound, dimensions, timing, or screen behavior changed.
- Lossless WebP trials on all eight public JPEG screenshots produced larger files (roughly 2–4 times their current size), so the originals were retained. Existing WebP planet/cloud/floor/screen textures remain untouched.
- Texture downscaling was not applied: the lossless changes already save space without risking character, mask, planet, or screen detail. The 4096-pixel mask is now only 294,498 bytes without resampling.
- The 192 KB logo model already uses Meshopt; retained. Player/villain alternate materials and animations are accessed by name and were not pruned based only on static glTF reachability.
- The skybox-generation script is a source utility, not a shipped unused image; retained. No unused skybox image exists in `public`.

## Validation and limits

- Fresh `npm run build`: passed TypeScript and Vite. Existing large-JavaScript-chunk advisory remains.
- `npm run audit:assets`: passed; 38 public files, 37 runtime URLs, each public asset appears exactly once in `dist`, no unexpected build files.
- Existing contact-feedback, pause, power-meter, and power-smoke regression scripts: passed.
- Actual Three.js GLTFLoader before/after comparison: geometry attributes/indices, scene transforms, material names, skeletons/inverse bind matrices, and all eight animation clips/tracks match exactly. Browser texture loading was stubbed for this Node check; decoded image pixels were independently checked using Sharp.
- glTF Validator: zero errors. Existing tangent-space/skinned-node warnings remain; validator does not validate Meshopt itself, so explicit decoder round-trip and real loader checks cover it.
- All five audio files decode to identical PCM samples.
- No browser visual/gameplay session or Vercel deployment was performed. Working-game preservation is supported by exact asset comparisons and regression checks, not a claimed visual test.

Vercel serves the configured output directory, which is `dist` here; `.git` and installed local dependencies are not the static game payload. See [Vercel build configuration](https://vercel.com/docs/builds/configure-a-build). This audit does not claim that 517.27 MB is a universal Vercel limit or that a deployment has been tested.

## Removed local dependency directories and links

These were generated/untracked development dependencies or dangling command links, not gameplay assets. No entries were removed from `package.json` or the lockfile.

- `node_modules/@colors/colors`
- `node_modules/@dabh/diagnostics`
- `node_modules/@donmccurdy/caporal`
- `node_modules/@gltf-transform/cli`
- `node_modules/@gltf-transform/core`
- `node_modules/@gltf-transform/extensions`
- `node_modules/@gltf-transform/functions`
- `node_modules/@img/colour`
- `node_modules/@img/sharp-darwin-arm64`
- `node_modules/@img/sharp-libvips-darwin-arm64`
- `node_modules/@isaacs/cliui`
- `node_modules/@pkgjs/parseargs`
- `node_modules/@so-ric/colorspace`
- `node_modules/@types/braces`
- `node_modules/@types/glob`
- `node_modules/@types/language-tags`
- `node_modules/@types/lodash`
- `node_modules/@types/micromatch`
- `node_modules/@types/minimatch`
- `node_modules/@types/ndarray`
- `node_modules/@types/node-fetch`
- `node_modules/@types/node`
- `node_modules/@types/prompts`
- `node_modules/@types/table`
- `node_modules/@types/tmp`
- `node_modules/@types/triple-beam`
- `node_modules/@types/wrap-ansi`
- `node_modules/ajv`
- `node_modules/ansi-escapes`
- `node_modules/ansi-regex`
- `node_modules/ansi-styles`
- `node_modules/astral-regex`
- `node_modules/async`
- `node_modules/asynckit`
- `node_modules/balanced-match`
- `node_modules/brace-expansion`
- `node_modules/braces`
- `node_modules/call-bind-apply-helpers`
- `node_modules/chalk`
- `node_modules/cli-cursor`
- `node_modules/cli-table3`
- `node_modules/cli-truncate`
- `node_modules/color-convert`
- `node_modules/color-name`
- `node_modules/color-string`
- `node_modules/color`
- `node_modules/colorette`
- `node_modules/combined-stream`
- `node_modules/csv-stringify`
- `node_modules/cwise-compiler`
- `node_modules/data-uri-to-buffer`
- `node_modules/delayed-stream`
- `node_modules/detect-libc`
- `node_modules/draco3dgltf`
- `node_modules/dunder-proto`
- `node_modules/eastasianwidth`
- `node_modules/emoji-regex`
- `node_modules/enabled`
- `node_modules/environment`
- `node_modules/es-define-property`
- `node_modules/es-errors`
- `node_modules/es-object-atoms`
- `node_modules/es-set-tostringtag`
- `node_modules/eventemitter3`
- `node_modules/fast-deep-equal`
- `node_modules/fast-json-stable-stringify`
- `node_modules/fecha`
- `node_modules/fetch-blob`
- `node_modules/fill-range`
- `node_modules/fn.name`
- `node_modules/foreground-child`
- `node_modules/form-data`
- `node_modules/formdata-polyfill`
- `node_modules/function-bind`
- `node_modules/get-east-asian-width`
- `node_modules/get-intrinsic`
- `node_modules/get-proto`
- `node_modules/glob`
- `node_modules/gltf-validator`
- `node_modules/gopd`
- `node_modules/has-flag`
- `node_modules/has-symbols`
- `node_modules/has-tostringtag`
- `node_modules/hasown`
- `node_modules/inherits`
- `node_modules/iota-array`
- `node_modules/is-buffer`
- `node_modules/is-fullwidth-code-point`
- `node_modules/is-number`
- `node_modules/is-stream`
- `node_modules/jackspeak`
- `node_modules/json-schema-traverse`
- `node_modules/keyframe-resample`
- `node_modules/kleur`
- `node_modules/ktx-parse`
- `node_modules/kuler`
- `node_modules/language-subtag-registry`
- `node_modules/language-tags`
- `node_modules/listr2`
- `node_modules/lodash`
- `node_modules/log-update`
- `node_modules/logform`
- `node_modules/math-intrinsics`
- `node_modules/micromatch`
- `node_modules/mikktspace`
- `node_modules/mime-db`
- `node_modules/mime-types`
- `node_modules/mimic-function`
- `node_modules/minimatch`
- `node_modules/minipass`
- `node_modules/ndarray-lanczos`
- `node_modules/ndarray-ops`
- `node_modules/ndarray-pixels`
- `node_modules/ndarray`
- `node_modules/node-domexception`
- `node_modules/node-fetch`
- `node_modules/one-time`
- `node_modules/onetime`
- `node_modules/package-json-from-dist`
- `node_modules/path-scurry`
- `node_modules/picomatch`
- `node_modules/prompts`
- `node_modules/property-graph`
- `node_modules/punycode`
- `node_modules/readable-stream`
- `node_modules/restore-cursor`
- `node_modules/rfdc`
- `node_modules/safe-buffer`
- `node_modules/safe-stable-stringify`
- `node_modules/sharp`
- `node_modules/signal-exit`
- `node_modules/sisteransi`
- `node_modules/slice-ansi`
- `node_modules/stack-trace`
- `node_modules/string_decoder`
- `node_modules/string-width-cjs`
- `node_modules/string-width`
- `node_modules/strip-ansi-cjs`
- `node_modules/strip-ansi`
- `node_modules/supports-color`
- `node_modules/table`
- `node_modules/text-hex`
- `node_modules/tmp`
- `node_modules/to-regex-range`
- `node_modules/triple-beam`
- `node_modules/uniq`
- `node_modules/uri-js`
- `node_modules/util-deprecate`
- `node_modules/watlas`
- `node_modules/web-streams-polyfill`
- `node_modules/winston-transport`
- `node_modules/winston`
- `node_modules/wrap-ansi-cjs`
- `node_modules/wrap-ansi`
- `node_modules/.bin/gltf-transform`
- `node_modules/.bin/glob`
- `node_modules/@pkgjs`
- `node_modules/@donmccurdy`
- `node_modules/@emnapi`
- `node_modules/@dabh`
- `node_modules/@colors`
- `node_modules/@isaacs`
- `node_modules/@gltf-transform`
- `node_modules/@img`
- `node_modules/@so-ric`
