import { WINTER_THEME_ENABLED } from "../winterTheme";
import { useEffect, useRef, useState } from "react";
import { AmbientLight, DirectionalLight, Object3D } from "three";
import { useGameFrame } from "../../player/useGameFrame";
import { playerWorldState } from "../playerWorldState";
import { sunlightOffset, isCompactVisualBudget } from "../visualQuality";
import { LocalLightPool } from "./LocalLightSpill";

const playerLightingLayer = 2;
const villainLightingLayer = 1;

export function WorldLights() {
  const mobileLighting = isCompactVisualBudget();
  const sunRef = useRef<DirectionalLight>(null);
  const [sunTarget] = useState(() => new Object3D());
  const [shadowSize] = useState(() => isCompactVisualBudget() ? 512 : 2048);
  useEffect(() => { sunRef.current?.layers.enable(3); }, []);
  useGameFrame(() => {
    const sun = sunRef.current;
    if (!sun) return;
    const texel = 64 / shadowSize;
    const x = Math.round(playerWorldState.position.x / texel) * texel;
    const z = Math.round(playerWorldState.position.z / texel) * texel;
    sunTarget.position.set(x, playerWorldState.position.y, z);
    sun.position.set(x + sunlightOffset[0], playerWorldState.position.y + sunlightOffset[1], z + sunlightOffset[2]);
    sunTarget.updateMatrixWorld();
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
      <ambientLight intensity={mobileLighting ? 0.54 : 0.36} color={WINTER_THEME_ENABLED ? "#bacddd" : "#fffdf8"} />
      <hemisphereLight intensity={mobileLighting ? 0.82 : 0.62} color={WINTER_THEME_ENABLED ? "#c2d6eb" : "#eef7fc"} groundColor={WINTER_THEME_ENABLED ? "#6d7c8d" : "#85877f"} />
      <ambientLight ref={playerFillRef} intensity={mobileLighting ? 0.48 : 0.32} color="#fffdf8" />
      <directionalLight
        ref={playerKeyRef}
        color="#fff7ec"
        intensity={mobileLighting ? 1.05 : 0.9}
        position={[8, 14, 10]}
      />
      <directionalLight
        ref={playerRimRef}
        color="#e2f2ff"
        intensity={mobileLighting ? 0.8 : 0.65}
        position={[-12, 9, -14]}
      />
      <ambientLight ref={villainFillRef} intensity={mobileLighting ? 0.2 : 0.12} color="#c7d6e2" />
      <directionalLight
        ref={villainKeyRef}
        color="#e8edf0"
        intensity={mobileLighting ? 0.6 : 0.48}
        position={[10, 13, 8]}
      />
      <directionalLight
        ref={villainRimRef}
        color="#668ead"
        intensity={mobileLighting ? 0.46 : 0.36}
        position={[-10, 8, -12]}
      />
      <LocalLightPool />
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
      <directionalLight color="#9fb9d4" intensity={mobileLighting ? 0.42 : 0.34} position={[20, 18, -16]} />
    </>
  );
}
