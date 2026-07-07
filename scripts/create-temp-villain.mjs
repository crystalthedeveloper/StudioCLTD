import { writeFileSync } from "node:fs";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";

globalThis.FileReader = class FileReader {
  onloadend = null;
  result = null;

  async readAsDataURL(blob) {
    const buffer = Buffer.from(await blob.arrayBuffer());
    this.result = `data:${blob.type || "application/octet-stream"};base64,${buffer.toString("base64")}`;
    this.onloadend?.();
  }

  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer();
    this.onloadend?.();
  }
};

const armorMaterial = new MeshStandardMaterial({
  color: new Color("#331421"),
  roughness: 0.48,
  metalness: 0.58,
});
const glowMaterial = new MeshStandardMaterial({
  color: new Color("#ff3545"),
  emissive: new Color("#cf1029"),
  emissiveIntensity: 1.8,
  roughness: 0.24,
  metalness: 0.1,
});
const hornMaterial = new MeshStandardMaterial({
  color: new Color("#d8c4a2"),
  roughness: 0.38,
  metalness: 0.08,
});

const villain = new Group();
villain.name = "StudioCLTD_Temp_Villain";

const torso = new Mesh(new CapsuleGeometry(0.48, 1.08, 8, 18), armorMaterial);
torso.name = "Villain_Torso";
torso.position.y = 1.18;
torso.scale.set(0.88, 1.05, 0.62);
villain.add(torso);

const head = new Mesh(new SphereGeometry(0.36, 24, 16), armorMaterial);
head.name = "Villain_Head";
head.position.y = 2.16;
head.scale.set(1, 1.02, 0.9);
villain.add(head);

const visor = new Mesh(new BoxGeometry(0.52, 0.11, 0.06), glowMaterial);
visor.name = "Villain_Visor";
visor.position.set(0, 2.19, -0.32);
villain.add(visor);

const core = new Mesh(new SphereGeometry(0.14, 16, 10), glowMaterial);
core.name = "Villain_Core";
core.position.set(0, 1.35, -0.4);
villain.add(core);

for (const side of [-1, 1]) {
  const horn = new Mesh(new ConeGeometry(0.08, 0.45, 7), hornMaterial);
  horn.name = side < 0 ? "Left_Horn" : "Right_Horn";
  horn.position.set(side * 0.22, 2.47, -0.02);
  horn.rotation.z = side * -0.35;
  villain.add(horn);

  const arm = new Mesh(new CapsuleGeometry(0.12, 0.84, 6, 12), armorMaterial);
  arm.name = side < 0 ? "Villain_Left_Arm" : "Villain_Right_Arm";
  arm.position.set(side * 0.58, 1.16, 0);
  arm.rotation.z = side * -0.28;
  villain.add(arm);

  const leg = new Mesh(new CapsuleGeometry(0.15, 0.84, 6, 12), armorMaterial);
  leg.name = side < 0 ? "Villain_Left_Leg" : "Villain_Right_Leg";
  leg.position.set(side * 0.19, 0.36, 0);
  villain.add(leg);

  const boot = new Mesh(new BoxGeometry(0.28, 0.13, 0.46), armorMaterial);
  boot.name = side < 0 ? "Villain_Left_Boot" : "Villain_Right_Boot";
  boot.position.set(side * 0.19, -0.08, -0.08);
  villain.add(boot);
}

villain.traverse((object) => {
  if (object instanceof Mesh) {
    object.castShadow = true;
    object.receiveShadow = true;
  }
});

const exporter = new GLTFExporter();
const gltf = await exporter.parseAsync(villain, { binary: false });
writeFileSync("public/models/temp-villain.gltf", JSON.stringify(gltf));
