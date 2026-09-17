import { usePlayerBaseTexture } from "./usePlayerBaseTexture";
import { configurePlayerSurface } from "./playerSurface";
import { createPowerAppearance } from "./powerAppearance";
import { PlayerLogoOverlay } from "./PlayerLogoOverlay";
import { PlayerRollingEffects } from "./PlayerRollingEffects";
import { MutableRefObject, useLayoutEffect, useMemo, useRef } from "react";
import { Group, Mesh, MeshPhysicalMaterial, PointLight } from "three";
import { ActivePowerAura } from "./ActivePowerAura";
import { useGameFrame } from "./useGameFrame";
import { gameNow, isGameFocused, subscribeGameFocus } from "./gameFocus";
import { DialogueBubble, DialogueMessage } from "../ui/DialogueBubble";
import { isSpeedBoostActive, subscribeSpeedBoostChange } from "./speedBoost";
import { getActivePowerMask, subscribePowers } from "./temporaryPowers";
import { playerSphereRadius as sphereRadius } from "./playerDimensions";
import { CharacterAnimationState } from "./playerTypes";

type PlayerCharacterProps = {
  animationStateRef: MutableRefObject<CharacterAnimationState>;
  damageFlashUntil: number;
  dialogue: DialogueMessage | null;
  yawRef: MutableRefObject<number>;
};

const playerLightingLayer = 2;

export function PlayerCharacter({ damageFlashUntil, dialogue, yawRef }: PlayerCharacterProps) {
  const appearance = useMemo(createPowerAppearance, []);
  const baseTexture = usePlayerBaseTexture();
  const compile = useMemo<MeshPhysicalMaterial["onBeforeCompile"]>(() => (shader, renderer) => {
    configurePlayerSurface(shader, renderer);
    appearance.compile(shader, renderer);
  }, [appearance]);
  const sphere = useRef<Mesh>(null);
  const material = useRef<MeshPhysicalMaterial>(null);
  const effects = useRef<Group>(null);
  const playerFillLightRef = useRef<PointLight>(null);
  const syncTint = useRef(() => {});

  useLayoutEffect(() => {
    sphere.current?.layers.enable(playerLightingLayer);
    playerFillLightRef.current?.layers.set(playerLightingLayer);
    const update = () => {
      if (!material.current) return;
      appearance.update(isGameFocused() ? getActivePowerMask() : 0, isGameFocused() && isSpeedBoostActive());
    };
    syncTint.current = update;
    update();
    const unsubscribeSpeed = subscribeSpeedBoostChange(update);
    const unsubscribePower = subscribePowers(update);
    const unsubscribeFocus = subscribeGameFocus(() => {
      update();
    });
    return () => {
      unsubscribeSpeed();
      unsubscribePower();
      unsubscribeFocus();
      syncTint.current = () => {};

    };
  }, [appearance]);

  useGameFrame(() => {
    const mesh = sphere.current;
    if (!mesh) return;
    syncTint.current();
    if (effects.current) effects.current.rotation.y = yawRef.current;
    mesh.visible = gameNow() >= damageFlashUntil || Math.floor(gameNow() / 90) % 2 === 0;

  });

  return (
    <group position={[0, -sphereRadius, 0]}>
      <group ref={effects}>
        <pointLight
          ref={playerFillLightRef}
          color="#fff4e8"
          intensity={8}
          distance={8}
          decay={2}
          position={[1.6, 3, 2.3]}
        />
        <ActivePowerAura />
        <DialogueBubble message={dialogue} position={[0, 2.65, 0]} />
      </group>
      <PlayerRollingEffects sphere={sphere} />
      <mesh ref={sphere} name="Player sphere" position={[0, sphereRadius, 0]} castShadow>
        <sphereGeometry args={[sphereRadius, 48, 32]} />
        <meshPhysicalMaterial ref={material} color="#ffffff" map={baseTexture} onBeforeCompile={compile}
          customProgramCacheKey={() => "player-triplanar-multi-power-v2"}
          roughness={0.18} metalness={0.15} transmission={0.35}
          thickness={0.8} ior={1.35} clearcoat={0.7} clearcoatRoughness={0.2} />
        <PlayerLogoOverlay />
      </mesh>
    </group>
  );
}
