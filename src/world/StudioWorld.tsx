import { Environment } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import { CharacterController } from "../player/CharacterController";
import { resetSpeedBoost } from "../player/speedBoost";
import { DialogueMessage } from "../ui/DialogueBubble";
import { CombatPrototype } from "./systems/CombatPrototype";
import { HubSections } from "./systems/HubSections";
import { InteractiveBall } from "./systems/InteractiveBall";
import { LogoLightField } from "./systems/LogoLightField";
import { ModularTerrain } from "./systems/ModularTerrain";
import { SpaceSky } from "./systems/SpaceSky";
import { SpeedPowerUp } from "./systems/SpeedPowerUp";
import { WorldLights } from "./systems/WorldLights";

type StudioWorldProps = {
  onBallFloorContact: () => void;
  onBallPlayerHit: () => void;
  restartKey: number;
};

export function StudioWorld({ onBallFloorContact, onBallPlayerHit, restartKey }: StudioWorldProps) {
  const dialogueIdRef = useRef(0);
  const fixedAnimationRequestRef = useRef(0);
  const [fixedAnimationRequest, setFixedAnimationRequest] = useState(0);
  const [movementLocked, setMovementLocked] = useState(false);
  const [serviceResolutions, setServiceResolutions] = useState<Record<string, boolean>>({});
  const [playerDialogue, setPlayerDialogue] = useState<DialogueMessage | null>(null);
  const [villainDialogue, setVillainDialogue] = useState<(DialogueMessage & { sectionName: string }) | null>(null);

  useEffect(() => {
    setMovementLocked(false);
    setServiceResolutions({});
    setPlayerDialogue(null);
    setVillainDialogue(null);
    resetSpeedBoost();
  }, [restartKey]);

  const createDialogue = (text: string): DialogueMessage => {
    dialogueIdRef.current += 1;
    return {
      id: dialogueIdRef.current,
      text,
    };
  };

  return (
    <>
      <WorldLights />
      <SpaceSky />
      <Environment preset="warehouse" background={false} environmentIntensity={0.035} />
      <ModularTerrain radius={7} />
      <LogoLightField />
      <InteractiveBall
        onFloorContact={onBallFloorContact}
        onPlayerHit={onBallPlayerHit}
        restartKey={restartKey}
      />
      <SpeedPowerUp restartKey={restartKey} />
      <HubSections restartKey={restartKey} serviceResolutions={serviceResolutions} />
      <CombatPrototype
        restartKey={restartKey}
        onPlayerDialogue={(text) => setPlayerDialogue(createDialogue(text))}
        onPlayerFixedAnimation={() => {
          setMovementLocked(true);
          fixedAnimationRequestRef.current += 1;
          setFixedAnimationRequest(fixedAnimationRequestRef.current);
        }}
        onVillainDialogue={(sectionName, text) => {
          setVillainDialogue({
            ...createDialogue(text),
            sectionName,
          });
        }}
        onSectionResolved={(sectionId) => {
          setServiceResolutions((current) => ({
            ...current,
            [sectionId]: true,
          }));
        }}
        villainDialogue={villainDialogue}
      />
      <CharacterController
        dialogue={playerDialogue}
        fixedAnimationRequest={fixedAnimationRequest}
        movementLocked={movementLocked}
        onFixedAnimationComplete={() => setMovementLocked(false)}
        restartKey={restartKey}
      />
    </>
  );
}
