import { useEffect, useState } from "react";

const shareUrl = "https://www.crystalthedeveloper.ca/";
const shareTitle = "Crystal the Developer";

type ShareWebsiteScreenProps = {
  onClose: () => void;
};

export function ShareWebsiteScreen({ onClose }: ShareWebsiteScreenProps) {
  const [copied, setCopied] = useState(false);
  const canUseNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const nativeShare = async () => {
    try {
      await navigator.share({ title: shareTitle, text: "Explore StudioCLTD", url: shareUrl });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent("Explore StudioCLTD by Crystal the Developer");

  return (
    <div className="share-screen" role="dialog" aria-modal="true" aria-labelledby="share-screen-title">
      <button className="share-screen__backdrop" type="button" aria-label="Close share screen" onClick={onClose} />
      <section className="share-screen__card">
        <button className="share-screen__close" type="button" aria-label="Close" onClick={onClose}>×</button>
        <span className="share-screen__eyebrow">StudioCLTD</span>
        <h2 id="share-screen-title">Share Website</h2>
        <p>Share Crystal the Developer with someone who needs a better website.</p>
        <div className="share-screen__actions">
          {canUseNativeShare && (
            <button className="share-screen__primary share-screen__native" type="button" onClick={nativeShare}>
              Share
            </button>
          )}
          <button className="share-screen__primary" type="button" onClick={copyLink}>
            {copied ? "Link Copied" : "Copy Link"}
          </button>
          <div className="share-screen__options" aria-label="Share options">
            <a href={`mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodedText}%0A${encodedUrl}`}>Email</a>
            <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`} target="_blank" rel="noreferrer">LinkedIn</a>
            <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`} target="_blank" rel="noreferrer">Facebook</a>
          </div>
        </div>
      </section>
    </div>
  );
}
