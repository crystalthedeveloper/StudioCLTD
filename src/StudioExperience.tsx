import { Canvas } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { Suspense, useEffect, useRef, useState } from "react";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import { isTrackpadCameraInputBlocked } from "./player/cameraInputGuard";
import { setGameFocused, useGameFocus } from "./player/gameFocus";
import { HubOverlay } from "./ui/HubOverlay";
import { SpeedBoostHud } from "./ui/SpeedBoostHud";
import { TrackpadControl } from "./ui/TrackpadControl";
import { StudioWorld } from "./world/StudioWorld";
import { preloadScreenTextures, unlockShowcaseVideoPlayback } from "./world/systems/HubSections";

type StudioExperienceProps = {
  onOpenWebsite: () => void;
  onReady: () => void;
  onLoadProgress: (progress: number) => void;
  restartKey: number;
  onRestart: () => void;
};

export function StudioExperience({ onLoadProgress, onOpenWebsite, onReady, onRestart, restartKey }: StudioExperienceProps) {
  const gameFocused = useGameFocus();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [screenAssetsReady, setScreenAssetsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    preloadScreenTextures()
      .catch(() => undefined)
      .then(() => {
        if (!cancelled) setScreenAssetsReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!gameFocused) return undefined;

    const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    const previousViewport = viewport?.content;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const preventBrowserGesture = (event: Event) => event.preventDefault();
    const preventMultiTouch = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };

    document.documentElement.classList.add("game-input-locked");
    document.body.classList.add("game-input-locked");
    if (viewport) {
      viewport.content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
    }

    document.addEventListener("touchstart", preventMultiTouch, { capture: true, passive: false });
    document.addEventListener("touchmove", preventBrowserGesture, { capture: true, passive: false });
    document.addEventListener("gesturestart", preventBrowserGesture, { capture: true, passive: false });
    document.addEventListener("gesturechange", preventBrowserGesture, { capture: true, passive: false });
    document.addEventListener("gestureend", preventBrowserGesture, { capture: true, passive: false });

    return () => {
      document.documentElement.classList.remove("game-input-locked");
      document.body.classList.remove("game-input-locked");
      if (viewport && previousViewport !== undefined) viewport.content = previousViewport;
      document.removeEventListener("touchstart", preventMultiTouch, { capture: true });
      document.removeEventListener("touchmove", preventBrowserGesture, { capture: true });
      document.removeEventListener("gesturestart", preventBrowserGesture, { capture: true });
      document.removeEventListener("gesturechange", preventBrowserGesture, { capture: true });
      document.removeEventListener("gestureend", preventBrowserGesture, { capture: true });
      window.scrollTo(scrollX, scrollY);
    };
  }, [gameFocused]);

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
      if (!gameFocused) return;
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
  }, [gameFocused]);

  const focusGame = () => {
    if (isTrackpadCameraInputBlocked()) return;

    void unlockShowcaseVideoPlayback();

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
          dpr={1}
          frameloop={gameFocused ? "always" : "demand"}
          gl={{
            antialias: false,
            outputColorSpace: SRGBColorSpace,
            powerPreference: "high-performance",
            toneMapping: ACESFilmicToneMapping,
            toneMappingExposure: 0.96,
          }}
          camera={{ position: [11, 7, 15], fov: 58, near: 0.1, far: 10000 }}
          onPointerDown={focusGame}
          onWheel={(event) => {
            event.stopPropagation();
            event.nativeEvent.preventDefault();
          }}
          onCreated={({ gl }) => {
            canvasRef.current = gl.domElement;
            gl.shadowMap.enabled = false;
          }}
        >
          <color attach="background" args={["#03040a"]} />
          <fog attach="fog" args={["#15182b", 58, 260]} />
          <Suspense fallback={null}>
            <Physics gravity={[0, -20, 0]}>
              <StudioWorld restartKey={restartKey} />
            </Physics>
          </Suspense>
        </Canvas>
      </div>
      <StartupProgress onProgress={onLoadProgress} onReady={onReady} screenAssetsReady={screenAssetsReady} />
      <div className="game-actions">
        <button type="button" onClick={onRestart}>
          Restart
        </button>
        <button type="button" onClick={onOpenWebsite}>
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

function StartupProgress({
  onProgress,
  onReady,
  screenAssetsReady,
}: {
  onProgress: (progress: number) => void;
  onReady: () => void;
  screenAssetsReady: boolean;
}) {
  const { active, progress } = useProgress();
  const readyRef = useRef(false);
  const complete = !active && progress >= 100;
  const startupProgress = Math.min(99, Math.round((Math.min(progress, 100) + (screenAssetsReady ? 100 : 0)) / 2));

  useEffect(() => {
    onProgress(screenAssetsReady && complete ? 100 : startupProgress);
  }, [complete, onProgress, screenAssetsReady, startupProgress]);

  useEffect(() => {
    if (readyRef.current || !screenAssetsReady || !complete) return;

    const timeout = window.setTimeout(() => {
      readyRef.current = true;
      onProgress(100);
      onReady();
    }, 520);
    return () => window.clearTimeout(timeout);
  }, [complete, onProgress, onReady, screenAssetsReady]);

  return null;
}
