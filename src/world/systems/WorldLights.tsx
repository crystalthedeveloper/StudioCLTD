import { useEffect, useRef } from "react";
import { AmbientLight, DirectionalLight } from "three";
import { hubSections } from "../hubSections";

const playerLightingLayer = 2;
const villainLightingLayer = 1;

export function WorldLights() {
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
      <ambientLight intensity={0.92} color="#fffdf8" />
      <hemisphereLight intensity={1.32} color="#eef7fc" groundColor="#85877f" />
      <ambientLight ref={playerFillRef} intensity={0.68} color="#fffdf8" />
      <directionalLight
        ref={playerKeyRef}
        color="#fff7ec"
        intensity={2}
        position={[8, 14, 10]}
      />
      <directionalLight
        ref={playerRimRef}
        color="#e2f2ff"
        intensity={1.25}
        position={[-12, 9, -14]}
      />
      <ambientLight ref={villainFillRef} intensity={0.12} color="#c7d6e2" />
      <directionalLight
        ref={villainKeyRef}
        color="#e8edf0"
        intensity={0.48}
        position={[10, 13, 8]}
      />
      <directionalLight
        ref={villainRimRef}
        color="#668ead"
        intensity={0.36}
        position={[-10, 8, -12]}
      />
      {hubSections.map((section) => (
        <pointLight
          key={`platform-light:${section.id}`}
          color="#b9d5e6"
          decay={2}
          distance={24}
          intensity={12}
          position={[section.position[0], section.position[1] + 8, section.position[2]]}
        />
      ))}
      <directionalLight
        castShadow
        color="#fff0d2"
        intensity={2.12}
        position={[-34, 52, 28]}
        shadow-bias={-0.00025}
        shadow-camera-bottom={-145}
        shadow-camera-far={240}
        shadow-camera-left={-145}
        shadow-camera-near={1}
        shadow-camera-right={145}
        shadow-camera-top={145}
        shadow-mapSize-height={1024}
        shadow-mapSize-width={1024}
      />
      <directionalLight color="#afcde3" intensity={0.24} position={[20, 18, -16]} />
    </>
  );
}
