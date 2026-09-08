import { useEffect, useRef } from "react";
import { Color, Group, Mesh, MeshStandardMaterial, Object3D, Quaternion, Vector3 } from "three";
import { gameNow } from "../player/gameFocus";
import { useGameFrame } from "../player/useGameFrame";
import { powerModes, type PowerMode } from "../player/temporaryPowers";

const reactions = new Map<string, (mode: PowerMode, direction: Vector3) => void>();
export function reactToVillainHit(id: string, mode: PowerMode, direction: Vector3) {
  reactions.get(id)?.(mode, direction);
}

/** An isolated visual recoil keeps navigation on safe ground and keeps the impact reaction on the body. */
export function useVillainHitReaction(id: string, scene: Object3D) {
  const group = useRef<Group>(null);
  const until = useRef(-Infinity);
  const direction = useRef(new Vector3());
  const flash = useRef(new Color());
  const materials = useRef<{ material: MeshStandardMaterial; emissive: Color; intensity: number }[]>([]);

  useEffect(() => {
    const slots: { mesh: Mesh; original: Mesh["material"] }[] = [];
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      slots.push({ mesh: object, original: object.material });
      const copies = (Array.isArray(object.material) ? object.material : [object.material]).map((source) => {
        const material = source.clone();
        if (material instanceof MeshStandardMaterial) materials.current.push({ material, emissive: material.emissive.clone(), intensity: material.emissiveIntensity });
        return material;
      });
      object.material = Array.isArray(object.material) ? copies : copies[0];
    });
    reactions.set(id, (mode, incoming) => {
      until.current = gameNow() + 220;
      flash.current.set(powerModes[mode].color);
      direction.current.copy(incoming).setY(0).normalize();
      const parent = group.current?.parent;
      if (parent) direction.current.applyQuaternion(parent.getWorldQuaternion(new Quaternion()).invert());
    });
    return () => {
      reactions.delete(id);
      slots.forEach(({ mesh, original }) => {
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => material.dispose());
        mesh.material = original;
      });
      materials.current = [];
    };
  }, [id, scene]);

  useGameFrame(() => {
    const remaining = Math.max(0, until.current - gameNow());
    const progress = 1 - remaining / 220;
    const recoil = remaining > 0 ? Math.sin(Math.PI * progress) : 0;
    if (group.current) {
      group.current.position.copy(direction.current).multiplyScalar(recoil * 0.14);
      group.current.rotation.set(direction.current.z * recoil * 0.09, 0, -direction.current.x * recoil * 0.09);
    }
    materials.current.forEach(({ material, emissive, intensity }) => {
      const strength = Math.max(0, 1 - progress * 2);
      material.emissive.copy(emissive).lerp(flash.current, strength);
      material.emissiveIntensity = intensity + strength * 0.85;
    });
  });
  return { group, active: () => gameNow() < until.current };
}
