# StudioCLTD

StudioCLTD is a lightweight third-person React Three Fiber game world for exploring StudioCLTD's services, website tips, offers, and showcase content. The current world uses a compact 3 × 3 city-block layout with a central plaza, eight interactive sections, and a clean comic-book art direction.

## Highlights

- Third-person character movement with keyboard and virtual trackpad controls.
- Pointer-lock game focus on desktop and touch-friendly controls on mobile.
- Central Plaza/Hub with straight paths to eight city blocks:
  - Tips
  - Offers
  - Value
  - Quick Fix
  - Urgent Fix
  - Performance
  - Site Improvement
  - Showcase
- Section progress HUD that advances from `0 / 8` to a trophy after every section is complete.
- Three independent Tips triggers for Navigation, Content, and Images.
- Interactive TVs with responsive mobile sizing and section-specific content.
- Villain Fix interactions, section voice lines, defeat audio, and milestone haptics on supported mobile devices.
- Green point, yellow speed-boost, red reset-penalty, and blue contact collectibles.
- Permanent decorative black and white CLD logos.
- Sound toggle persisted through `localStorage`.
- Bright blue sky, lightweight cartoon clouds, and textured spherical Earth and Venus.
- Shared comic-painted concrete styling across the ground, walkways, ramps, and platforms.
- Smooth loading progress that remains monotonic from 0% to 100%.

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

## Controls

| Action | Desktop | Mobile |
| --- | --- | --- |
| Move forward/backward | `W` / `S` or arrow keys | Virtual trackpad |
| Turn left/right | `A` / `D` or arrow keys | Virtual trackpad |
| Enter game focus | Click **Play** | Tap **Play** |
| Release pointer lock | `Esc` | Not applicable |
| Interact | Walk onto a trigger and use its displayed action | Same |

The HUD includes sound, restart, score, speed, and section-progress controls and indicators.

## Tech Stack

- React 18
- TypeScript
- Vite 5
- Three.js
- React Three Fiber
- Drei
- Rapier physics

## Project Structure

```text
src/
├── audio/          Shared sound state and villain audio
├── characters/     Shared character materials
├── player/         Controller, camera, animations, footsteps, and boosts
├── ui/             HUD, labels, dialogue, and loading interface
└── world/          Section configuration, terrain, triggers, and game systems

public/
├── audio/          Villain voices and defeat audio
├── characters/     Optimized shared character model
├── images/         TV, planet, logo, and environment assets
└── videos/         Showcase video
```

The game reuses shared geometries, materials, collision helpers, trigger visuals, and audio services to limit allocations and duplicate resource loading. Avoid creating Three.js objects inside `useFrame`; prefer module-level shared resources or memoized component resources with explicit cleanup.

## Character Asset

The player and villains use the shared model:

```text
public/characters/char-optimized.glb
```

Animation clips currently used by the game include:

- Player: `idleH`, `runH`
- Villain: `idleV`, `runV`, `dieV`

Villains face the player while active, stop tracking when defeated, and remain defeated until the relevant game state is reset.

## Audio

Section voice files are mapped as follows:

| Section | File |
| --- | --- |
| Urgent Fix | `Urgent-Fix.mp3` |
| Quick Fix | `Quick-Fix.mp3` |
| Site Improvement | `Site-Improvement.mp3` |
| Performance | `Performance.mp3` |
| Villain defeat | `defeat.mp3` |

Voice lines play once when entering an active villain's platform, stop on exit or defeat, and can replay after re-entry while the villain remains active. All audio respects the persisted HUD sound setting.

## Development

Install dependencies:

```bash
npm install
```

Start the local development server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Preview the production output:

```bash
npm run preview
```

The production build runs TypeScript before Vite and writes deployable files to `dist/`.

For a stricter unused-code check during maintenance:

```bash
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
```

## Maintenance Guidelines

- Preserve the eight section IDs and required-trigger mappings when changing section content.
- Record trigger completion by stable trigger ID so repeated activation cannot increment progress twice.
- Keep trigger animation scales relative to a fixed base scale; pointer-lock changes must never compound mesh scale.
- Reuse the shared sound setting and audio services so sounds do not stack or bypass mute state.
- Clean up timers, subscriptions, event listeners, audio playback, and generated Three.js resources on unmount.
- Keep platform colliders continuous with ramps and preserve the current city-block positions.
- Use lightweight meshes and textures; avoid expensive volumetrics and screen-space post-processing.
- Test both keyboard/pointer-lock and touch/trackpad flows after interaction changes.

## Production Notes

- The main game world is lazy-loaded separately from the initial application shell.
- The Three.js/R3F renderer bundle may exceed Vite's default chunk-size advisory. This is expected for the renderer, physics, models, and world systems and does not prevent a successful production build.
- Run `npm run build` before deployment to catch TypeScript and bundling errors.
