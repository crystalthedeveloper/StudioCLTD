import { createContactDamageGate } from "./player/contactDamage";
import { createGuidePauseSession } from "./player/guidePauseSession";
import { resetTemporaryPowers } from "./player/temporaryPowers";
import { cancelCruise, toggleCruise } from "./player/useKeyboardControls";
import { gameNow } from "./player/gameFocus";
import { Canvas, useFrame } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ACESFilmicToneMapping, MathUtils, PCFSoftShadowMap, SRGBColorSpace } from "three";
import { isTouchControlsCameraInputBlocked } from "./player/cameraInputGuard";
import { isGameFocused, subscribeGameFocus, setGameFocused, useGameFocus } from "./player/gameFocus";
import { HubOverlay } from "./ui/HubOverlay";
import { GameHud } from "./ui/GameHud";
import { ShareWebsiteScreen } from "./ui/ShareWebsiteScreen";
import { ScoreShareModal } from "./ui/ScoreShareModal";
import { triggerTrophyHaptic } from "./ui/haptics";
import { StudioWorld } from "./world/StudioWorld";
import { preloadScreenTextures } from "./world/systems/HubSections";
import { distanceFog } from "./world/distanceFog";
import { triggerDamageFeedback } from "./player/damageFeedback";
import { playCollectibleSound, playPlayerDeathSound } from "./audio/collectibleSounds";
import { beginGameAudioLock, endGameAudioLock } from "./audio/gameAudio";
import { roadTexturePath } from "./world/systems/ModularTerrain";
import { villainsRequired, readPersonalBest, savePersonalBest, type RunScore } from "./game/roundSystem";

const maxHealth = 3;

type StudioExperienceProps = {
  onOpenWebsite: () => void;
  onReady: () => void;
  onLoadProgress: (progress: number) => void;
  restartKey: number;
  onRestart: () => void;
};

export function StudioExperience({ onLoadProgress, onOpenWebsite, onReady, onRestart, restartKey }: StudioExperienceProps) {
  const gameFocused = useGameFocus();
  const [gameStarted, setGameStarted] = useState(false);
  const [worldReady, setWorldReady] = useState(false);
  const markWorldReady = useCallback(() => setWorldReady(true), []);
  const playRequestedRef = useRef(false);
  const [guideSession] = useState(createGuidePauseSession);
  const [guideOpen, setGuideOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previousCompletedSectionCountRef = useRef(0);
  const [contactDamageGate] = useState(createContactDamageGate);
  const healthRef = useRef(maxHealth);
  const [cash, setCash] = useState(0);
  const [completedSectionCount, setCompletedSectionCount] = useState(0);
  const [health, setHealth] = useState(maxHealth);
  const [damageFlashUntil, setDamageFlashUntil] = useState(0);
  const [screenAssetProgress, setScreenAssetProgress] = useState(0);
  const [screenAssetsReady, setScreenAssetsReady] = useState(false);
  const [fontReady, setFontReady] = useState(false);
  const [roadTextureReady, setRoadTextureReady] = useState(false);
  const [shareScreenOpen, setShareScreenOpen] = useState(false);
  const [scoreShareSnapshot, setScoreShareSnapshot] = useState<RunScore | null>(null);
  const [scoreSharePersonalBest, setScoreSharePersonalBest] = useState(false);
  const [scoreCardLoading, setScoreCardLoading] = useState(false);
  const [scoreShareOpen, setScoreShareOpen] = useState(false);
  const [scoreCardError, setScoreCardError] = useState(false);
  const [scoreCardGeneration, setScoreCardGeneration] = useState(0);
  const [returning, setReturning] = useState(false);
  const [deathFade, setDeathFade] = useState(0);
  const [deathGlitch, setDeathGlitch] = useState(false);
  const [respawnCameraSnap, setRespawnCameraSnap] = useState(false);
  const [carHidden, setCarHidden] = useState(false);
  const [level, setLevel] = useState(1);
  const [levelDefeats, setLevelDefeats] = useState(0);
  const [roundActive, setRoundActive] = useState(true);
  const [levelOverlay, setLevelOverlay] = useState(false);
  const [runVillains, setRunVillains] = useState(0);
  const [runStartedAt] = useState(() => Date.now());
  const [personalBest, setPersonalBest] = useState<RunScore | null>(() => readPersonalBest());
  const levelTimerRef = useRef<number | null>(null);
  const returnTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (!cancelled) setRoadTextureReady(true);
    };
    image.onerror = () => {
      console.error(`[asset] Failed to load road colour texture: ${roadTexturePath}. Using medium-gray fallback.`);
      if (!cancelled) setRoadTextureReady(true);
    };
    image.src = roadTexturePath;
    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const font = new FontFace("Trade Winds", "url(/fonts/tradewinds.ttf)");
    font.load().then((loadedFont) => {
      if (cancelled) return;
      document.fonts.add(loadedFont);
      setFontReady(true);
    }).catch((error) => {
      console.error("[asset] Failed to load font: /fonts/tradewinds.ttf", error);
      if (!cancelled) setFontReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeGameFocus((running) => {
      document.documentElement.classList.toggle("game-paused", !running);

    });
    document.documentElement.classList.toggle("game-paused", !isGameFocused());
    return () => { unsubscribe(); setGameFocused(false); };
  }, []);

  const beginReturnSequence = useCallback(() => {
    if (returnTimerRef.current !== null || returning) return;
    beginGameAudioLock();
    setReturning(true);
    setDeathFade(0);
    setDeathGlitch(false);
    setRespawnCameraSnap(false);
    setCarHidden(false);
    setGameFocused(true);
    triggerDamageFeedback();
    playPlayerDeathSound();
    // Start the fast blackout on the first rendered overlay frame. The reset
    // below waits until that transition has finished rather than sharing its
    // first frame with the teleport.
    window.requestAnimationFrame(() => setDeathFade(1));
    const blackoutTimer = window.setTimeout(() => {
      setCarHidden(true);
      // Reset the complete session only after the blackout is opaque. This
      // also makes manual restart and death restart behave identically.
      cancelCruise();
      contactDamageGate.reset();
      resetTemporaryPowers();
      previousCompletedSectionCountRef.current = 0;
      setCash(0);
      setCompletedSectionCount(0);
      setLevel(1);
      setLevelDefeats(0);
      setRunVillains(0);
      setRoundActive(true);
      setLevelOverlay(false);
      setHealth(maxHealth);
      healthRef.current = maxHealth;
      setDamageFlashUntil(0);
      setShareScreenOpen(false);
      onRestart();
      // Let Rapier apply the teleport, then hard-snap the follow camera after
      // two rendered frames while the blackout is still fully opaque.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setRespawnCameraSnap(true));
      });
    }, 240);
    const glitchTimer = window.setTimeout(() => setDeathGlitch(true), 3300);
    returnTimerRef.current = window.setTimeout(() => {
      window.clearTimeout(blackoutTimer);
      window.clearTimeout(glitchTimer);
      setDeathFade(0);
      setDeathGlitch(false);
      setCarHidden(false);
      // Keep the sequence locked until the 0.2s fade has completely finished.
      window.setTimeout(() => {
        setHealth(maxHealth);
        healthRef.current = maxHealth;
        setRespawnCameraSnap(false);
        setReturning(false);
        returnTimerRef.current = null;
        setGameFocused(true);
        endGameAudioLock();
      }, 240);
    }, 3700);
  }, [contactDamageGate, onRestart, returning]);

  useEffect(() => () => {
    if (returnTimerRef.current !== null) window.clearTimeout(returnTimerRef.current);
  }, []);

  const handlePlayerDeath = useCallback(() => {
    beginReturnSequence();
  }, [beginReturnSequence]);

  const handleManualRestart = useCallback(() => {
    beginReturnSequence();
  }, [beginReturnSequence]);

  const damagePlayer = useCallback(() => {
    if (returning) return;
    if (healthRef.current <= 0) return;
    const cooldownUntil = contactDamageGate.claim();
    if (cooldownUntil === null) return;
    setDamageFlashUntil(Math.min(cooldownUntil, gameNow() + 320));
    triggerDamageFeedback();
    playCollectibleSound("damage");
    const nextHealth = Math.max(0, healthRef.current - 1);
    healthRef.current = nextHealth;
    setHealth(nextHealth);
  }, [contactDamageGate]);

  const collectHealth = useCallback(() => {
    if (!isGameFocused()) return false;
    if (healthRef.current >= maxHealth) return false;
    healthRef.current += 1;
    setHealth(healthRef.current);
    return true;
  }, []);

  useEffect(() => {
    resetTemporaryPowers();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || !isGameFocused()) return;
      if (event.code !== "Space") return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, [contenteditable=true]")) return;
      if (event.code === "Space" && target instanceof HTMLElement && target.closest("button:not(.game-hud__fix):not(.game-hud__power-bar)")) return;
      event.preventDefault();
      if (event.code === "Space") toggleCruise();
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

  const advanceLevel = useCallback(() => {
    if (levelTimerRef.current !== null) window.clearTimeout(levelTimerRef.current);
    levelTimerRef.current = null;
    playRequestedRef.current = true;
    setGameStarted(true);
    setScoreShareSnapshot(null);
    setScoreCardLoading(false);
    setScoreShareOpen(false);
    setScoreCardError(false);
    setLevel((current) => current + 1);
    setLevelDefeats(0);
    setRoundActive(true);
    setLevelOverlay(false);
    setGameFocused(true);
  }, []);

  const runScore: RunScore = {
    level,
    villains: runVillains,
    cash,
    survivalSeconds: Math.max(0, Math.floor((Date.now() - runStartedAt) / 1000)),
  };

  const shareScore = useCallback(() => {
    if (levelTimerRef.current !== null) {
      window.clearTimeout(levelTimerRef.current);
      levelTimerRef.current = null;
    }
    const snapshot = { ...runScore };
    const isBest = savePersonalBest(snapshot);
    setPersonalBest(isBest ? snapshot : readPersonalBest());
    setScoreShareSnapshot(snapshot);
    setScoreSharePersonalBest(isBest);
    setScoreCardLoading(true);
    setScoreShareOpen(false);
    setScoreCardError(false);
    setScoreCardGeneration((current) => current + 1);
    document.exitPointerLock?.();
    setGameFocused(false);
  }, [runScore]);

  const closeScoreShare = useCallback(() => {
    setScoreShareSnapshot(null);
    setScoreCardLoading(false);
    setScoreShareOpen(false);
    setScoreCardError(false);
    setGameFocused(false);
    if (levelOverlay) {
      if (levelTimerRef.current !== null) window.clearTimeout(levelTimerRef.current);
      levelTimerRef.current = window.setTimeout(advanceLevel, 7000);
    }
  }, [advanceLevel, levelOverlay]);

  const retryScoreCard = useCallback(() => {
    setScoreCardError(false);
    setScoreCardLoading(true);
    setScoreCardGeneration((current) => current + 1);
  }, []);

  const scoreCardReady = useCallback(() => {
    setScoreCardLoading(false);
    setScoreShareOpen(true);
  }, []);
  const scoreCardFailed = useCallback(() => {
    setScoreCardLoading(false);
    setScoreCardError(true);
  }, []);

  useEffect(() => {
    if (!levelOverlay) return undefined;
    const handleLevelShortcut = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.code === "Digit5" || event.code === "Numpad5") {
        event.preventDefault();
        advanceLevel();
      } else if (event.code === "Digit6" || event.code === "Numpad6") {
        event.preventDefault();
        shareScore();
      }
    };
    window.addEventListener("keydown", handleLevelShortcut);
    return () => window.removeEventListener("keydown", handleLevelShortcut);
  }, [advanceLevel, levelOverlay, shareScore]);

  const handleVillainDefeated = useCallback(() => {
    if (!roundActive || levelOverlay) return;
    setRunVillains((current) => current + 1);
    setLevelDefeats((current) => {
      const next = current + 1;
      if (next >= villainsRequired(level)) {
        setRoundActive(false);
        setLevelOverlay(true);
        setGameFocused(false);
        levelTimerRef.current = window.setTimeout(advanceLevel, 7000);
      }
      return next;
    });
  }, [advanceLevel, level, levelOverlay, roundActive]);

  useEffect(() => () => {
    if (levelTimerRef.current !== null) window.clearTimeout(levelTimerRef.current);
  }, []);

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
      if (guideSession.isOpen()) {
        setGameFocused(false);
        if (locked) document.exitPointerLock?.();
        return;
      }
      if (locked && !playRequestedRef.current) { document.exitPointerLock?.(); return; }
      if (!locked) playRequestedRef.current = false;
      setGameFocused(locked);
    };

    const handleBlur = () => { guideSession.cancelResume(); playRequestedRef.current = false; setGameFocused(false); document.exitPointerLock?.(); };
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

  const focusGame = useCallback(() => {
    if (isTouchControlsCameraInputBlocked()) return;

    if (shareScreenOpen || guideSession.isOpen()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // The Play click starts the simulation. Pointer lock is optional: embedded
    // browsers can expose the API but reject the request.
    playRequestedRef.current = true;
    setGameStarted(true);
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
  }, [shareScreenOpen, guideSession]);

  const openGuide = useCallback(() => {
    if (!guideSession.open()) return;
    playRequestedRef.current = false;
    setGameFocused(false);
    document.exitPointerLock?.();
    setGuideOpen(true);
  }, [guideSession]);
  const closeGuide = useCallback(() => {
    const shouldResume = guideSession.close();
    setGuideOpen(false);
    if (shouldResume && !document.hidden) focusGame();
  }, [focusGame, guideSession]);

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
            toneMappingExposure: 1.28,
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
                onCoinCollect={() => setCash((current) => current + 1)}
                onVillainReward={(amount) => setCash((current) => current + amount)}
                level={level}
                roundActive={roundActive}
                onVillainDefeated={handleVillainDefeated}
                onOpenShare={() => {
                  document.exitPointerLock?.();
                  setGameFocused(false);
                  setShareScreenOpen(true);
                }}
                onHealthCollect={collectHealth}
                onPlayerDamage={damagePlayer}
                onReset={handleManualRestart}
                returning={returning}
                respawnCameraSnap={respawnCameraSnap}
                carHidden={carHidden}
                startCamera={!gameStarted}
                onSectionComplete={() => setCompletedSectionCount((current) => Math.min(8, current + 1))}
                restartKey={restartKey}
              />
            </Physics>
            <WorldFirstRender onReady={markWorldReady} />
          </Suspense>
        </Canvas>
      </div>
      <StartupProgress
        worldReady={worldReady}
        onProgress={onLoadProgress}
        onReady={onReady}
        screenAssetProgress={screenAssetProgress}
        screenAssetsReady={screenAssetsReady}
        fontReady={fontReady}
        roadTextureReady={roadTextureReady}
      />
      <GameHud
        level={level}
        levelDefeats={levelDefeats}
        levelRequirement={villainsRequired(level)}
        guideOpen={guideOpen}
        onOpenGuide={openGuide}
        onCloseGuide={closeGuide}
        completedSectionCount={completedSectionCount}
                health={health}
                maxHealth={maxHealth}
        damageFlashUntil={damageFlashUntil}
        onOpenWebsite={onOpenWebsite}
        onRestart={handleManualRestart}
        cash={cash}
      />
      {levelOverlay && (
        <div className="round-overlay" role="dialog" aria-modal="true" aria-labelledby="round-title">
          <section className="round-overlay__card">
            <span className="game-hud__stat-label">StudioCLTD</span>
            <h2 id="round-title">LEVEL {level} SURVIVED</h2>
            <p>{levelDefeats} villains defeated · Level {level + 1} is waiting.</p>
            <div className="round-overlay__actions">
              <button type="button" className="studio-button" disabled={scoreCardLoading || scoreShareOpen || scoreCardError} onClick={advanceLevel}>5 · CONTINUE</button>
              <button type="button" className="studio-button" disabled={scoreCardLoading || scoreShareOpen || scoreCardError} onClick={shareScore}>6 · SHARE SCORE</button>
            </div>
            <small>Continuing automatically…</small>
          </section>
        </div>
      )}
      <HubOverlay />
      {!gameFocused && !guideOpen && !levelOverlay && (
        <div className="game-pause-overlay">
          <div className="game-pause-overlay__content">
            <button type="button" onClick={focusGame} className="studio-button game-focus-hint" aria-describedby="game-pause-instructions">
              Click to Play
            </button>
            {playRequestedRef.current && <p id="game-pause-instructions">Press ESC to pause</p>}
          </div>
        </div>
      )}
      {shareScreenOpen && <ShareWebsiteScreen onClose={() => setShareScreenOpen(false)} />}
      {scoreShareSnapshot && scoreCardLoading && (
        <div className="score-card-loading" role="status" aria-live="polite">
          <div className="score-card-loading__card">
            <span>STUDIOCLTD</span>
            <strong>GENERATING SCORE CARD…</strong>
            <p>Preparing your Level {scoreShareSnapshot.level} results</p>
            <div className="score-card-loading__dots" aria-hidden="true"><i /><i /><i /></div>
          </div>
        </div>
      )}
      {scoreShareSnapshot && scoreCardError && (
        <div className="score-card-loading" role="alert">
          <div className="score-card-loading__card">
            <span>STUDIOCLTD</span><strong>COULD NOT GENERATE SCORE CARD</strong>
            <div className="round-overlay__actions"><button className="studio-button" onClick={retryScoreCard}>TRY AGAIN</button><button className="studio-button" onClick={closeScoreShare}>CLOSE</button></div>
          </div>
        </div>
      )}
      {scoreShareSnapshot && <ScoreShareModal key={scoreCardGeneration} score={scoreShareSnapshot} personalBest={scoreSharePersonalBest} onClose={closeScoreShare} onReady={scoreCardReady} onError={scoreCardFailed} />}
      {returning && (
        <div className={`death-restart-fade${deathGlitch ? " death-restart-fade--glitch" : ""}`} style={{ opacity: deathFade }}>
          {deathFade > 0.8 && <div className="death-restart-caption" role="status" aria-live="polite">
            <div className="death-restart-caption__laugh">HEH… HEH… HEH…</div>
            <span className="sr-only">Witch laughing</span>
          </div>}
        </div>
      )}
    </>
  );
}

/** Commits only after the entire world (including environment textures) resolves.
 * Notify after its first rendered frame, even while gameplay is paused.
 */
function WorldFirstRender({ onReady }: { onReady: () => void }) {
  const scheduled = useRef(false);
  const frame = useRef(0);
  useFrame(() => {
    if (scheduled.current) return;
    scheduled.current = true;
    frame.current = window.requestAnimationFrame(onReady);
  });
  useEffect(() => () => window.cancelAnimationFrame(frame.current), []);
  return null;
}

function StartupProgress({
  worldReady,
  onProgress,
  onReady,
  screenAssetProgress,
  screenAssetsReady,
  fontReady,
  roadTextureReady,
}: {
  onProgress: (progress: number) => void;
  onReady: () => void;
  screenAssetProgress: number;
  screenAssetsReady: boolean;
  fontReady: boolean;
  roadTextureReady: boolean;
  worldReady: boolean;
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

  // useProgress includes the environment textures via Three's loading manager.
  const complete = worldReady && !active && progress >= 100 && fontReady && roadTextureReady;
  const worldProgress = observedWorldLoadingRef.current || screenAssetsReady
    ? MathUtils.clamp(progress, 0, 100)
    : 0;
  const actualProgress = screenAssetsReady && roadTextureReady && complete
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
