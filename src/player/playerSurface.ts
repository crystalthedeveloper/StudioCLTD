import type { MeshStandardMaterial } from "three";
import { playerSphereRadius } from "./playerDimensions";

/** Object-space projections avoid latitude/longitude pinching at sphere poles.
 * Both colour and tangent normals use the same projections and roll with the mesh. */
export const configurePlayerSurface: MeshStandardMaterial["onBeforeCompile"] = (shader) => {
  shader.uniforms.playerSurfaceScale = { value: 1 / (2 * playerSphereRadius) };
  shader.vertexShader = `varying vec3 vPlayerPosition;\nvarying vec3 vPlayerNormal;\n${shader.vertexShader}`
    .replace("#include <begin_vertex>", `#include <begin_vertex>
      vPlayerPosition = position;
      vPlayerNormal = normal;`);
  shader.fragmentShader = `
    varying vec3 vPlayerPosition;
    varying vec3 vPlayerNormal;
    uniform float playerSurfaceScale;
    uniform mat3 normalMatrix;
    ${shader.fragmentShader}`
    .replace("#include <map_fragment>", `
      vec3 pn = normalize(vPlayerNormal);
      vec3 ps = sign(pn);
      vec3 pw = pow(abs(pn), vec3(8.0));
      pw /= max(pw.x + pw.y + pw.z, 0.0001);
      vec3 pp = vPlayerPosition * playerSurfaceScale;
      vec2 px = vec2(-pp.z * ps.x, pp.y) + 0.5;
      vec2 py = vec2(pp.x, -pp.z * ps.y) + 0.5;
      vec2 pz = vec2(pp.x * ps.z, pp.y) + 0.5;
      #ifdef USE_MAP
        diffuseColor *= texture2D(map, px) * pw.x
          + texture2D(map, py) * pw.y + texture2D(map, pz) * pw.z;
      #endif`)
    .replace("#include <normal_fragment_maps>", `
      #ifdef USE_NORMALMAP
        vec3 nx = texture2D(normalMap, px).xyz * 2.0 - 1.0;
        vec3 ny = texture2D(normalMap, py).xyz * 2.0 - 1.0;
        vec3 nz = texture2D(normalMap, pz).xyz * 2.0 - 1.0;
        nx.xy *= normalScale; ny.xy *= normalScale; nz.xy *= normalScale;
        vec3 tx = normalize(pn * nx.z + vec3(0.0, nx.y, -nx.x * ps.x));
        vec3 ty = normalize(pn * ny.z + vec3(ny.x, 0.0, -ny.y * ps.y));
        vec3 tz = normalize(pn * nz.z + vec3(nz.x * ps.z, nz.y, 0.0));
        normal = normalize(normalMatrix * normalize(tx * pw.x + ty * pw.y + tz * pw.z));
      #endif`);
};
