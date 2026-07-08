import {
  BackSide,
  Color,
  SRGBColorSpace,
} from "three";
import { useTexture } from "@react-three/drei";

export function SpaceSky() {
  const venusTexture = useTexture("/images/8k_venus_surface.jpg");
  const skyTexture = useTexture("/images/8k_stars_milky_way.jpg");
  venusTexture.colorSpace = SRGBColorSpace;
  skyTexture.colorSpace = SRGBColorSpace;

  return (
    <group>
      <mesh position={[0, 0, 0]} rotation={[0.12, 2.25, 0]} renderOrder={-1000} frustumCulled={false}>
        <sphereGeometry args={[5000, 128, 96]} />
        <meshBasicMaterial
          map={skyTexture}
          color="#6f7480"
          side={BackSide}
          depthWrite={false}
          depthTest={false}
          fog={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[58, 15, -138]} rotation={[0.08, -0.48, 0]}>
        <sphereGeometry args={[22, 96, 96]} />
        <meshStandardMaterial
          map={venusTexture}
          color={new Color("#ffbf6a")}
          emissive="#5d2414"
          emissiveIntensity={0.12}
          metalness={0}
          roughness={0.72}
          envMapIntensity={0.55}
        />
      </mesh>
      <mesh position={[58, 15, -138]} scale={[1.08, 1.08, 1.08]}>
        <sphereGeometry args={[22, 96, 96]} />
        <meshBasicMaterial color="#ffb75f" transparent opacity={0.16} depthWrite={false} side={BackSide} />
      </mesh>
    </group>
  );
}
