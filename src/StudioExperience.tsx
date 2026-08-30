import { Canvas } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ACESFilmicToneMapping, MathUtils, PCFSoftShadowMap, SRGBColorSpace } from "three";
import { isTouchControlsCameraInputBlocked } from "./player/cameraInputGuard";
import { setGameFocused, useGameFocus } from "./player/gameFocus";
import { HubOverlay } from "./ui/HubOverlay";
import { GameHud } from "./ui/GameHud";
import { ShareWebsiteScreen } from "./ui/ShareWebsiteScreen";
import { triggerTrophyHaptic } from "./ui/haptics";
import { StudioWorld } from "./world/StudioWorld";
import { preloadScreenTextures, unlockShowcaseVideoPlayback } from "./world/systems/HubSections";
import { distanceFog } from "./world/distanceFog";
import { crosshairViewportY } from "./world/aiming";

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
  const previousCompletedSectionCountRef = useRef(0);
  const damageCooldownUntilRef = useRef(0);
  const healthRef = useRef(3);
  const [coins, setCoins] = useState(0);
  const [completedSectionCount, setCompletedSectionCount] = useState(0);
  const [health, setHealth] = useState(3);
  const [damageFlashUntil, setDamageFlashUntil] = useState(0);
  const [screenAssetProgress, setScreenAssetProgress] = useState(0);
  const [screenAssetsReady, setScreenAssetsReady] = useState(false);
  const [shareScreenOpen, setShareScreenOpen] = useState(false);
  const [shootPressed, setShootPressed] = useState(false);
  const [shootRequest, setShootRequest] = useState(0);

  const resetGame = useCallback(() => {
    damageCooldownUntilRef.current = 0;
    previousCompletedSectionCountRef.current = 0;
    setCoins(0);
    setCompletedSectionCount(0);
    setHealth(3);
    healthRef.current = 3;
    setDamageFlashUntil(0);
    setShootPressed(false);
    setShootRequest(0);
    setShareScreenOpen(false);
    onRestart();
  }, [onRestart]);

  const damagePlayer = useCallback(() => {
    const now = performance.now();
    if (now < damageCooldownUntilRef.current) return;

    const cooldownUntil = now + 1250;
    damageCooldownUntilRef.current = cooldownUntil;
    setDamageFlashUntil(cooldownUntil);
    const nextHealth = Math.max(0, healthRef.current - 1);
    healthRef.current = nextHealth;
    setHealth(nextHealth);
  }, []);

  const collectHealth = useCallback(() => {
    if (healthRef.current >= 3) return false;
    healthRef.current += 1;
    setHealth(healthRef.current);
    return true;
  }, []);

  const shoot = () => {
    setGameFocused(true);
    setShootRequest((current) => current + 1);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || !gameFocused) return;
      event.preventDefault();
      setShootPressed(true);
      shoot();
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      event.preventDefault();
      setShootPressed(false);
    };
    const releaseShoot = () => setShootPressed(false);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", releaseShoot);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", releaseShoot);
    };
  }, [gameFocused]);

  useEffect(() => {
    if (health !== 0) return;
    resetGame();
  }, [health, resetGame]);

  useEffect(() => {
    if (completedSectionCount === 8 && previousCompletedSectionCountRef.current < 8) {
      triggerTrophyHaptic();
    }
    previousCompletedSectionCountRef.current = completedSectionCount;
  }, [completedSectionCount]);

  useEffect(() => {
    let cancelled = false;
    preloadScreenTextures((nextProgress) => {
      if (!cancelled) setScreenAssetProgress((current) => Math.max(current, nextProgress));
    })
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
      if (isTouchControlsCameraInputBlocked()) {
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
    if (isTouchControlsCameraInputBlocked()) return;

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
            toneMappingExposure: 1.08,
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
          <color attach="background" args={["#01030a"]} />
          <fog attach="fog" args={[distanceFog.color, distanceFog.near, distanceFog.far]} />
          <Suspense fallback={null}>
            <Physics gravity={[0, -20, 0]}>
              <StudioWorld
                damageFlashUntil={damageFlashUntil}
                onCoinCollect={() => setCoins((current) => current + 1)}
                onBonusCollect={() => setCoins((current) => current + 3)}
                onOpenShare={() => {
                  document.exitPointerLock?.();
                  setGameFocused(false);
                  setShareScreenOpen(true);
                }}
                onHealthCollect={collectHealth}
                onPlayerDamage={damagePlayer}
                onReset={resetGame}
                onSectionComplete={() => setCompletedSectionCount((current) => Math.min(8, current + 1))}
                restartKey={restartKey}
                shootRequest={shootRequest}
              />
            </Physics>
          </Suspense>
        </Canvas>
      </div>
      <StartupProgress
        onProgress={onLoadProgress}
        onReady={onReady}
        screenAssetProgress={screenAssetProgress}
        screenAssetsReady={screenAssetsReady}
      />
      <GameHud
        completedSectionCount={completedSectionCount}
        health={health}
        onShoot={shoot}
        onOpenWebsite={onOpenWebsite}
        onRestart={resetGame}
        points={coins}
        shootPressed={shootPressed}
        setShootPressed={setShootPressed}
      />
      <div className="aim-crosshair" aria-hidden="true" style={{ top: `${crosshairViewportY * 100}%` }}>
        <span className="aim-crosshair__mark aim-crosshair__mark--top" />
        <span className="aim-crosshair__mark aim-crosshair__mark--right" />
        <span className="aim-crosshair__mark aim-crosshair__mark--bottom" />
        <span className="aim-crosshair__mark aim-crosshair__mark--left" />
      </div>
      <HubOverlay />
      <div className={`game-focus-hint${gameFocused ? "" : " game-focus-hint--visible"}`}>
        <strong>Click to Play</strong>
        <span>Press ESC to exit</span>
      </div>
      {shareScreenOpen && <ShareWebsiteScreen onClose={() => setShareScreenOpen(false)} />}
    </>
  );
}

function StartupProgress({
  onProgress,
  onReady,
  screenAssetProgress,
  screenAssetsReady,
}: {
  onProgress: (progress: number) => void;
  onReady: () => void;
  screenAssetProgress: number;
  screenAssetsReady: boolean;
}) {
  const { active, progress } = useProgress();
  const displayedProgressRef = useRef(0);
  const targetProgressRef = useRef(0);
  const onProgressRef = useRef(onProgress);
  const onReadyRef = useRef(onReady);
  const observedWorldLoadingRef = useRef(false);
  const readyRef = useRef(false);

  onProgressRef.current = onProgress;
  onReadyRef.current = onReady;
  if (active) observedWorldLoadingRef.current = true;

  const complete = !active && progress >= 100;
  const worldProgress = observedWorldLoadingRef.current || screenAssetsReady
    ? MathUtils.clamp(progress, 0, 100)
    : 0;
  const actualProgress = screenAssetsReady && complete
    ? 100
    : Math.min(99, worldProgress * 0.8 + MathUtils.clamp(screenAssetProgress, 0, 100) * 0.2);
  targetProgressRef.current = Math.max(targetProgressRef.current, actualProgress);

  useEffect(() => {
    let animationFrame = 0;
    let fadeTimeout = 0;

    onProgressRef.current(0);

    const updateDisplayedProgress = () => {
      const current = displayedProgressRef.current;
      const target = targetProgressRef.current;
      let next = MathUtils.lerp(current, target, 0.15);

      if (target >= 100 && 100 - next < 0.08) next = 100;
      next = Math.max(current, Math.min(100, next));
      displayedProgressRef.current = next;
      onProgressRef.current(next);

      if (next >= 100 && !readyRef.current) {
        readyRef.current = true;
        fadeTimeout = window.setTimeout(() => onReadyRef.current(), 520);
        return;
      }

      animationFrame = window.requestAnimationFrame(updateDisplayedProgress);
    };

    animationFrame = window.requestAnimationFrame(updateDisplayedProgress);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(fadeTimeout);
    };
  }, []);

  return null;
}
