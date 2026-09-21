# Mobile performance changes

Baseline: commit `f23f9d5`, built before edits on 2026-09-13 with `npm run build`.
After: working tree built with the same installed toolchain. Sizes below use decimal MB.

## Measured asset and build sizes

| Metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| Shared character model downloaded on mobile | 11.006 MB | 2.600 MB | −76.4% |
| Selected startup assets: character, logo, floor maps and sky textures | 12.537 MB | 3.081 MB | −75.4% |
| All assets with mobile alternatives | 13.883 MB | 3.678 MB | −73.5% |
| Total production JavaScript, uncompressed | 3,420,385 bytes | 3,424,637 bytes | +4,252 bytes |
| Total production JavaScript, gzip | 1,162,041 bytes | 1,162,973 bytes | +932 bytes |
| Entire deployment directory | 34.599 MB | 38.282 MB | +3.682 MB |
| Mobile cold load to playable | Unmeasured | Unmeasured | Browser test outstanding |
| Mobile gameplay FPS | Unmeasured | Unmeasured | Browser test outstanding |

The startup asset row is a file-size sum, not an observed network waterfall. It excludes JavaScript, fonts, SVGs, audio, videos and the desktop HDR environment. Gzip totals were calculated per JavaScript file with Python gzip defaults. The deployment grows because both quality tiers are retained. A mobile client selects the smaller URLs; it does not need both copies. The launch chunk remains about 144.87 kB raw / 46.87 kB gzip. Vite still reports a large game chunk, dominated by the existing engine/physics stack.

## Implemented behavior

- Mobile uses the existing coarse-pointer or viewport-at-most-768px detection. Desktop retains its original asset URLs and quality settings.
- Generated 26 mobile alternatives. Model and floor textures are capped at 512 pixels on their longest side; screen and sky images at 1024. Images use WebP quality 82. Character and logo meshes retain Meshopt compression, geometry, rigs and animations.
- Mobile pixel ratio is 0.85 (previously 1): 27.75% fewer render pixels at the same viewport. Snow drops from 220 to 100 particles, clouds from six sprites to four, shadow maps from 1024² to 512², and floor anisotropy from four to one. Mobile skips the warehouse HDR reflection environment. Desktop keeps its environment, 650 snow particles, six clouds, 2048² shadows and DPR 1. Existing reduced mobile smoke and local-light budgets remain active.
- Mobile no longer blocks startup on preloading every TV image or preloads all villain audio. Those resources load when needed. Existing smaller mobile MP4s remain in use.
- Mobile district TVs, encounters, and platform/ramp visuals mount near the player after gameplay begins. Already loaded content stays mounted to retain completion, timers and encounter state. Districts keep their existing staggered scheduling. Colliders stay mounted from startup so walking and teleport landings have solid floors while visuals load. Starting bonus enemies remain available.
- Videos pause beyond 85 world units or outside the camera frustum, and resume at their prior time when visible. Explicit playback activation still restarts the video. Global pause and tap-to-play fallback remain supported. Frustum visibility does not detect occlusion by other geometry.
- Off-screen villain animation mixers pause beyond 24 units from the camera. Nearby combat animations keep advancing for smooth attack/death feedback. Damage is now contact-driven and independent of animation mixers. AI/physics continue; no gameplay simulation is removed.
- Models share the same device-specific URL across the player and villains. Floor resources and screen textures retain shared caches. Failed screen requests are removed from the promise cache so a later request can retry.
- Asset audit includes the generated manifest and verifies every public file is referenced (apart from the font license), has one build copy, and is not a duplicate. No additional unused public assets were found to remove. Vite's existing production tree shaking remains enabled; developer scripts are outside the output.

## Validation completed

- `npm run build`: TypeScript and Vite pass.
- `npm run audit:assets`: 72 public files, 71 referenced URLs plus the font license; no missing, duplicate or unreferenced assets.
- All `scripts/test-*.mjs` pass: existing combat, navigation, powers, hit feedback, pause/resume, guide, meter and smoke checks, plus new mobile loading and asset tests.
- Mobile asset checks decode every Meshopt buffer, compare original/new non-image data, and verify unchanged meshes, nodes, skins, animation/accessor data and valid embedded WebP buffers. Every mobile alternative is smaller.
- Mobile loading unit checks simulate 390, 430, 768 and 844px coarse-pointer viewports and a 1440px desktop viewport. They check device URL selection, deferred mount, teleport/approach, state retention and camera/distance video visibility. These are logic tests, not rendered browser tests.
- All pre-existing public assets remain byte-identical to the baseline.

## Outstanding browser validation

The session provides the browser skill but no callable browser execution tool. Therefore no mobile-sized rendered screen test, screenshot comparison, load-time measurement, FPS measurement or physical-phone test was performed. Stable frame rate and unchanged desktop appearance still require runtime verification; the size improvements above are not an FPS claim.

For a reproducible runtime comparison, serve separate baseline and changed production builds, use identical cold-cache runs at 390×844 and landscape 844×390 with touch input, and record launch click to the playable overlay. Keep device, network/CPU throttling and route identical. Measure gameplay frame times separately from loading over a 60-second route through spawn, all transport destinations, combat and both TVs; include median FPS and 95th-percentile frame time. Check off-screen video pause/resume, returning to completed districts, jumping/ramp collisions, damage, powers, restart, and tab pause. Compare desktop screenshots at 1440×900 using the same camera position. Repeat on a physical phone before claiming mobile FPS gains.

## Regenerating mobile assets

Run `python3 scripts/build-mobile-assets.py` on macOS with `cwebp` and `sips` available, followed by the build and tests above. Originals remain untouched. The script writes the mobile files and `src/world/mobile-assets.json`. No asset generation tools become browser dependencies.

## Current screen images and smoke (September 2026)

TV artwork is selected once in `src/world/systems/HubSections.tsx`. Both device sizes
are generated from those current sources by `npm run assets:screens` (also run
before `npm run dev` and `npm run build`). The generator uses Sharp to preserve
aspect ratio and output WebP with a 768 px mobile / 1536 px desktop maximum edge,
without upscaling. Generated images live in the ignored `public/images/screens/`
directory; their URL/dimension manifest is `src/world/screen-assets.json`.
Development source-image edits regenerate the manifest automatically.

Each URL hashes both its current source and encoded output. Updating one source
changes both device URLs; unchanged sources keep their URLs. Vercel serves these
hashed files with one-year immutable caching and revalidates the HTML entrypoint.
No service worker is registered by this app. Old `images/mobile` screen derivatives
and their mappings have been removed; the generic mobile-asset builder excludes
screen folders. Screen textures are cached by resolved, versioned URL, and mobile
retains its existing on-demand loading. Current total encoded screen payload is
567,426 bytes for mobile versus 1,746,554 bytes for desktop (about 68% smaller).

Smoke uses one instanced draw per cloud: 12 wisps and a shared 64×64 density texture
on mobile, 24 wisps and a shared 128×128 texture on desktop. Both use the same
spatial envelope. Feathered, irregular density lobes, gentle texture advection,
size variation and scalar light/shadow variation retain distinct active hues.
There are no smoke dynamic lights or fullscreen bloom passes. Mobile ground glow
is half desktop strength. The existing motion trail, effect timers and SVG logo
are retained.

Validation:
- `node scripts/test-screen-assets.mjs` checks current sources, dimensions, WebP,
  hashes, stable builds, and invalidation of both derivatives after a source edit.
- `node scripts/test-player-smoke.mjs` checks all 8 Power combinations and motion.
- `node scripts/test-power-smoke.mjs` checks device particle/texture budgets.
- `scripts/check-mobile-smoke-browser.mjs` uses Playwright (provide
  `PLAYWRIGHT_MODULE_PATH` if installed externally) and a running Vite dev server
  (`GAME_TEST_URL`, default port 5180). It checks all 21 images before and after
  normal refresh, decoded sizes, legacy requests, smoke palettes and shader errors
  in mobile emulation and desktop. Screenshots/report default to
  `/private/tmp/studiocltd-smoke-qa`; override `SMOKE_QA_OUTPUT` as needed.

The broader `test-mobile-assets.mjs` currently reports a pre-existing animation
mismatch between the character GLB variants. Neither character asset was modified
by this screen/smoke pass. Browser emulation validates rendering and requests,
not real-device frame rate or a deployed site's headers.


### Final HUD, offer gallery and ground trail

`src/player/effectColors.ts` is the only palette definition: Wind green `#009B3A`,
Shock gold `#FED100`, and Fire red `#CE1126`. HUD dots,
bars, smoke, pickup lighting and hit effects consume those shared values. The
Player still displays each active hue in separate wisps and drops expired hues.
The top-right hub is one vertical stack: Wind, Shock, Fire. Existing arrow
and Jump controls remain at the bottom; Health, Progress and Cash are unchanged.

The ground trail tracks an invisible visual anchor at the original sphere centre.
It uses pooled instanced snow/dust puffs and brief ground marks (12 each on mobile,
24 each on desktop), emits only during grounded movement, fades after stopping,
and clears on transport or pause. It never writes to the Rapier body.

Offers now has eight pads and individual preview screens along the two sides of
the platform. Each uses its matching supplied WebP; `2-5hour.webp` is labelled
"2.5-Hour Block" to match the artwork. The main Offers TV retains its selected-offer
display, and the existing countdown/cancellation and offer-page link are retained.
Offer artwork uses full UVs and an aspect-preserving contain scale on both the
previews and main TV. The shared trigger label height is 0.58 units (secondary
countdown labels 0.94 units), above the pads and below their previous positions.


Each active Power grants the existing 18.4-unit movement speed (normal: 13.2).
The boost is derived directly from the union of active Power timers, does not
multiply with overlapping Powers, and ends only when all Powers expire. There is
no separate boost pickup, HUD, timer store, colour or sound. Remaining collectible
positions and respawn timings are unchanged. `test-power-movement.mjs` exercises
the real controller with each Power, overlaps, expiry, refill, pause and reset.
