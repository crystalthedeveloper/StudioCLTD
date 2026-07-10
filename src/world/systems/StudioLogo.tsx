import { useGLTF } from "@react-three/drei";
import { useEffect } from "react";
import { Color, Mesh, MeshStandardMaterial } from "three";

const logoPath = "/logo/logo-optimized.glb";
const powerUpColor = "#facc15";

const goldMaterial = new MeshStandardMaterial({
  color: new Color(powerUpColor),
  metalness: 0.82,
  roughness: 0.32,
  emissive: new Color(powerUpColor),
  emissiveIntensity: 0.18,
  envMapIntensity: 0.85,
});

export function StudioLogo() {
  const { scene } = useGLTF(logoPath);

  useEffect(() => {
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;

      object.material = goldMaterial;
      object.castShadow = false;
      object.receiveShadow = false;
    });
  }, [scene]);

  return (
    <primitive
      object={scene}
      name="StudioCLTDLogo"
      position={[3.2, 0.04, 5.5]}
      rotation={[0, -0.35, 0]}
      scale={2}
      dispose={null}
    />
  );
}

useGLTF.preload(logoPath);
