import { BillboardLabel } from "../../ui/BillboardLabel";
import { roadPoint } from "../roadSurface";
import { useMemo } from "react";

type RoadDecal = { text: string; z: number; lateral: number; color: string; width: number; height: number; angle: number };

const decals: RoadDecal[] = [
  { text: "ACCESS DENIED", z: -42, lateral: -4.5, color: "#7f1d2b", width: 3.8, height: .64, angle: -.03 },
  { text: "FATAL ERROR", z: -78, lateral: 4.6, color: "#7f1d2b", width: 3.2, height: .62, angle: .02 },
  { text: "404 — PAGE NOT FOUND", z: -112, lateral: -4.3, color: "#7f1d2b", width: 5.4, height: .64, angle: .025 },
  { text: "SCRIPT FAILED", z: -142, lateral: 4.6, color: "#7f1d2b", width: 3.7, height: .56, angle: -.025 },
  { text: "503 — SERVICE UNAVAILABLE", z: -180, lateral: -4.2, color: "#7f1d2b", width: 5.2, height: .58, angle: .025 },
  { text: "RETRY", z: -212, lateral: 4.7, color: "#7f1d2b", width: 1.9, height: .52, angle: -.02 },
  { text: "CONNECTION LOST", z: -260, lateral: -4.5, color: "#7f1d2b", width: 4.2, height: .6, angle: -.02 },
  { text: "connection = null;", z: -294, lateral: 4.4, color: "#7f1d2b", width: 3.8, height: .42, angle: .02 },
  { text: "SYSTEM FAILURE", z: -360, lateral: -4.4, color: "#7f1d2b", width: 4.2, height: .62, angle: .025 },
];

export function RoadErrorDecals() {
  const mobile = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  const visible = useMemo(() => mobile ? decals.filter((_, index) => index % 2 === 0) : decals, [mobile]);

  return <group name="RoadErrorDecals">
    {visible.map((decal) => {
      const [x, y, z] = roadPoint(decal.lateral, decal.z, .02);
      return <group key={`${decal.text}-${decal.z}`} name={`FloatingRoadLabel:${decal.text}`} position={[x, y, z]}>
        <BillboardLabel
          color={decal.color}
          fontSize={Math.min(0.14, decal.height * 0.21)}
          maxWidth={decal.width * 0.54}
          position={[0, 0.95, 0]}
          outlineColor="#05070b"
          outlineWidth={0.018}
          extruded
        >
          {decal.text}
        </BillboardLabel>
      </group>;
    })}
  </group>;
}
