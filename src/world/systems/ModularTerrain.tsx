import { CuboidCollider } from "@react-three/rapier";
import { useMemo } from "react";
import { CanvasTexture, Color, MeshStandardMaterial, RepeatWrapping } from "three";

type ModularTerrainProps = {
  radius: number;
};

function createPanelTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#171c26";
  ctx.fillRect(0, 0, 1024, 1024);

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  return texture;
}

export function ModularTerrain({ radius }: ModularTerrainProps) {
  const panelTexture = useMemo(createPanelTexture, []);
  const platformSize = radius * 20 + 10;
  panelTexture.repeat.set(platformSize / 20, platformSize / 20);
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color("#293141"),
        map: panelTexture,
        roughness: 0.2,
        metalness: 0.9,
        envMapIntensity: 0.68,
      }),
    [panelTexture]
  );

  return (
    <group name="SmoothSciFiFloor">
      <CuboidCollider position={[0, -0.09, 0]} args={[platformSize / 2, 0.09, platformSize / 2]} friction={0} restitution={0} />
      <mesh rotation-x={-Math.PI / 2} material={material}>
        <planeGeometry args={[platformSize, platformSize, 1, 1]} />
      </mesh>
    </group>
  );
}
