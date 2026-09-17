import { useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from 'three';
export const playerBaseTexturePath = '/images/optimized/skins/black-gold-base.png';
useTexture.preload(playerBaseTexturePath);
export function usePlayerBaseTexture() {
  const source = useTexture(playerBaseTexturePath);
  const anisotropy = useThree(state => Math.min(16, state.gl.capabilities.getMaxAnisotropy()));
  const texture = useMemo(() => {
    const map = source.clone();
    map.colorSpace = SRGBColorSpace;
    map.wrapS = map.wrapT = RepeatWrapping;
    map.minFilter = LinearMipmapLinearFilter;
    map.magFilter = LinearFilter;
    map.anisotropy = anisotropy;
    map.generateMipmaps = true;
    map.needsUpdate = true;
    return map;
  }, [source, anisotropy]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}
