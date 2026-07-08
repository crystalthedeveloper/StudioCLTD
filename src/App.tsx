import { Canvas } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from "three";
import { isTrackpadCameraInputBlocked } from "./player/cameraInputGuard";
import { setGameFocused, useGameFocus } from "./player/gameFocus";
import { HubOverlay } from "./ui/HubOverlay";
import { SpeedBoostHud } from "./ui/SpeedBoostHud";
import { TrackpadControl } from "./ui/TrackpadControl";
import { StudioWorld } from "./world/StudioWorld";
import { AssetPreloader } from "./world/systems/AssetPreloader";

export default function App() {
  const [restartKey, setRestartKey] = useState(0);
  const [worldAssetsReady, setWorldAssetsReady] = useState(false);
  const [showcaseVideoReady, setShowcaseVideoReady] = useState(false);
  const gameFocused = useGameFocus();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const restartGame = () => {
    setRestartKey((current) => current + 1);
  };

  const openWebsite = () => {
    window.open("https://www.crystalthedeveloper.ca/", "_blank", "noopener,noreferrer");
  };

  useEffect(() => {
    const video = document.createElement("video");
    video.src = "/videos/showcase.mp4";
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const markReady = () => setShowcaseVideoReady(true);
    video.addEventListener("loadedmetadata", markReady, { once: true });
    video.addEventListener("error", markReady, { once: true });
    video.load();

    return () => {
      video.removeEventListener("loadedmetadata", markReady);
      video.removeEventListener("error", markReady);
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setGameFocused(false);
      document.exitPointerLock?.();
    };

    const handlePointerLockChange = () => {
      if (isTrackpadCameraInputBlocked()) {
        setGameFocused(true);
        return;
      }

      setGameFocused(document.pointerLockElement === canvasRef.current);
    };

    const handleBlur = () => setGameFocused(false);
    const handleWheel = (event: WheelEvent) => {
      if (document.pointerLockElement !== canvasRef.current) return;
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("wheel", handleWheel, { capture: true, passive: false });
    document.addEventListener("pointerlockchange", handlePointerLockChange);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("wheel", handleWheel, { capture: true });
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
    };
  }, []);

  const handleWorldAssetsReady = useCallback(() => {
    setWorldAssetsReady(true);
  }, []);

  const focusGame = () => {
    if (isTrackpadCameraInputBlocked()) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    if (document.pointerLockElement !== canvas) {
      canvas.requestPointerLock?.();
      if (!canvas.requestPointerLock) {
        setGameFocused(true);
      }
      return;
    }

    setGameFocused(true);
  };

  return (
    <>
      <div className={`game-shell${gameFocused ? " game-shell--focused" : ""}`}>
        <Canvas
          shadows
          dpr={1}
          gl={{
            antialias: true,
            outputColorSpace: SRGBColorSpace,
            powerPreference: "high-performance",
            toneMapping: ACESFilmicToneMapping,
            toneMappingExposure: 1.18,
          }}
          camera={{ position: [11, 7, 15], fov: 58, near: 0.1, far: 10000 }}
          onPointerDown={focusGame}
          onWheel={(event) => {
            event.stopPropagation();
            event.nativeEvent.preventDefault();
          }}
          onCreated={({ gl }) => {
            canvasRef.current = gl.domElement;
            gl.shadowMap.enabled = true;
            gl.shadowMap.type = PCFSoftShadowMap;
          }}
        >
          <color attach="background" args={["#03040a"]} />
          <fog attach="fog" args={["#15182b", 58, 260]} />
          <Suspense fallback={null}>
            <AssetPreloader onReady={handleWorldAssetsReady} />
            <Physics gravity={[0, -20, 0]}>
              <StudioWorld restartKey={restartKey} />
            </Physics>
          </Suspense>
        </Canvas>
      </div>
      <LoadingScreen assetsReady={worldAssetsReady && showcaseVideoReady} />
      <div className="game-actions">
        <button type="button" onClick={restartGame}>
          Restart
        </button>
        <button type="button" onClick={openWebsite}>
          My Site
        </button>
      </div>
      <HubOverlay />
      <SpeedBoostHud />
      <div className={`game-focus-hint${gameFocused ? "" : " game-focus-hint--visible"}`}>
        <strong>Click to Play</strong>
        <span>Press ESC to exit</span>
      </div>
      <TrackpadControl />
    </>
  );
}

type LoadingScreenProps = {
  assetsReady: boolean;
};

function LoadingScreen({ assetsReady }: LoadingScreenProps) {
  const { active, progress } = useProgress();
  const [visible, setVisible] = useState(true);
  const complete = !active && progress >= 100 && assetsReady;
  const displayProgress = complete ? 100 : Math.min(99, Math.round(progress));

  useEffect(() => {
    if (!complete) {
      setVisible(true);
      return;
    }

    const timeout = window.setTimeout(() => setVisible(false), 520);
    return () => window.clearTimeout(timeout);
  }, [complete]);

  if (!visible) return null;

  return (
    <div className={`loading-screen${complete ? " loading-screen--ready" : ""}`}>
      <div className="loading-screen__content">
        <strong>StudioCLTD Loading...</strong>
        <span>{`${displayProgress}%`}</span>
      </div>
    </div>
  );
}
