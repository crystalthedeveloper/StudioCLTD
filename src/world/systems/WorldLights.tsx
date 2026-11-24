import { WINTER_THEME_ENABLED } from "../winterTheme";
import { useEffect, useRef, useState } from "react";
import { AdditiveBlending, AmbientLight, CanvasTexture, DirectionalLight, Group, Object3D, Sprite, SpriteMaterial } from "three";
import { useGameFrame } from "../../player/useGameFrame";
import { playerWorldState } from "../playerWorldState";
import { isCompactVisualBudget, sunlightOffset } from "../visualQuality";
import { Sparkles } from "@react-three/drei";
import { hubSections } from "../hubSections";

const playerLightingLayer = 2;
const villainLightingLayer = 1;

export function WorldLights() {
  const sunRef = useRef<DirectionalLight>(null);
  const lightningRef = useRef<DirectionalLight>(null);
  const lightningTimerRef = useRef(8);
  const [sunTarget] = useState(() => new Object3D());
  const [shadowSize] = useState(2048);
  useEffect(() => { sunRef.current?.layers.enable(3); }, []);
  useGameFrame((_, delta) => {
    const sun = sunRef.current;
    if (!sun) return;
    const texel = 64 / shadowSize;
    const x = Math.round(playerWorldState.position.x / texel) * texel;
    const z = Math.round(playerWorldState.position.z / texel) * texel;
    sunTarget.position.set(x, playerWorldState.position.y, z);
    sun.position.set(x + sunlightOffset[0], playerWorldState.position.y + sunlightOffset[1], z + sunlightOffset[2]);
    sunTarget.updateMatrixWorld();
    lightningTimerRef.current -= delta;
    if (lightningTimerRef.current <= 0) {
      lightningTimerRef.current = 8 + Math.random() * 14;
      if (Math.random() < 0.28 && lightningRef.current) {
        lightningRef.current.intensity = 1.6;
        window.setTimeout(() => {
          if (lightningRef.current) lightningRef.current.intensity = 0;
        }, 80);
      }
    }
  });
  const playerFillRef = useRef<AmbientLight>(null);
  const playerKeyRef = useRef<DirectionalLight>(null);
  const playerRimRef = useRef<DirectionalLight>(null);
  const villainFillRef = useRef<AmbientLight>(null);
  const villainKeyRef = useRef<DirectionalLight>(null);
  const villainRimRef = useRef<DirectionalLight>(null);

  useEffect(() => {
    playerFillRef.current?.layers.set(playerLightingLayer);
    playerKeyRef.current?.layers.set(playerLightingLayer);
    playerRimRef.current?.layers.set(playerLightingLayer);
    villainFillRef.current?.layers.set(villainLightingLayer);
    villainKeyRef.current?.layers.set(villainLightingLayer);
    villainRimRef.current?.layers.set(villainLightingLayer);
  }, []);

  return (
    <>
      <ambientLight intensity={0.72} color={WINTER_THEME_ENABLED ? "#bacddd" : "#fffdf8"} />
      <hemisphereLight intensity={0.98} color={WINTER_THEME_ENABLED ? "#c2d6eb" : "#eef7fc"} groundColor={WINTER_THEME_ENABLED ? "#6d7c8d" : "#85877f"} />
      <ambientLight ref={playerFillRef} intensity={0.56} color="#fffdf8" />
      <directionalLight
        ref={playerKeyRef}
        color="#fff7ec"
        intensity={1.12}
        position={[8, 14, 10]}
      />
      <directionalLight
        ref={playerRimRef}
        color="#e2f2ff"
        intensity={0.86}
        position={[-12, 9, -14]}
      />
      <ambientLight ref={villainFillRef} intensity={0.22} color="#c7d6e2" />
      <directionalLight
        ref={villainKeyRef}
        color="#e8edf0"
        intensity={0.66}
        position={[10, 13, 8]}
      />
      <directionalLight
        ref={villainRimRef}
        color="#668ead"
        intensity={0.5}
        position={[-10, 8, -12]}
      />
      <primitive object={sunTarget} />
      <directionalLight
        ref={sunRef}
        target={sunTarget}
        castShadow
        color={WINTER_THEME_ENABLED ? "#ccdef0" : "#fff0d2"}
        intensity={1.8}
        position={[...sunlightOffset]}
        shadow-bias={-0.0001}
        shadow-normalBias={0.025}
        shadow-camera-bottom={-32}
        shadow-camera-far={180}
        shadow-camera-left={-32}
        shadow-camera-near={1}
        shadow-camera-right={32}
        shadow-camera-top={32}
        shadow-mapSize-height={shadowSize}
        shadow-mapSize-width={shadowSize}
      />
      <directionalLight color="#9fb9d4" intensity={0.64} position={[20, 28, -16]} />
      <directionalLight ref={lightningRef} color="#dbe8ff" intensity={0} position={[-24, 36, -80]} />
      <Sparkles
        count={isCompactVisualBudget() ? 12 : 28}
        scale={[42, 16, 520]}
        position={[0, 7, -215]}
        size={0.7}
        speed={0.12}
        opacity={0.28}
        color="#c8d9df"
      />
      {hubSections.slice(0, 4).map((section) => (
        <pointLight
          key={`screen-light-${section.id}`}
          position={[section.position[0], section.position[1] + 3.2, section.position[2] - 1.8]}
          color="#aebfd0"
          intensity={0.16}
          distance={9}
          decay={2}
        />
      ))}
      <FloatingRedEmbers />
    </>
  );
}

const emberPositions = [
  [-8, 3.2, -38], [7, 5.6, -76], [-10, 2.6, -118], [9, 4.4, -156],
  [-7, 6.1, -198], [8, 3.4, -238], [-11, 4.8, -282], [10, 6.4, -326],
  [-6, 3.1, -372], [6, 5.2, -418], [16, 4.5, -92], [-17, 3.8, -252],
] as const;

function createEmberTexture() {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const glow = context.createRadialGradient(32, 32, 2, 32, 32, 32);
  glow.addColorStop(0, "rgba(255, 100, 72, 1)");
  glow.addColorStop(0.2, "rgba(210, 35, 35, .9)");
  glow.addColorStop(0.58, "rgba(125, 12, 25, .28)");
  glow.addColorStop(1, "rgba(70, 0, 10, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, 64, 64);
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function FloatingRedEmbers() {
  const groupRef = useRef<Group>(null);
  const timeRef = useRef(0);
  const texture = useState(createEmberTexture)[0];
  const compact = isCompactVisualBudget();
  const visiblePositions = compact ? emberPositions.filter((_, index) => index % 2 === 0) : emberPositions;

  useEffect(() => () => texture?.dispose(), [texture]);
  useGameFrame((_, delta) => {
    timeRef.current += Math.min(delta, 1 / 30);
    groupRef.current?.children.forEach((child, index) => {
      const sprite = child as Sprite;
      const phase = index * 0.83;
      sprite.position.x = visiblePositions[index][0] + Math.sin(timeRef.current * 0.18 + phase) * 0.12;
      sprite.position.y = visiblePositions[index][1] + Math.sin(timeRef.current * 0.32 + phase) * 0.18;
      sprite.position.z = visiblePositions[index][2] + Math.cos(timeRef.current * 0.16 + phase) * 0.08;
      const pulse = 0.82 + Math.sin(timeRef.current * 1.1 + phase) * 0.12;
      (sprite.material as SpriteMaterial).opacity = pulse;
      sprite.scale.setScalar((compact ? 1.05 : 1.25) * (0.94 + Math.sin(timeRef.current * 0.8 + phase) * 0.05));
    });
  });

  if (!texture) return null;
  return <group ref={groupRef} name="FloatingRedEmbers">
    {visiblePositions.map(([x, y, z], index) => (
      <sprite key={`red-ember-${index}`} position={[x, y, z]} scale={compact ? 1.05 : 1.25}>
        <spriteMaterial map={texture} color="#b51f2d" transparent depthWrite={false} blending={AdditiveBlending} opacity={0.82} />
      </sprite>
    ))}
  </group>;
}
