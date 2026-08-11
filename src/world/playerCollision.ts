import { Object3D } from "three";

export function isPlayerObject(object?: Object3D | null) {
  let current = object;
  while (current) {
    if (current.name === "StudioCLTDPlayer") return true;
    current = current.parent;
  }
  return false;
}
