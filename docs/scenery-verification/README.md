# Scenery rendering diagnosis — 2026-09-14

The original scenery mounted and its textures loaded, but Chrome rejected all three snow-patched materials with `ERROR: 'patch': Illegal use of reserved word`. TypeScript/build and geometry tests had not compiled these GPU shaders, so those checks missed the failure. The snowbanks did not use that shader but were small and placed outside the starting view; the initial mobile subset could omit every bank.

The fix renames the shader variable and changes its program cache key. It also relocates six existing pines, five existing rocks and two existing banks into clearer views around the routes. The total remains 34 pines, 43 rocks and four banks. The mobile selection preserves the foreground within its 44-instance budget. No layout, platform, screen, pickup, sky or gameplay changes were required.

Runtime checks use real headless Chrome with software WebGL, at 1440×900 desktop and 390×844 touch/mobile; the mobile view is also resized to 844×390. This confirms rendering, not physical-phone FPS. Screenshots are actual game captures from the default central-plaza spawn after clicking Play, not offline illustrations.

- `before-shader-fix.png`: reproduced missing scenery.
- `desktop-plaza.png`: corrected desktop view.
- `mobile-plaza.png`, `mobile-landscape-plaza.png`: corrected mobile views.
- `desktop-runtime.json`, `mobile-runtime.json`: active scene mount, device detection, instance counts, culling state, texture HTTP responses and browser error logs.

The rendering-fix captures above were recorded when scenery still loaded after Play. The later startup change now loads scenery with the world; see the before-play captures and startup checks below. All five texture URLs returned HTTP 200. The geometry is generated locally, so there are no separate scenery model URLs to fail. Models sit at ground Y=0, extend above it, use nonzero scales, and have populated visible instance batches. Empty LOD batches correctly remain invisible. No shader/page errors remain in the verification runs.

Reproduction: start the Vite development server, make Playwright available outside the production project, then run `scripts/check-scenery-browser.mjs`. Set `PLAYWRIGHT_MODULE_PATH` to its installed entry module, `GAME_TEST_URL` to the Vite URL and optionally `CHROME_EXECUTABLE`. The script saves fresh screenshots and asserts mounting, device selection, visible batches and successful asset loads. The new unit regression also inspects the generated snow shader to prevent the reserved identifier from returning.


## Startup loading change

Scenery now shares the main world loading boundary. The five texture requests feed the existing Three loading-manager progress. A first-render signal prevents the loading overlay from closing merely because downloads completed before the world committed. The previous focus-dependent mount state and scenery-specific lazy boundary were removed; placement, materials, LODs and density are unchanged.

`check-scenery-startup-browser.mjs` uses fresh desktop/mobile browser contexts and deliberately holds the rock-normal texture request. It checks that the loading overlay remains visible until that request is released, then inspects the active scene before clicking Play. It captures `desktop-before-play.png`, `mobile-before-play.png`, and `mobile-landscape-before-play.png`. It subsequently exercises Play and Escape, pointer-lock loss and window blur, checking that the scenery group and all instance batch UUIDs stay the same and the five texture requests are not repeated. Per-profile results are saved to `desktop-startup.json` and `mobile-startup.json`.
