import { handlePowerShortcut, resetTemporaryPowers } from "./player/temporaryPowers";
import { gameNow } from "./player/gameFocus";
import { Canvas } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ACESFilmicToneMapping, MathUtils, PCFSoftShadowMap, SRGBColorSpace } from "three";
import { isTouchControlsCameraInputBlocked } from "./player/cameraInputGuard";
import { isGameFocused, subscribeGameFocus, setGameFocused, useGameFocus } from "./player/gameFocus";
import { HubOverlay } from "./ui/HubOverlay";
import { GameHud } from "./ui/GameHud";
import { ShareWebsiteScreen } from "./ui/ShareWebsiteScreen";
import { triggerTrophyHaptic } from "./ui/haptics";
import { StudioWorld } from "./world/StudioWorld";
import { preloadScreenTextures } from "./world/systems/HubSections";
import { distanceFog } from "./world/distanceFog";

type StudioExperienceProps = {
  onOpenWebsite: () => void;
  onReady: () => void;
  onLoadProgress: (progress: number) => void;
  restartKey: number;
  onRestart: () => void;
};

export function StudioExperience({ onLoadProgress, onOpenWebsite, onReady, onRestart, restartKey }: StudioExperienceProps) {
  const gameFocused = useGameFocus();
  const playRequestedRef = useRef(false);
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

  useEffect(() => {
    const unsubscribe = subscribeGameFocus((running) => {
      document.documentElement.classList.toggle("game-paused", !running);

    });
    document.documentElement.classList.toggle("game-paused", !isGameFocused());
    return () => { unsubscribe(); setGameFocused(false); };
  }, []);

  const resetGameSession = useCallback(() => {
    damageCooldownUntilRef.current = 0;
    previousCompletedSectionCountRef.current = 0;
    setCoins(0);
    setCompletedSectionCount(0);
    setHealth(3);
    healthRef.current = 3;
    setDamageFlashUntil(0);
    resetTemporaryPowers();
    setShareScreenOpen(false);
    onRestart();
  }, [onRestart]);

  const handlePlayerDeath = useCallback(() => {
    resetGameSession();
  }, [resetGameSession]);

  const handleManualRestart = useCallback(() => {
    resetGameSession();
  }, [resetGameSession]);

  const damagePlayer = useCallback(() => {
    if (!isGameFocused()) return;
    const now = gameNow();
    if (now < damageCooldownUntilRef.current) return;

    const cooldownUntil = now + 1250;
    damageCooldownUntilRef.current = cooldownUntil;
    setDamageFlashUntil(cooldownUntil);
    const nextHealth = Math.max(0, healthRef.current - 1);
    healthRef.current = nextHealth;
    setHealth(nextHealth);
  }, []);

  const collectHealth = useCallback(() => {
    if (!isGameFocused()) return false;
    if (healthRef.current >= 3) return false;
    healthRef.current += 1;
    setHealth(healthRef.current);
    return true;
  }, []);

  useEffect(() => {
    resetTemporaryPowers();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || !isGameFocused()) return;
      if (!["Space", "KeyG"].includes(event.code)) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, [contenteditable=true]")) return;
      if (event.code === "Space" && target instanceof HTMLElement && target.closest("button:not(.game-hud__fix):not(.game-hud__power)")) return;
      event.preventDefault();
      handlePowerShortcut(event.code);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      resetTemporaryPowers();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (health !== 0) return;
    handlePlayerDeath();
  }, [health, handlePlayerDeath]);

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
      playRequestedRef.current = false;
      setGameFocused(false);
      document.exitPointerLock?.();
    };

    const handlePointerLockChange = () => {
      const locked = document.pointerLockElement === canvasRef.current;
      if (locked && !playRequestedRef.current) { document.exitPointerLock?.(); return; }
      if (!locked) playRequestedRef.current = false;
      setGameFocused(locked);
    };

    const handleBlur = () => { playRequestedRef.current = false; setGameFocused(false); document.exitPointerLock?.(); };
    const handleVisibility = () => { if (document.hidden) handleBlur(); };
    document.addEventListener("visibilitychange", handleVisibility);
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
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("wheel", handleWheel, { capture: true });
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
    };
  }, [gameFocused]);

  const focusGame = () => {
    if (isTouchControlsCameraInputBlocked()) return;

    if (shareScreenOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // The Play click starts the simulation. Pointer lock is optional: embedded
    // browsers can expose the API but reject the request.
    playRequestedRef.current = true;
    setGameFocused(true);
    if (window.matchMedia("(pointer: coarse)").matches) return;

    if (document.pointerLockElement !== canvas && canvas.requestPointerLock) {
      try {
        void Promise.resolve(canvas.requestPointerLock()).catch(() => {
          // Keep playing with keyboard/on-screen controls when lock is denied.
          // ESC, blur and actual pointer-lock loss still use the shared pause state.
        });
      } catch {
        // Older browsers may throw synchronously instead of returning a promise.
      }
    }
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

          onWheel={(event) => {
            event.stopPropagation();
            event.nativeEvent.preventDefault();
          }}
          onCreated={({ gl, clock }) => {
            let previous = gameNow();
            clock.getDelta = () => {
              const now = gameNow();
              const delta = Math.max(0, (now - previous) / 1000);
              previous = now;
              clock.elapsedTime = now / 1000;
              return delta;
            };
            canvasRef.current = gl.domElement;
            gl.shadowMap.enabled = true;
            gl.shadowMap.type = PCFSoftShadowMap;
          }}
        >
          <color attach="background" args={["#01030a"]} />
          <fog attach="fog" args={[distanceFog.color, distanceFog.near, distanceFog.far]} />
          <Suspense fallback={null}>
            <Physics gravity={[0, -20, 0]} paused={!gameFocused}>
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
                onReset={handleManualRestart}
                onSectionComplete={() => setCompletedSectionCount((current) => Math.min(8, current + 1))}
                restartKey={restartKey}
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
        onOpenWebsite={onOpenWebsite}
        onRestart={handleManualRestart}
        points={coins}
      />
      <HubOverlay />
      {!gameFocused && (
        <div className="game-pause-overlay">
          <div className="game-pause-overlay__content">
            <button type="button" onClick={focusGame} className="studio-button game-focus-hint" aria-describedby="game-pause-instructions">
              Click to Play
            </button>
            <p id="game-pause-instructions">Press ESC to pause</p>
          </div>
        </div>
      )}
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
