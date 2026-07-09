import { lazy, Suspense, useState } from "react";

const StudioExperience = lazy(() =>
  import("./StudioExperience").then((module) => ({ default: module.StudioExperience }))
);

export default function App() {
  const [restartKey, setRestartKey] = useState(0);
  const [studioStarted, setStudioStarted] = useState(false);
  const [studioReady, setStudioReady] = useState(false);
  const [studioLoadProgress, setStudioLoadProgress] = useState(0);

  const restartGame = () => {
    setRestartKey((current) => current + 1);
  };

  const launchStudio = () => {
    setStudioReady(false);
    setStudioLoadProgress(0);
    setStudioStarted(true);
  };

  const openWebsite = () => {
    window.open("https://www.crystalthedeveloper.ca/", "_blank", "noopener,noreferrer");
  };

  return (
    <>
      {studioStarted ? (
        <Suspense fallback={null}>
          <StudioExperience
            onLoadProgress={setStudioLoadProgress}
            onOpenWebsite={openWebsite}
            onReady={() => setStudioReady(true)}
            onRestart={restartGame}
            restartKey={restartKey}
          />
        </Suspense>
      ) : (
        <div className="game-shell">
          <StudioLaunch onLaunch={launchStudio} />
        </div>
      )}
      {studioStarted && !studioReady && <StudioLoadingOverlay progress={studioLoadProgress} />}
    </>
  );
}

function StudioLaunch({ loading = false, onLaunch }: { loading?: boolean; onLaunch: () => void }) {
  return (
    <div className="studio-launch">
      <button type="button" className="studio-launch__button" disabled={loading} onClick={onLaunch}>
        {loading ? "Loading StudioCLTD..." : "StudioCLTD"}
      </button>
    </div>
  );
}

function StudioLoadingOverlay({ progress }: { progress: number }) {
  const displayProgress = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div className={`loading-screen${displayProgress >= 100 ? " loading-screen--ready" : ""}`}>
      <div className="loading-screen__content">
        <strong>StudioCLTD Loading...</strong>
        <span>{`${displayProgress}%`}</span>
      </div>
    </div>
  );
}
