# Optional winter scenery

The scenery is isolated in `src/world/scenery/` and `src/world/systems/WinterScenery.tsx`. Set `scenerySettings.enabled` to `false` in `sceneryLayout.ts` to disable it without changing the world. The same file controls cluster centers, density, draw distance, LOD distance, and shadow range.

Desktop placement: 34 pine trees, 43 rocks, four snowbanks. Mobile retains 55% of placements, switches LOD at 32 units instead of 58, and culls beyond 100 units instead of 155. Only trees within 30 units of the camera (18 on mobile) enter the shadow-casting batches. Updates run at 4 Hz. Scenery loads with the main world inside its startup Suspense boundary. The loading progress includes all five scenery textures and stays visible until the assembled world has rendered its first frame. The Play button, pause and pointer-lock state do not control scenery mounting. It adds no gameplay colliders, lights, or animations and does not modify existing terrain, routes, platforms, pickups, screens or sky.

Three reusable pine variants use tapered, bent trunks, separate boughs and crossed needle sprigs. The models are authored in code, not the multi-million-triangle source tree meshes. The twig cards sample only the pine sprig region of the photographic atlas. Three eroded boulder variants use photographed stone colour/normal textures. Snow is patchy, biased toward upward-facing surfaces; foliage remains predominantly dark. Instances vary scale and yaw. The four shallow snowbanks sit outside path clearances.

All instances share geometry/materials within their variant and LOD. Foliage uses alpha testing with depth writing and an alpha-tested shadow material. Terrain clearance and plaza-to-destination sightline checks reject unsafe placements. Development tests verify model budgets, deterministic placement and exclusion distances. The shared snow shader initially failed in Chrome because `patch` is a reserved GLSL identifier. It is now renamed to `snowPatchNoise`. Six existing pines, five rocks and two snowbanks have been moved into foreground views with tighter, explicit clearance checks; no objects were added. Mobile retains those foreground instances within its existing total budget. See `scenery-verification/` for real Chrome screenshots and runtime checks.

## Texture sources and license

- Pine needles, alpha and bark: [Pine Tree 01, Poly Haven](https://polyhaven.com/a/pine_tree_01), Rico Cilliers and Rob Tuytel, CC0.
- Rock colour and normal: [Rock 01, Poly Haven](https://polyhaven.com/a/rock_01), CC0.

Downloaded 1K source maps were converted with cwebp to local WebP files. Bark and rock maps are 512px; the foliage atlas and mask are 1024px to preserve fine needles. No external network requests are made by the running scenery. The original full tree geometry was not downloaded or shipped.
