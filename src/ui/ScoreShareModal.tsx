import { useEffect, useMemo, useState } from "react";
import type { RunScore } from "../game/roundSystem";

const siteUrl = "https://www.crystalthedeveloper.ca/";

type ScoreShareModalProps = {
  score: RunScore;
  personalBest: boolean;
  onClose: () => void;
  onReady: () => void;
  onError: () => void;
};

export function ScoreShareModal({ score, personalBest, onClose, onReady, onError }: ScoreShareModalProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState("");
  const challengeText = useMemo(() => `I survived Level ${score.level} in StudioCLTD, defeated ${score.villains} villains and earned $${score.cash}. Can you beat my score? Play at ${siteUrl}`, [score]);

  useEffect(() => {
    let active = true;
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 900;
    const context = canvas.getContext("2d");
    if (!context) { onError(); return undefined; }
    context.fillStyle = "#050812";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const moon = context.createRadialGradient(1270, 180, 20, 1270, 180, 190);
    moon.addColorStop(0, "#9c222b"); moon.addColorStop(1, "rgba(70,12,22,0)");
    context.fillStyle = moon; context.fillRect(1030, 0, 500, 400);
    context.fillStyle = "#141b28";
    context.beginPath(); context.moveTo(0, 760); context.lineTo(520, 650); context.lineTo(1080, 650); context.lineTo(1600, 760); context.lineTo(1600, 900); context.lineTo(0, 900); context.fill();
    context.strokeStyle = "#b39a29"; context.lineWidth = 12; context.setLineDash([42, 30]); context.beginPath(); context.moveTo(780, 900); context.lineTo(800, 660); context.stroke(); context.setLineDash([]);
    context.fillStyle = "#f1eee5"; context.font = "700 54px Arial, sans-serif"; context.fillText("STUDIOCLTD", 100, 110);
    context.fillStyle = "#d1a914"; context.font = "700 84px Arial, sans-serif"; context.fillText(`LEVEL ${score.level} SURVIVED`, 100, 235);
    context.fillStyle = "#f1eee5"; context.font = "700 42px Arial, sans-serif";
    context.fillText(`${score.villains} VILLAINS DEFEATED`, 100, 350);
    context.fillText(`$${score.cash} EARNED`, 100, 420);
    const minutes = Math.floor(score.survivalSeconds / 60).toString().padStart(2, "0");
    const seconds = (score.survivalSeconds % 60).toString().padStart(2, "0");
    context.fillText(`SURVIVAL TIME ${minutes}:${seconds}`, 100, 490);
    if (personalBest) { context.fillStyle = "#9c222b"; context.fillText("PERSONAL BEST", 100, 575); }
    context.fillStyle = "#f1eee5"; context.font = "700 38px Arial, sans-serif"; context.fillText("CAN YOU BEAT MY SCORE?", 100, 735);
    context.font = "28px Arial, sans-serif"; context.fillText("crystalthedeveloper.ca", 100, 820);
    canvas.toBlob((nextBlob) => {
      if (!active) return;
      if (!nextBlob) { onError(); return; }
      setBlob(nextBlob);
      setImageUrl(URL.createObjectURL(nextBlob));
      setBusy(false);
      onReady();
    }, "image/png");
    return () => { active = false; };
  }, [onError, onReady, personalBest, score]);

  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);

  const nativeShare = async () => {
    if (!blob || busy || !navigator.share) return;
    const file = new File([blob], `studiocltd-level-${score.level}.png`, { type: "image/png" });
    if (!navigator.canShare?.({ files: [file] })) return;
    setBusy(true);
    try { await navigator.share({ files: [file], title: `StudioCLTD Level ${score.level}`, text: challengeText }); }
    catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("Sharing was not completed."); }
    finally { setBusy(false); }
  };

  const download = () => {
    if (!imageUrl || busy) return;
    const link = document.createElement("a"); link.href = imageUrl; link.download = `studiocltd-level-${score.level}.png`; link.click();
    setStatus("Score card downloaded. Add the image to your post.");
  };
  const copy = async () => { await navigator.clipboard?.writeText(challengeText); setStatus("Challenge text copied."); };
  const facebook = () => { download(); void copy(); window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(siteUrl)}`, "_blank", "noopener,noreferrer"); };

  if (busy && !imageUrl) return null;
  return <div className="share-screen" role="dialog" aria-modal="true" aria-labelledby="score-share-title">
    <button className="studio-button studio-button--backdrop share-screen__backdrop" type="button" aria-label="Close score share" onClick={onClose} />
    <section className="share-screen__card score-share-card">
      <span className="share-screen__eyebrow">StudioCLTD</span>
      <h2 id="score-share-title">SHARE YOUR SCORE</h2>
      {imageUrl ? <img className="score-share-card__preview" src={imageUrl} alt={`Level ${score.level} score card`} /> : <p>Generating score card…</p>}
      {personalBest && <p className="score-share-card__best">PERSONAL BEST</p>}
      <div className="share-screen__actions">
        {typeof navigator.share === "function" && blob && navigator.canShare?.({ files: [new File([blob], "score.png", { type: "image/png" })] }) && <button className="studio-button share-screen__primary" disabled={busy} onClick={nativeShare}>SHARE SCORE</button>}
        <button className="studio-button" disabled={busy} onClick={download}>DOWNLOAD SCORE CARD</button>
        <button className="studio-button" disabled={busy} onClick={copy}>COPY CHALLENGE TEXT</button>
        <button className="studio-button" disabled={busy} onClick={facebook}>OPEN FACEBOOK</button>
        <button className="studio-button" onClick={onClose}>CLOSE</button>
      </div>
      {status && <p role="status">{status}</p>}
    </section>
  </div>;
}
