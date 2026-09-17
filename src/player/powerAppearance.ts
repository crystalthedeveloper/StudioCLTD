import { Color, type MeshPhysicalMaterial } from "three";
import { powerModes, powerOrder } from "./temporaryPowers";
import { speedBoostColor } from "./speedBoost";
import { playerSphereRadius } from "./playerDimensions";

/** Equal-area latitude bands roll with the sphere; the logo uses its own material. */
export function createPowerAppearance() {
  const uniforms = {
    powerCount: { value: 0 }, speedActive: { value: 0 },
    powerColors: { value: [new Color(), new Color(), new Color()] },
    speedColor: { value: new Color(speedBoostColor) },
    inactiveColor: { value: new Color("#20232b") },
    sphereRadius: { value: playerSphereRadius },
  };
  const update = (mask: number, speed: boolean) => {
    let count = 0;
    powerOrder.forEach((mode, i) => { if (mask & (1 << i)) uniforms.powerColors.value[count++].set(powerModes[mode].color); });
    uniforms.powerCount.value = count;
    uniforms.speedActive.value = speed ? 1 : 0;
  };
  const compile: MeshPhysicalMaterial["onBeforeCompile"] = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `varying float vPowerHeight;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPowerHeight = position.y;');
    shader.fragmentShader = `varying float vPowerHeight;
      uniform float powerCount; uniform float speedActive; uniform float sphereRadius;
      uniform vec3 powerColors[3]; uniform vec3 speedColor; uniform vec3 inactiveColor;
      ${shader.fragmentShader}`.replace('#include <color_fragment>', `#include <color_fragment>
        float latitude = clamp((vPowerHeight / sphereRadius + 1.0) * 0.5, 0.0, 0.99999);
        vec3 stateColor = inactiveColor;
        if (speedActive > 0.5 && (powerCount < 0.5 || latitude >= 0.5)) stateColor = speedColor;
        else if (powerCount > 0.5) {
          float index = floor(latitude * (speedActive > 0.5 ? 2.0 : 1.0) * powerCount);
          stateColor = index < 0.5 ? powerColors[0] : index < 1.5 ? powerColors[1] : powerColors[2];
        }
        diffuseColor.rgb *= stateColor;
      `);
  };
  return { uniforms, update, compile };
}
