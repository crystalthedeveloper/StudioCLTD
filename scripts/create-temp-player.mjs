import { writeFileSync } from "node:fs";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
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

const bodyMaterial = new MeshStandardMaterial({
  color: new Color("#1d2537"),
  roughness: 0.44,
  metalness: 0.62,
});
const accentMaterial = new MeshStandardMaterial({
  color: new Color("#67f7ff"),
  emissive: new Color("#1bc7dc"),
  emissiveIntensity: 1.8,
  roughness: 0.24,
  metalness: 0.2,
});
const visorMaterial = new MeshStandardMaterial({
  color: new Color("#ff4fd8"),
  emissive: new Color("#bd1f8f"),
  emissiveIntensity: 1.4,
  roughness: 0.18,
  metalness: 0.1,
});

const character = new Group();
character.name = "StudioCLTD_Temp_Player";

const torso = new Mesh(new CapsuleGeometry(0.42, 0.95, 8, 18), bodyMaterial);
torso.name = "Torso";
torso.position.y = 1.15;
torso.scale.set(0.82, 1, 0.58);
character.add(torso);

const helmet = new Mesh(new SphereGeometry(0.34, 24, 16), bodyMaterial);
helmet.name = "Helmet";
helmet.position.y = 2.06;
helmet.scale.set(1, 1.08, 0.9);
character.add(helmet);

const visor = new Mesh(new BoxGeometry(0.48, 0.12, 0.05), visorMaterial);
visor.name = "Visor";
visor.position.set(0, 2.08, -0.31);
character.add(visor);

const chestLight = new Mesh(new BoxGeometry(0.22, 0.08, 0.04), accentMaterial);
chestLight.name = "Chest_Light";
chestLight.position.set(0, 1.36, -0.36);
character.add(chestLight);

for (const side of [-1, 1]) {
  const arm = new Mesh(new CapsuleGeometry(0.11, 0.72, 6, 12), bodyMaterial);
  arm.name = side < 0 ? "Left_Arm" : "Right_Arm";
  arm.position.set(side * 0.5, 1.17, 0);
  arm.rotation.z = side * -0.22;
  character.add(arm);

  const leg = new Mesh(new CapsuleGeometry(0.13, 0.78, 6, 12), bodyMaterial);
  leg.name = side < 0 ? "Left_Leg" : "Right_Leg";
  leg.position.set(side * 0.17, 0.35, 0);
  character.add(leg);

  const boot = new Mesh(new BoxGeometry(0.24, 0.12, 0.42), bodyMaterial);
  boot.name = side < 0 ? "Left_Boot" : "Right_Boot";
  boot.position.set(side * 0.17, -0.08, -0.07);
  character.add(boot);
}

character.traverse((object) => {
  if (object instanceof Mesh) {
    object.castShadow = true;
    object.receiveShadow = true;
  }
});

const exporter = new GLTFExporter();
const gltf = await exporter.parseAsync(character, { binary: false });
writeFileSync("public/models/temp-player.gltf", JSON.stringify(gltf));
