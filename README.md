# StudioCLTD

StudioCLTD is a lightweight third-person React Three Fiber game world for exploring StudioCLTD services, offers, tips, and showcase content. It contains eight main sections plus a separate teleport-only Home Base.

## Highlights

- Eight interactive sections tracked independently from `0/8`: Tips, Offers, Value, Quick Fix, Urgent Fix, Performance, Site Improvement, and Showcase.
- Third-person movement with WASD, keyboard arrows, and multi-touch on-screen arrows.
- Shoot/Fix mechanic using the one-shot `shoot` animation and a large yellow energy projectile.
- Movement locks during shooting, then crossfades directly into idle or run.
- Main villains advance section Progress through the existing Fix logic.
- Two roaming bonus villains award `+3` Points and respawn after 8–10 seconds without affecting Progress.
- Green Coin, yellow Speed, red Penalty, blue Contact, purple Share, and decorative black/white logos.
- Responsive Showcase and Home Base website-video screens.
- Compact responsive HUD with Progress, Points, Speed, D-pad, Fix, sound, guide, restart, and website controls.
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
| Shoot/Fix | `Space` or **FIX** |
| Game Guide | `1` or Info |
| Toggle sound | `2` or Sound |
| Full restart | `3` or Restart |
| Open website | `4` or Website |
| Enter game focus | Click/tap **Play** |
| Release pointer lock | `Esc` |

The centered crosshair indicates the firing direction. Held movement input resumes as soon as shooting finishes.

## Logo Guide

| Color | Purpose |
| --- | --- |
| Green `#3F7D3A` | Coin / Points |
| Yellow `#FACC15` | Speed Boost |
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
├── textures/       Home Base marble material maps
└── videos/         Responsive Showcase and website videos
```

## Character Asset and Animations

The player and villains share `public/characters/char-optimized.glb`, optimized to approximately 1.7 MB.

- Player: `idleH`, `runH`, `shoot`
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
- Keep bonus-villain Points separate from section Progress.
- Reuse shared projectile, collectible, trigger, material, and audio systems.
- Keep Contact and Share exclusively on Home Base.
- Clean up timers, listeners, video/audio playback, and Three.js resources on unmount.
- Avoid creating reusable Three.js objects inside `useFrame`.
- Preserve keyboard, pointer-lock, touch, multi-touch, and responsive HUD behavior.
- Run `npm run build` before deployment.

## Production Notes

- The 3D experience is lazy-loaded separately from the launch screen.
- Responsive videos and compressed WebP textures reduce mobile bandwidth.
- The Three.js renderer bundle can exceed Vite's default chunk-size advisory; this does not prevent a successful build.
