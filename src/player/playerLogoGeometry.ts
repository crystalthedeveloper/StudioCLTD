import { DecalGeometry } from 'three-stdlib';
import { Euler, Mesh, SphereGeometry, Vector3 } from 'three';
import { playerSphereRadius } from './playerDimensions';

// One complete logo in the original atlas, with transparent padding on all sides.
export const logoAtlasRegion = { x: 0, y: 0, width: 500, height: 350, atlasSize: 1024 };
export function createPlayerLogoDecals() {
  const geometry = new SphereGeometry(playerSphereRadius, 48, 32);
  const target = new Mesh(geometry);
  target.updateMatrixWorld(true);
  const width = playerSphereRadius * 1.15;
  const size = new Vector3(width, width * logoAtlasRegion.height / logoAtlasRegion.width, playerSphereRadius * 0.6);
  const decals = Array.from({ length: 4 }, (_, index) => {
    const angle = index * Math.PI / 2;
    return new DecalGeometry(target,
      new Vector3(Math.sin(angle) * playerSphereRadius, 0, Math.cos(angle) * playerSphereRadius),
      new Euler(0, angle, 0), size);
  });
  geometry.dispose();
  return decals;
}
