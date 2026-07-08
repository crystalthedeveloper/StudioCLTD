import { Html } from "@react-three/drei";
import { useEffect, useState } from "react";

export type DialogueMessage = {
  id: number;
  text: string;
};

type DialogueBubbleProps = {
  durationMs?: number;
  message: DialogueMessage | null;
  persistent?: boolean;
  position?: [number, number, number];
  variant?: "default" | "danger";
};

export function DialogueBubble({
  durationMs = 3000,
  message,
  persistent = false,
  position = [0, 3, 0],
  variant = "default",
}: DialogueBubbleProps) {
  const [activeMessage, setActiveMessage] = useState<DialogueMessage | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) {
      setVisible(false);
      if (persistent) setActiveMessage(null);
      return;
    }

    setActiveMessage(message);
    setVisible(true);

    if (persistent) return;

    const fadeTimer = window.setTimeout(() => {
      setVisible(false);
    }, Math.max(0, durationMs - 320));

    const hideTimer = window.setTimeout(() => {
      setActiveMessage(null);
    }, durationMs);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [durationMs, message, persistent]);

  if (!activeMessage) return null;

  return (
    <Html center distanceFactor={variant === "danger" ? 9.5 : 8} position={position} zIndexRange={[12, 0]}>
      <div className={`dialogue-bubble dialogue-bubble--${variant}${visible ? " dialogue-bubble--visible" : ""}`}>
        {activeMessage.text}
      </div>
    </Html>
  );
}
