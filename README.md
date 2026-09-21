# StudioCLTD

StudioCLTD is a lightweight third-person React Three Fiber game world for exploring StudioCLTD services, offers, tips, and showcase content. It contains eight main sections plus a separate teleport-only Home Base.

## Highlights

- Eight interactive sections tracked independently from `0/8`: Tips, Offers, Value, Quick Fix, Urgent Fix, Performance, Site Improvement, and Showcase.
- Third-person movement with WASD, keyboard arrows, and multi-touch on-screen arrows.
- Collectible contact powers: green Wind for 6 seconds, gold Shock for 10 seconds, and red Fire for 15 seconds. Every active Power includes faster movement.
- Collect smoke to activate a Power immediately; use Space or Jump for a powered jump. Active powers defeat villains on contact and prevent villain contact damage.
- Main villains advance section Progress through the existing Fix logic.
- Two roaming bonus villains award `+$3` Cash and respawn after 8–10 seconds without affecting Progress.
- Green Coin, red Penalty, blue Contact, purple Share, and decorative black/white logos.
- Responsive Showcase and Home Base website-video screens.
- Compact responsive HUD with Health, Progress, Cash, three Power timers, D-pad, Jump, sound, guide, restart, and website controls.
- Full-page restart for a completely fresh game state.

## World Layout

```text
┌──────────────────┬──────────────────┬──────────────────┐
│ Tips             │ Offers           │ Value            │
├──────────────────┼──────────────────┼──────────────────┤
│ Quick Fix        │ Plaza / Hub      │ Performance      │
├──────────────────┼──────────────────┼──────────────────┤
│ Urgent Fix       │ Site Improvement │ Showcase         │
└──────────────────┴──────────────────┴──────────────────┘
```

The Home Base is a separate hidden level beyond the main camera range. The central transport pad is its only entrance, and a return pad sends the player back. Home Base does not count as a ninth section.

Home Base contains Contact and Share, a responsive `crystalthedeveloper.ca` video screen, three standard Coin pickups, and the same weathered concrete ground finish as the main world.

## Controls

| Action | Controls |
| --- | --- |
| Move forward/backward | `W` / `S`, ↑ / ↓, or on-screen arrows |
| Turn left/right | `A` / `D`, ← / →, or on-screen arrows |
| Combined movement | Hold forward/backward with left/right |
| Activate a Power | Collect its smoke pickup |
| Jump while any Power is active | `Space` or **Jump** |
| Game Guide | `1` or Info |
| Toggle sound | `2` or Sound |
| Full restart | `3` or Restart |
| Open website | `4` or Website |
| Enter game focus | Click/tap **Play** |
| Release pointer lock | `Esc` |

Wind, Shock, and Fire activate on pickup and have independent timers stacked at the top right. Multiple Powers retain their own abilities and smoke colours. Every Power grants the same movement boost; multiple Powers do not multiply it. Normal movement returns only after all active Powers expire. Collecting a Power again refills only its own timer. Global pause freezes all timers.

## Logo Guide

| Color | Purpose |
| --- | --- |
| Green `#3F7D3A` | Coin / Cash |
| Red | Penalty |
| Blue `#2583E8` | Contact |
| Purple `#A855F7` | Share |
| White / Black | Decorative |

## Tech Stack

- React 18 and TypeScript
- Vite 5
- Three.js, React Three Fiber, and Drei
- Rapier physics

## Project Structure

```text
src/
├── audio/          Shared game, collectible, and villain audio
├── characters/     Shared character material configuration
├── player/         Movement, camera, animation, footsteps, and boosts
├── ui/             HUD, D-pad, guide, overlays, and labels
└── world/          Terrain, sections, combat, transport, and Home Base

public/
├── audio/          Voice, collectible, and defeat audio
├── characters/     Optimized shared player/villain GLB
├── images/         Screen, planet, logo, and environment assets
└── videos/         Responsive Showcase and website videos
```

## Character Asset and Animations

The player and villains share `public/characters/char-optimized.glb`, losslessly optimized to approximately 11.0 MB with Meshopt and embedded WebP textures.

- Player: `idleH`, `runH`
- Villain: `idleV`, `runV`, `dieV`, `fixedH`

## Development

```bash
npm install
npm run dev
```

Production build and preview:

```bash
npm run build
npm run preview
```

The production build runs TypeScript before Vite and writes deployable files to `dist/`.

## Maintenance Guidelines

- Preserve the eight section IDs and required-trigger mappings.
- Keep bonus-villain Cash separate from section Progress.
- Reuse shared power, collectible, trigger, material, and audio systems.
- Keep Contact and Share exclusively on Home Base.
- Clean up timers, listeners, video/audio playback, and Three.js resources on unmount.
- Avoid creating reusable Three.js objects inside `useFrame`.
- Preserve keyboard, pointer-lock, touch, multi-touch, and responsive HUD behavior.
- Run `npm run build` before deployment.

## Production Notes

- The 3D experience is lazy-loaded separately from the launch screen.
- Responsive videos and compressed WebP textures reduce mobile bandwidth.
- The Three.js renderer bundle can exceed Vite's default chunk-size advisory; this does not prevent a successful build.

### Winter theme

Set `WINTER_THEME_ENABLED` in `src/world/winterTheme.ts` to `false` to disable
snowfall, terrain frost, ground haze, and cool world lighting together.
Snow uses a single GPU particle draw (650 desktop / 220 small or touch devices),
recycled within 24 units of the player. It pauses with gameplay, fades near the
camera, does not receive pointer events, and adds no colliders or shadows.
Frost and faint distance-based ground mist are shaded on existing concrete
surfaces, preserving terrain geometry, paths, and gameplay overlays. The black
sky, clouds, and planets retain their existing appearance.

### Asset size and deployment

Run `npm run audit:assets` after `npm run build` to check public asset references,
missing files, duplicate content, and duplicate copies in the production output.
Vercel is configured to build this Vite project and serve only `dist/`; local Git
history, dependencies, and old builds are excluded from CLI uploads.
See [ASSET_AUDIT.md](ASSET_AUDIT.md) for measured sizes, optimizations, and validation.

The Game Guide has four exclusive accordion sections and opens on How to Play.
Opening it pauses simulation and timers; closing resumes only if the game was
playing before the guide opened and the browser has not lost focus.

## Mobile performance

See [MOBILE_PERFORMANCE.md](MOBILE_PERFORMANCE.md) for device-specific asset generation, rendering budgets, measured build sizes, validation results and outstanding browser benchmarks.

Cash uses the existing in-session total, formatted as whole US dollars. Green $ pickups still add 1 and bonus villains add 3; restart/death still resets the session. There is no persisted gameplay total or storage key to migrate (only the audio preference is stored).
