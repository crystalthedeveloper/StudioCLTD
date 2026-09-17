import { useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { ClampToEdgeWrapping, LinearFilter, LinearMipmapLinearFilter, MeshStandardMaterial, NoColorSpace, SRGBColorSpace, Vector2 } from 'three';
import { createPlayerLogoDecals, logoAtlasRegion } from './playerLogoGeometry';

const logoPaths = ['/images/optimized/skins/logo-skin.webp', '/images/optimized/skins/NormalMap.png'];
useTexture.preload(logoPaths);

/** Four planar-projected decals attached to the rolling mesh, never to the camera. */
export function PlayerLogoOverlay() {
  const sources = useTexture(logoPaths);
  const anisotropy = useThree(state => Math.min(16, state.gl.capabilities.getMaxAnisotropy()));
  const geometries = useMemo(createPlayerLogoDecals, []);
  const resources = useMemo(() => {
    const maps = sources.map((source, index) => {
      const map = source.clone();
      const { x, y, width, height, atlasSize } = logoAtlasRegion;
      map.colorSpace = index === 0 ? SRGBColorSpace : NoColorSpace;
      map.wrapS = map.wrapT = ClampToEdgeWrapping;
      map.repeat.set(width / atlasSize, height / atlasSize);
      map.offset.set(x / atlasSize, 1 - (y + height) / atlasSize);
      map.rotation = 0;
      map.flipY = sources[0].flipY;
      map.anisotropy = anisotropy;
      map.minFilter = LinearMipmapLinearFilter;
      map.magFilter = LinearFilter;
      map.generateMipmaps = true;
      map.needsUpdate = true;
      return map;
    });
    const material = new MeshStandardMaterial({ map: maps[0], normalMap: maps[1], color: '#ffffff',
      transparent: true, alphaTest: 0.01, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      roughness: 0.28, metalness: 0.15, normalScale: new Vector2(0.3, 0.3) });
    return { maps, material };
  }, [sources, anisotropy]);
  useEffect(() => () => { resources.maps.forEach(map => map.dispose()); resources.material.dispose(); }, [resources]);
  useEffect(() => () => geometries.forEach(geometry => geometry.dispose()), [geometries]);
  return <group name="Player equatorial logos" dispose={null}>
    {geometries.map((geometry, index) => <mesh key={index} geometry={geometry} material={resources.material}
      renderOrder={1} onUpdate={mesh => mesh.layers.enable(2)} />)}
  </group>;
}
