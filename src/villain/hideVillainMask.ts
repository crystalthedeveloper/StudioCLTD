import { Object3D } from "three";

export function hideVillainMask(root: Object3D) {
  root.traverse((object) => {
    if (object.name === "Mask") {
      object.visible = false;
    }
  });
}
