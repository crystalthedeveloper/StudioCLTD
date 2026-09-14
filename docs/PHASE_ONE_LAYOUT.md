# Phase one: plaza and district routes

[Top-down map](phase-one-layout.svg) is generated from the implemented coordinates. North is negative Z.

The central plaza has an 18-unit radius. A seven-unit-wide continuous circuit joins the introductory west district (Tips, Quick Fix, Offers), eastern challenge district (Urgent Fix, Performance, Site Improvement), and northern Value/Showcase overlook. Four plaza spokes provide shortcuts. Quick Fix has a short approach spur. All platforms retain their 28×28 footprint and 4.2-unit-wide, 14-unit-run ramps. Showcase is the highest destination at 4.2 units.

Ground now covers 172×184 units centered at (0, −22), leaving margins around the northern overlook and southern platforms. The existing winter ground material is retained. Paving uses the existing ground textures, one static mesh, and the same flat ground collider; it adds no texture downloads, steps, lights, or animation. Sky, snow, clouds and planets are untouched. No trees, rocks, hills or other scenery were added.

Section IDs/content and transport-pad order are unchanged. Screens, encounters and teleport destinations follow the repositioned section definitions and entrance vectors. Home Base and its return portal remain in their existing separate location. The player still spawns at the transport plaza. Cash/health counts, values, cooldowns and pickup IDs are unchanged; positions follow the paths with the existing clearance resolver. Ground powers, platform powers and bonus-enemy roaming positions were repositioned; their behaviors are unchanged. The optional minimap now accounts for the new world bounds.

## Validation

`node scripts/test-world-layout.mjs` checks the actual layout data with Rapier colliders: the closed walking circuit and ramp connections, full-width player-capsule clearance, solid ground, ramp heights/gradients, teleport arrival clearance, platform gaps and ground margins, open-ground pickup positions/counts, power locations and bonus spawns. The same geometry is checked for desktop and mobile control profiles. This is a headless collision/layout check, not an input-driven browser playthrough. The paving mesh stays below 1,000 triangles.

All regression tests, TypeScript/Vite production build and asset audit pass. Browser execution tools are unavailable in this session, so desktop/mobile rendered navigation, camera orbit checks and touch-control playthroughs remain unverified. Review those in the running game before treating visual navigation QA as complete.

Regenerate the map with `node scripts/export-world-layout.mjs` after changing coordinates. The diagram and development scripts are not production assets.
