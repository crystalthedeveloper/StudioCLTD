import { useEffect, useMemo } from 'react';
import { type MeshStandardMaterial } from 'three';
import { createPathGeometry } from '../pathGeometry';

export function PlazaPaths({ material }: { material: MeshStandardMaterial }) {
  const geometry = useMemo(createPathGeometry, []);
  useEffect(() => () => { geometry.dispose(); }, [geometry]);
  return <mesh name="CentralPlazaAndWalkingLoop" position={[0, 0.012, 0]}
    geometry={geometry} material={material} receiveShadow raycast={() => {}} />;
}
