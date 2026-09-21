import { createPortal, useFrame, useThree } from "@react-three/fiber";
import { useRapier } from "@react-three/rapier";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Color, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Mesh, Object3D,
  PlaneGeometry, Quaternion, ShaderMaterial, Vector3 } from "three";
import { isGameFocused, subscribeGameFocus } from "./gameFocus";
import { playerSphereRadius as radius } from "./playerDimensions";
import { createRollingMotion } from "./rollingMotion";
import { WINTER_THEME_ENABLED } from "../world/winterTheme";
import { isCompactVisualBudget } from "../world/visualQuality";

function softMaterial(color: string, instanced: boolean) {
  return new ShaderMaterial({
    uniforms: { tint: { value: new Color(color) }, opacity: { value: 1 } },
    vertexShader: `varying vec2 vUv; varying float vOpacity;
      ${instanced ? 'attribute float instanceOpacity;' : 'uniform float opacity;'}
      void main() {
        vUv = uv; vOpacity = ${instanced ? 'instanceOpacity' : 'opacity'};
        gl_Position = projectionMatrix * modelViewMatrix * ${instanced ? 'instanceMatrix *' : ''} vec4(position, 1.0);
      }`,
    fragmentShader: `uniform vec3 tint; varying vec2 vUv; varying float vOpacity;
      void main() {
        float r = length(vUv * 2.0 - 1.0);
        float grain = 0.72 + 0.28 * sin(vUv.x * 19.0 + sin(vUv.y * 13.0)) * sin(vUv.y * 17.0);
        float alpha = (1.0 - smoothstep(0.05, 1.0, r)) * vOpacity * grain;
        if (alpha < 0.002) discard;
        gl_FragColor = vec4(tint, alpha);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
}
function makePool(count: number, color: string) {
  const geometry = new PlaneGeometry(1, 1);
  const opacity = new InstancedBufferAttribute(new Float32Array(count), 1).setUsage(DynamicDrawUsage);
  geometry.setAttribute("instanceOpacity", opacity);
  return { geometry, opacity, material: softMaterial(color, true), cursor: 0,
    items: Array.from({ length: count }, () => ({ age: 1, life: 0, size: 0,
      position: new Vector3(), velocity: new Vector3(), rotation: new Quaternion() })) };
}

/** World-space visuals only: never changes the body, collider, or movement. */
export function PlayerRollingEffects({ sphere }: { sphere: RefObject<Object3D> }) {
  const scene = useThree(state => state.scene);
  const { world, rapier } = useRapier();
  const shadow = useRef<Mesh>(null);
  const puffs = useRef<InstancedMesh>(null);
  const trail = useRef<InstancedMesh>(null);
  const compact = useMemo(isCompactVisualBudget, []);
  const resources = useMemo(() => ({
    puffs: makePool(compact ? 12 : 24, WINTER_THEME_ENABLED ? "#edf4fa" : "#bca98f"),
    trail: makePool(compact ? 12 : 24, WINTER_THEME_ENABLED ? "#657480" : "#51463b"),
    shadowGeometry: new PlaneGeometry(1, 1), shadowMaterial: softMaterial("#121722", false),
  }), []);
  const motion = useMemo(() => ({
    rolling: createRollingMotion(), position: new Vector3(), previous: new Vector3(),
    normal: new Vector3(0, 1, 0), up: new Vector3(0, 1, 0), forward: new Vector3(0, 0, 1),
    direction: new Vector3(), previousDirection: new Vector3(), contact: new Vector3(),
    rotation: new Quaternion(), transform: new Object3D(),
    ray: new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }),
    initialized: false, grounded: false, speed: 0, spacing: 0,
  }), [rapier]);
  const clear = () => {
    for (const pool of [resources.puffs, resources.trail]) {
      pool.items.forEach(item => { item.life = 0; });
      pool.opacity.array.fill(0);
      pool.opacity.needsUpdate = true;
    }
    motion.spacing = 0;
  };
  useEffect(() => {
    puffs.current?.instanceMatrix.setUsage(DynamicDrawUsage);
    trail.current?.instanceMatrix.setUsage(DynamicDrawUsage);
    const unsubscribe = subscribeGameFocus(() => {
      clear(); motion.rolling.reset(); motion.initialized = false; motion.speed = 0;
    });
    return () => {
      unsubscribe();
      for (const pool of [resources.puffs, resources.trail]) { pool.geometry.dispose(); pool.material.dispose(); }
      resources.shadowGeometry.dispose(); resources.shadowMaterial.dispose();
    };
  }, [resources, motion]);

  useFrame(({ camera }, delta) => {
    const ball = sphere.current;
    if (!ball) return;
    ball.getWorldPosition(motion.position);
    const ray = motion.ray;
    ray.origin.x = motion.position.x; ray.origin.y = motion.position.y + 0.05; ray.origin.z = motion.position.z;
    const hit = world.castRayAndGetNormal(ray, 4, true,
      rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS);
    const supported = hit !== null && hit.normal.y > 0.35;
    let grounded = false;
    if (supported) {
      motion.normal.copy(hit.normal).normalize();
      motion.contact.set(motion.position.x, ray.origin.y - hit.timeOfImpact, motion.position.z);
      const height = (motion.position.y - motion.contact.y) * motion.normal.y;
      grounded = height <= radius + 0.055;
      motion.rotation.setFromUnitVectors(motion.forward, motion.normal);
      if (shadow.current) {
        shadow.current.visible = true;
        shadow.current.position.copy(motion.contact).addScaledVector(motion.normal, 0.009);
        shadow.current.quaternion.copy(motion.rotation);
        shadow.current.scale.setScalar(radius * 2.6 + Math.max(0, height - radius) * 0.18);
        resources.shadowMaterial.uniforms.opacity.value = 0.3 / (1 + Math.max(0, height - radius) * 2.5);
      }
    } else if (shadow.current) shadow.current.visible = false;
    if (!isGameFocused()) { clear(); return; }
    if (!motion.initialized) {
      motion.previous.copy(motion.position); motion.grounded = grounded; motion.initialized = true;
    }
    const distance = motion.rolling.update(motion.position, grounded ? motion.normal : motion.up, radius, delta, ball.quaternion);
    motion.direction.subVectors(motion.position, motion.previous);
    motion.direction.addScaledVector(grounded ? motion.normal : motion.up,
      -motion.direction.dot(grounded ? motion.normal : motion.up));
    motion.previous.copy(motion.position);
    const speed = distance > 0 && delta > 0 ? distance / delta : 0;
    const moving = speed > 0.06;
    const landed = grounded && !motion.grounded;
    const acceleration = Math.max(0, (speed - motion.speed) / Math.max(delta, 0.001));
    let turn = 0;
    if (moving) {
      motion.direction.normalize();
      if (motion.previousDirection.lengthSq() > 0) turn = Math.acos(Math.min(1, Math.max(-1,
        motion.direction.dot(motion.previousDirection)))) / Math.max(delta, 0.001);
    }
    const boost = Math.min(1, acceleration / 25) * 0.35 + Math.min(1, turn / 3) * 0.35 + (landed ? 0.5 : 0);
    if (distance < 0) clear();
    if (!moving) motion.spacing = 0;
    if (distance >= 0 && moving && grounded) {
      motion.spacing += distance;
      const interval = (compact ? 0.15 : 0.1) / (1 + boost + Math.min(speed / 12, 0.5));
      const count = Math.min(compact ? 3 : 5, Math.floor(motion.spacing / interval) + (landed ? 2 : 0));
      motion.spacing %= interval;
      for (let i = 0; i < count; i++) {
        const behind = radius * 0.65 + i * Math.min(distance / Math.max(1, count), 0.1);
        const puff = resources.puffs.items[resources.puffs.cursor++ % resources.puffs.items.length];
        puff.age = 0; puff.life = 0.32 + Math.random() * 0.12;
        puff.size = (0.045 + Math.random() * 0.035) * (1 + boost * 0.3);
        puff.position.copy(motion.contact).addScaledVector(motion.direction, -behind).addScaledVector(motion.normal, 0.045);
        puff.velocity.copy(motion.direction).multiplyScalar(-0.18 - Math.random() * 0.16)
          .addScaledVector(motion.normal, 0.16 + Math.random() * 0.12);
        const mark = resources.trail.items[resources.trail.cursor++ % resources.trail.items.length];
        mark.age = 0; mark.life = 0.3; mark.size = radius * 0.75;
        mark.position.copy(motion.contact).addScaledVector(motion.direction, -behind).addScaledVector(motion.normal, 0.013);
        mark.rotation.copy(motion.rotation);
      }
    }
    for (const [pool, mesh, isPuff] of [[resources.puffs, puffs.current, true], [resources.trail, trail.current, false]] as const) {
      if (!mesh) continue;
      pool.items.forEach((item, index) => {
        item.age += Math.min(delta, 0.05);
        const alive = item.life > 0 && item.age < item.life;
        const progress = alive ? item.age / item.life : 1;
        motion.transform.position.copy(item.position);
        if (isPuff && alive) {
          item.position.addScaledVector(item.velocity, Math.min(delta, 0.05));
          motion.transform.position.copy(item.position);
        }
        motion.transform.quaternion.copy(isPuff ? camera.quaternion : item.rotation);
        motion.transform.scale.setScalar(alive ? item.size * (isPuff ? 1 + progress * 1.7 : 1) : 0);
        motion.transform.updateMatrix(); mesh.setMatrixAt(index, motion.transform.matrix);
        pool.opacity.setX(index, alive ? (1 - progress) * (isPuff ? 0.3 : 0.11) : 0);
      });
      pool.opacity.needsUpdate = true; mesh.instanceMatrix.needsUpdate = true;
    }
    motion.grounded = grounded; motion.speed = speed;
    if (moving) motion.previousDirection.copy(motion.direction);
    else motion.previousDirection.set(0, 0, 0);
  });

  return createPortal(<group name="Player rolling effects">
    <mesh ref={shadow} geometry={resources.shadowGeometry} material={resources.shadowMaterial} visible={false} renderOrder={1} dispose={null} />
    <instancedMesh name="Player ground marks" ref={trail} args={[resources.trail.geometry, resources.trail.material, resources.trail.items.length]} frustumCulled={false} renderOrder={2} dispose={null} />
    <instancedMesh name="Player ground puffs" ref={puffs} args={[resources.puffs.geometry, resources.puffs.material, resources.puffs.items.length]} frustumCulled={false} renderOrder={3} dispose={null} />
  </group>, scene);
}
