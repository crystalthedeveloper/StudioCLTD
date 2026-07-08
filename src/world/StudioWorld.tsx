import { Environment } from "@react-three/drei";
import { useRef, useState } from "react";
import { CharacterController } from "../player/CharacterController";
import { DialogueMessage } from "../ui/DialogueBubble";
import { CinematicPostProcessing } from "./systems/CinematicPostProcessing";
import { CombatPrototype } from "./systems/CombatPrototype";
import { GlowCubeField } from "./systems/GlowCubeField";
import { HubSections } from "./systems/HubSections";
import { ModularTerrain } from "./systems/ModularTerrain";
import { SpaceSky } from "./systems/SpaceSky";
import { SpeedPowerUp } from "./systems/SpeedPowerUp";
import { WorldLights } from "./systems/WorldLights";

type StudioWorldProps = {
  onActiveSectionChange: (sectionName: string | null) => void;
};

export function StudioWorld({ onActiveSectionChange }: StudioWorldProps) {
  const dialogueIdRef = useRef(0);
  const fixedAnimationRequestRef = useRef(0);
  const [fixedAnimationRequest, setFixedAnimationRequest] = useState(0);
  const [movementLocked, setMovementLocked] = useState(false);
  const [serviceResolutions, setServiceResolutions] = useState<Record<string, boolean>>({});
  const [activeSectionName, setActiveSectionName] = useState<string | null>(null);
  const [playerDialogue, setPlayerDialogue] = useState<DialogueMessage | null>(null);
  const [villainDialogue, setVillainDialogue] = useState<(DialogueMessage & { sectionName: string }) | null>(null);

  const createDialogue = (text: string): DialogueMessage => {
    dialogueIdRef.current += 1;
    return {
      id: dialogueIdRef.current,
      text,
    };
  };

  const handleActiveSectionChange = (sectionName: string | null) => {
    setActiveSectionName(sectionName);
    onActiveSectionChange(sectionName);

    if (!sectionName) return;

    if (sectionName === "Quick Fix") return;

    const text = "No leads today.";
    setVillainDialogue({
      ...createDialogue(text),
      sectionName,
    });
  };

  return (
    <>
      <WorldLights />
      <SpaceSky />
      <Environment preset="warehouse" background={false} environmentIntensity={0.08} />
      <ModularTerrain radius={7} />
      <GlowCubeField />
      <SpeedPowerUp />
      <HubSections serviceResolutions={serviceResolutions} onActiveSectionChange={handleActiveSectionChange} />
      <CombatPrototype
        activeSectionName={activeSectionName}
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
      />
      <CinematicPostProcessing />
    </>
  );
}
