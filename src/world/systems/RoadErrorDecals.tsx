import { useEffect, useMemo } from "react";
import { CanvasTexture, DoubleSide, MeshBasicMaterial, SRGBColorSpace } from "three";
import { roadHalfWidth, roadPoint, roadTangent } from "../roadSurface";

type RoadDecal = { text: string; z: number; lateral: number; color: string; width: number; height: number; angle: number };

const decals: RoadDecal[] = [
  { text: "ACCESS DENIED", z: -42, lateral: -4.5, color: "#7f1d2b", width: 3.8, height: .64, angle: -.03 },
  { text: "FATAL ERROR", z: -78, lateral: 4.6, color: "#7f1d2b", width: 3.2, height: .62, angle: .02 },
  { text: "404 — PAGE NOT FOUND", z: -112, lateral: -4.3, color: "#c6c0ad", width: 5.4, height: .64, angle: .025 },
  { text: "SCRIPT FAILED", z: -142, lateral: 4.6, color: "#c6c0ad", width: 3.7, height: .56, angle: -.025 },
  { text: "503 — SERVICE UNAVAILABLE", z: -180, lateral: -4.2, color: "#7f1d2b", width: 5.2, height: .58, angle: .025 },
  { text: "RETRY", z: -212, lateral: 4.7, color: "#c6c0ad", width: 1.9, height: .52, angle: -.02 },
  { text: "CONNECTION LOST", z: -260, lateral: -4.5, color: "#c6c0ad", width: 4.2, height: .6, angle: -.02 },
  { text: "connection = null;", z: -294, lateral: 4.4, color: "#c6c0ad", width: 3.8, height: .42, angle: .02 },
  { text: "SYSTEM FAILURE", z: -360, lateral: -4.4, color: "#7f1d2b", width: 4.2, height: .62, angle: .025 },
];

function makeDecalTexture(text: string, color: string, mobile: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = mobile ? 512 : 768;
  canvas.height = mobile ? 96 : 128;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = `800 ${mobile ? 42 : 56}px Arial Narrow, Arial, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = color;
  context.globalAlpha = .66;
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  context.globalAlpha = .18;
  context.strokeStyle = "#11151d";
  context.lineWidth = 2;
  for (let x = 14; x < canvas.width; x += 43) context.strokeRect(x, 10, 1, canvas.height - 20);
  context.globalAlpha = .28;
  context.lineWidth = 5;
  for (let index = 0; index < 14; index += 1) {
    const x = (index * 97 + text.length * 13) % canvas.width;
    const y = 18 + ((index * 31) % Math.max(20, canvas.height - 36));
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(Math.min(canvas.width, x + 16 + (index % 4) * 9), y + (index % 2 ? 3 : -3));
    context.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function RoadErrorDecals() {
  const mobile = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  const visible = useMemo(() => mobile ? decals.filter((_, index) => index % 2 === 0) : decals, [mobile]);
  const resources = useMemo(() => visible.map((decal) => {
    const texture = makeDecalTexture(decal.text, decal.color, mobile);
    return { texture, material: texture ? new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }) : null };
  }), [mobile, visible]);
  useEffect(() => () => {
    resources.forEach(({ texture, material }) => {
      material?.dispose();
      texture?.dispose();
    });
  }, [resources]);

  return <group name="RoadErrorDecals">
    {visible.map((decal, index) => {
      const lateral = Math.max(-roadHalfWidth + decal.width / 2 + .35, Math.min(roadHalfWidth - decal.width / 2 - .35, decal.lateral));
      const [x, y, z] = roadPoint(lateral, decal.z, .08);
      const tangent = roadTangent(decal.z);
      // Face the driving camera: the road plane's natural orientation reads
      // backward from the player approach, so turn the painted text around.
      const yaw = Math.atan2(tangent[0], tangent[1]) + Math.PI + decal.angle;
      const resource = resources[index];
      if (!resource.material) return null;
      return <mesh key={`${decal.text}-${decal.z}`} position={[x, y, z]} rotation={[-Math.PI / 2, yaw, 0]} renderOrder={5} raycast={() => {}}>
        <planeGeometry args={[decal.width, decal.height]} />
        <primitive object={resource.material} attach="material" />
      </mesh>;
    })}
  </group>;
}
