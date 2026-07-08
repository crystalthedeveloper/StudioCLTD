# StudioCLTD

StudioCLTD is a React Three Fiber open-world hub for the StudioCLTD universe. The scene is built as a dark cinematic sci-fi platform in space with third-person movement, interactive section areas, villains, trigger portals, offer previews, and a Showcase video screen.

## Tech Stack

- React 18
- Vite
- TypeScript
- Three.js
- React Three Fiber
- Drei
- Rapier physics

## Features

- Third-person player controller with smooth camera follow.
- Keyboard and on-screen trackpad movement controls.
- Pointer-lock focused game mode.
- Reflective sci-fi floor platform with fall respawn.
- Milky Way skybox, Venus planet, cinematic lighting, and bloom.
- Hub sections:
  - Tips
  - Offers
  - Value
  - Quick Fix
  - Urgent Fix
  - Performance
  - Site Improvement
  - Showcase
- Offers section with portal pads that update the Offers TV screen.
- Showcase section with a trigger pad that plays `public/videos/showcase.mp4` on the Showcase TV.
- Service-section villains and clean portal trigger pads.
- Quick Fix interaction:
  - Starts with `quick-fix-bad.png`.
  - Trigger pad plays the villain `dieV` animation once.
  - Screen changes to `quick-fix-good.png`.

## Characters

The project uses one shared character GLB:

```text
public/characters/char.glb
```

Player animations:

- `idleH`
- `runH`

Villain animations:

- `idleV`
- `runV`
- `dieV`

Material mapping:

- Player body: `WhiteClown_material`
- Player mask: `LogoMaterial`
- Villain body: `VWhiteClown_material`
- Villain mask: `LogoVMaterial`

Villains face the player while alive, rotate only on the Y axis, and stop rotating when their death animation begins.

## Assets

Key public assets:

```text
public/characters/char.glb
public/images/8k_stars_milky_way.jpg
public/images/8k_venus_surface.jpg
public/images/offers/
public/images/quickFix/
public/videos/showcase.mp4
```

## Development

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Notes

- Keep the skybox visual-only. Scene lighting is handled separately.
- Keep the floor collider smooth and flat so player movement stays stable.
- Avoid adding noisy per-frame console logs. The only intentional runtime console check is the character material existence check.
- Use reusable section, trigger, character, and world-system components for future districts.
