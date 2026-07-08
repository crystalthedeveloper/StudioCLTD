import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr, PerformanceMonitor, useProgress } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { Suspense, useEffect, useRef, useState } from "react";
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from "three";
import { isTrackpadCameraInputBlocked } from "./player/cameraInputGuard";
import { setGameFocused, useGameFocus } from "./player/gameFocus";
import { HubOverlay } from "./ui/HubOverlay";
import { SpeedBoostHud } from "./ui/SpeedBoostHud";
import { TrackpadControl } from "./ui/TrackpadControl";
import { StudioWorld } from "./world/StudioWorld";

export default function App() {
  const [dpr, setDpr] = useState(1.5);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [restartKey, setRestartKey] = useState(0);
  const gameFocused = useGameFocus();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const restartGame = () => {
    setRestartKey((current) => current + 1);
    setActiveSection(null);
  };

  const openWebsite = () => {
    window.open("https://www.crystalthedeveloper.ca/", "_blank", "noopener,noreferrer");
  };

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
          dpr={dpr}
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
          <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.75)} />
          <Suspense fallback={null}>
            <Physics gravity={[0, -20, 0]}>
              <StudioWorld restartKey={restartKey} onActiveSectionChange={setActiveSection} />
            </Physics>
          </Suspense>
          <AdaptiveDpr pixelated />
        </Canvas>
      </div>
      <LoadingScreen />
      <div className="game-actions">
        <button type="button" onClick={restartGame}>
          Restart
        </button>
        <button type="button" onClick={openWebsite}>
          My Site
        </button>
      </div>
      <HubOverlay activeSection={activeSection} />
      <SpeedBoostHud />
      <div className={`game-focus-hint${gameFocused ? "" : " game-focus-hint--visible"}`}>
        <strong>Click to Play</strong>
        <span>Press ESC to exit</span>
      </div>
      <TrackpadControl />
    </>
  );
}

function LoadingScreen() {
  const { active, progress } = useProgress();
  const [visible, setVisible] = useState(true);
  const complete = !active && progress >= 100;

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
        <strong>Loading...</strong>
        <span>{`${Math.round(progress)}%`}</span>
      </div>
    </div>
  );
}
