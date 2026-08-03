import { Outlines } from "@react-three/drei";
import { createPortal } from "@react-three/fiber";
import { Fragment, useMemo } from "react";
import { Mesh, Object3D } from "three";
import { ENABLE_OUTLINES, interactiveOutlineConfig } from "./interactiveOutlineConfig";

export function InteractiveMeshOutline() {
  if (!ENABLE_OUTLINES) return null;

  return (
    <Outlines
      angle={0}
      color={interactiveOutlineConfig.color}
      thickness={interactiveOutlineConfig.thicknessPx}
      toneMapped={false}
    />
  );
}

export function InteractiveOutline({ object }: { object: Object3D }) {
  const meshes = useMemo(() => {
    const result: Mesh[] = [];
    object.traverse((child) => {
      if (child instanceof Mesh) result.push(child);
    });
    return result;
  }, [object]);

  if (!ENABLE_OUTLINES) return null;

  return (
    <>
      {meshes.map((mesh) => (
        <Fragment key={mesh.uuid}>
          {createPortal(
            <InteractiveMeshOutline />,
            mesh,
          )}
        </Fragment>
      ))}
    </>
  );
}
