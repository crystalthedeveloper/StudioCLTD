import { useTexture } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import { Color, Group, SRGBColorSpace, Vector3 } from "three";
const orbCoreColors = { wind: "#42d66a", shock: "#e0ae43", fire: "#f05a35", none: "#9aa0a6" } as const;
import { createPowerSmoke } from "./powerSmoke";
import { getActivePowerMask, powerModes, powerOrder } from "./temporaryPowers";
import { gameNow, subscribeGameFocus } from "./gameFocus";
import { useGameFrame } from "./useGameFrame";
import { isCompactVisualBudget } from "../world/visualQuality";

export function PlayerSmokeOrb({ damageFlashUntil }: { damageFlashUntil: number }) {
  const root = useRef<Group>(null);
  const source = useTexture("/images/cltd-logo.svg");
  const logo = useMemo(() => {
    const map = source.clone();
    map.colorSpace = SRGBColorSpace;
    map.needsUpdate = true;
    return map;
  }, [source]);
  const smoke = useMemo(() => createPowerSmoke("#000000", isCompactVisualBudget(), 1.1, true), []);
  const motion = useMemo(() => ({
    position: new Vector3(), previous: new Vector3(), initialized: false, elapsed: 0,
    history: Array.from({ length: 8 }, () => new Vector3()),
    offset: new Vector3(),
    colors: powerOrder.map(mode => new Color(powerModes[mode].color)),
  }), []);
  smoke.material.uniforms.uStrength.value = 1;
  useEffect(() => {
    const unsubscribe = subscribeGameFocus(() => { motion.initialized = false; });
    return () => { unsubscribe(); smoke.geometry.dispose(); smoke.material.dispose(); };
  }, [smoke, motion]);
  useEffect(() => () => logo.dispose(), [logo]);
  useGameFrame((_, delta) => {
    if (!root.current) return;
    const now = gameNow();
    root.current.getWorldPosition(motion.position);
    const distance = motion.position.distanceTo(motion.previous);
    if (!motion.initialized || distance > 2) {
      motion.history.forEach(point => point.copy(motion.position));
      motion.previous.copy(motion.position);
      motion.initialized = true;
      motion.elapsed = 0;
      (smoke.material.uniforms.uTrail.value as Vector3[]).forEach(offset => offset.set(0, 0, 0));
      smoke.material.uniforms.uMotion.value = 0;
    }
    motion.elapsed += Math.min(delta, 0.05);
    if (motion.elapsed >= 0.05) {
      for (let i = 7; i > 0; i--) motion.history[i].copy(motion.history[i - 1]);
      motion.history[0].copy(motion.position);
      motion.elapsed %= 0.05;
    }
    const offsets = smoke.material.uniforms.uTrail.value as Vector3[];
    const easing = 1 - Math.exp(-Math.min(delta, 0.05) * 5);
    offsets.forEach((offset, i) => {
      motion.offset.copy(motion.history[i]).sub(motion.position).clampLength(0, 0.65);
      offset.lerp(motion.offset, easing);
    });
    smoke.material.uniforms.uMotion.value = Math.min(1, offsets[7].length() * 3);
    motion.previous.copy(motion.position);
    // Read live timers every frame: expired hues disappear without a colour fade.
    const mask = getActivePowerMask();
    const palette = smoke.material.uniforms.uColors.value as Color[];
    let count = 0;
    motion.colors.forEach((color, i) => { if (mask & (1 << i)) palette[count++].copy(color); });
    if (!count) { palette[0].setRGB(0, 0, 0); count = 1; }
    // Clear unused entries too, so no expired colour remains in the material.
    for (let i = count; i < palette.length; i++) palette[i].copy(palette[0]);
    smoke.material.uniforms.uColorCount.value = count;
    const core = smoke.material.uniforms.uCoreColor.value as Color;
    const noPower = count === 1 && palette[0].r < 0.02;
    const damaged = damageFlashUntil > now;
    core.set(noPower ? orbCoreColors.none : orbCoreColors.wind);
    if (count && palette[0].g > palette[0].r * 1.35) core.set(orbCoreColors.wind);
    if (count && palette[0].r > palette[0].g * 1.5) core.set(orbCoreColors.fire);
    if (count && palette[0].r > 0.7 && palette[0].g > 0.45) core.set(orbCoreColors.shock);
    if (damaged) core.set("#ef3340");
    smoke.material.uniforms.uCoreStrength.value = damaged ? 1.25 : noPower ? 0.28 : 0.82;
    smoke.material.uniforms.uHeat.value = !noPower && palette[0].r > 0.45 && palette[0].r > palette[0].g * 1.5 ? 1 : 0;
    smoke.material.uniforms.uTime.value = now / 1000;
  });
  return <group ref={root} name="Player smoke orb">
    <mesh geometry={smoke.geometry} material={smoke.material} frustumCulled={false} dispose={null} />
    <sprite name="Floating CLTD logo" scale={[0.48, 0.48, 1]} renderOrder={5}>
      <spriteMaterial map={logo} transparent depthTest depthWrite={false} toneMapped={false} />
    </sprite>
  </group>;
}
