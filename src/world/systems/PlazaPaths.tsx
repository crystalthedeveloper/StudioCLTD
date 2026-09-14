import { useEffect, useMemo } from 'react';
import { MeshStandardMaterial, type Texture } from 'three';
import { createPathGeometry } from '../pathGeometry';

export function PlazaPaths({ textures }: { textures: Texture[] }) {
  const geometry = useMemo(createPathGeometry, []);
  const material = useMemo(() => new MeshStandardMaterial({
    color: '#8c9da7', map: textures[0], roughnessMap: textures[2], roughness: 1,
    metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  }), [textures]);
  useEffect(() => () => { geometry.dispose(); }, [geometry]);
  useEffect(() => () => { material.dispose(); }, [material]);
  return <mesh name="CentralPlazaAndWalkingLoop" position={[0, 0.012, 0]}
    geometry={geometry} material={material} receiveShadow raycast={() => {}} />;
}
