import { CuboidCollider } from "@react-three/rapier";
import { useMemo } from "react";
import { CanvasTexture, Color, DoubleSide, MeshStandardMaterial, RepeatWrapping } from "three";

type ModularTerrainProps = {
  radius: number;
};

function createPanelTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#171c26";
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = "#4a5061";
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 492, 492);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#6b768d";

  for (let i = 0; i <= 512; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  ctx.fillStyle = "#45ecff";
  for (let i = 0; i < 18; i += 1) {
    const x = 38 + ((i * 83) % 438);
    const y = 42 + ((i * 137) % 420);
    ctx.fillRect(x, y, 28, 3);
  }

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(1, 1);
  return texture;
}

export function ModularTerrain({ radius }: ModularTerrainProps) {
  const panelTexture = useMemo(createPanelTexture, []);
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color("#293141"),
        map: panelTexture,
        roughness: 0.24,
        metalness: 0.86,
        envMapIntensity: 0,
      }),
    [panelTexture]
  );

  const panels = useMemo(() => {
    const items: { x: number; z: number; y: number; key: string }[] = [];
    for (let x = -radius; x <= radius; x += 1) {
      for (let z = -radius; z <= radius; z += 1) {
        const distance = Math.hypot(x, z);
        const elevation = distance < 2 ? 0 : Math.sin(x * 1.7 + z * 0.8) * 0.08;
        items.push({ x: x * 10, z: z * 10, y: elevation, key: `${x}:${z}` });
      }
    }
    return items;
  }, [radius]);

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.08, 0]} receiveShadow>
        <planeGeometry args={[900, 900, 1, 1]} />
        <meshStandardMaterial color="#141924" metalness={0.88} roughness={0.26} envMapIntensity={0} side={DoubleSide} />
      </mesh>
      <CuboidCollider position={[0, -0.16, 0]} args={[450, 0.08, 450]} />
      {panels.map((panel) => (
        <group key={panel.key} position={[panel.x, panel.y, panel.z]}>
          <mesh rotation-x={-Math.PI / 2} receiveShadow material={material}>
            <boxGeometry args={[9.75, 9.75, 0.18]} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.1, 0]}>
            <ringGeometry args={[2.65, 2.72, 4]} />
            <meshBasicMaterial color="#4cf4ff" transparent opacity={0.08} />
          </mesh>
        </group>
      ))}
      <mesh position={[28, 1.1, -18]} receiveShadow castShadow>
        <boxGeometry args={[24, 2, 14]} />
        <meshStandardMaterial color="#303848" roughness={0.24} metalness={0.82} />
      </mesh>
      <CuboidCollider position={[28, 1.1, -18]} args={[12, 1, 7]} />
      <mesh position={[-34, 0.8, 24]} receiveShadow castShadow>
        <boxGeometry args={[18, 1.4, 22]} />
        <meshStandardMaterial color="#2d3545" roughness={0.24} metalness={0.82} />
      </mesh>
      <CuboidCollider position={[-34, 0.8, 24]} args={[9, 0.7, 11]} />
      <mesh position={[5, 1.65, -43]} receiveShadow castShadow>
        <boxGeometry args={[34, 3.1, 12]} />
        <meshStandardMaterial color="#333c4d" roughness={0.23} metalness={0.82} />
      </mesh>
      <CuboidCollider position={[5, 1.65, -43]} args={[17, 1.55, 6]} />
    </group>
  );
}
