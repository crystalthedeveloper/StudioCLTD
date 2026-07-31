import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { Color, Group, Material, Mesh, MeshStandardMaterial, Object3D } from "three";

const logoPath = "/logo/logo-optimized.glb";
const brandYellow = "#facc15";
const floorLogoScale = 1.5;
const floorLogoY = 0.04;
const worldLogoRotation = -0.35;

type LogoLight = {
  position: [number, number];
  style: "yellow" | "white";
};

const logoLights: LogoLight[] = [
  { position: [-18, -14], style: "yellow" },
  { position: [16, -23], style: "white" },
  { position: [-31, 18], style: "yellow" },
  { position: [34, 12], style: "white" },
  { position: [7, 34], style: "yellow" },
  { position: [-42, -32], style: "white" },
  { position: [43, -41], style: "yellow" },
  { position: [-8, 48], style: "white" },
  { position: [55, 31], style: "yellow" },
  { position: [-58, 6], style: "white" },
];

function makeEmissiveMaterial(source: Material, color: string, intensity: number) {
  const material = source.clone();

  if (material instanceof MeshStandardMaterial) {
    material.color = new Color(color);
    material.emissive = new Color(color);
    material.emissiveIntensity = intensity;
    material.metalness = 0.08;
    material.roughness = 0.38;
    material.toneMapped = false;
    material.needsUpdate = true;
  }

  return material;
}

function createLogoTemplate(source: Group, color: string, intensity: number) {
  // Clone the complete GLB hierarchy. Geometry and every imported child transform
  // remain untouched; only cloned materials are changed for the light style.
  const logo = source.clone(true);

  logo.traverse((object: Object3D) => {
    if (!(object instanceof Mesh)) return;

    object.material = Array.isArray(object.material)
      ? object.material.map((material) => makeEmissiveMaterial(material, color, intensity))
      : makeEmissiveMaterial(object.material, color, intensity);
    object.castShadow = false;
    object.receiveShadow = false;
  });

  return logo;
}

export function LogoLightField() {
  const { scene } = useGLTF(logoPath);
  const yellowTemplate = useMemo(() => createLogoTemplate(scene, brandYellow, 2.4), [scene]);
  const whiteTemplate = useMemo(() => createLogoTemplate(scene, "#ffffff", 2.1), [scene]);

  const logos = useMemo(
    () =>
      logoLights.map((light) => ({
        ...light,
        object: (light.style === "yellow" ? yellowTemplate : whiteTemplate).clone(true),
      })),
    [yellowTemplate, whiteTemplate],
  );

  return (
    <group name="EnvironmentLogoLights">
      {logos.map((logo) => (
        <primitive
          key={`${logo.position[0]}:${logo.position[1]}`}
          object={logo.object}
          position={[logo.position[0], floorLogoY, logo.position[1]]}
          rotation={[0, worldLogoRotation, 0]}
          scale={floorLogoScale}
          dispose={null}
        />
      ))}
    </group>
  );
}

useGLTF.preload(logoPath);
