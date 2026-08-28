import { Environment } from "@react-three/drei";
import { useCallback, useEffect, useRef, useState } from "react";
import { CharacterController } from "../player/CharacterController";
import { resetSpeedBoost } from "../player/speedBoost";
import { DialogueMessage } from "../ui/DialogueBubble";
import { CombatPrototype } from "./systems/CombatPrototype";
import { HubSections } from "./systems/HubSections";
import { HomeBase } from "./systems/HomeBase";
import { LogoLightField } from "./systems/LogoLightField";
import { ModularTerrain } from "./systems/ModularTerrain";
import { SpaceSky } from "./systems/SpaceSky";
import { WorldLights } from "./systems/WorldLights";
import { TransportPads } from "./systems/TransportPads";
import type { TransportDestination } from "./systems/TransportPads";

type StudioWorldProps = {
  onBonusCollect: () => void;
  onCoinCollect: () => void;
  onPenaltyCollect: () => void;
  onOpenShare: () => void;
  onSectionComplete: () => void;
  restartKey: number;
  shootRequest: number;
};

const requiredSectionTriggers: Record<string, number> = {
  tips: 3,
  offers: 4,
  value: 2,
  "quick-fix": 2,
  "urgent-fix": 2,
  performance: 2,
  "site-improvement": 2,
  showcase: 1,
};

export function StudioWorld({ onBonusCollect, onCoinCollect, onOpenShare, onPenaltyCollect, onSectionComplete, restartKey, shootRequest }: StudioWorldProps) {
  const dialogueIdRef = useRef(0);
  const activatedSectionTriggersRef = useRef<Record<string, Set<string>>>({});
  const completedSectionsRef = useRef(new Set<string>());
  const [movementLocked, setMovementLocked] = useState(false);
  const [penaltyResetCount, setPenaltyResetCount] = useState(0);
  const [serviceResolutions, setServiceResolutions] = useState<Record<string, boolean>>({});
  const [playerDialogue, setPlayerDialogue] = useState<DialogueMessage | null>(null);
  const [villainDialogue, setVillainDialogue] = useState<(DialogueMessage & { sectionName: string }) | null>(null);
  const [transportDestination, setTransportDestination] = useState<TransportDestination | null>(null);
  const handleShootAnimationComplete = useCallback(() => setMovementLocked(false), []);

  useEffect(() => {
    activatedSectionTriggersRef.current = {};
    completedSectionsRef.current.clear();
    setPenaltyResetCount(0);
    setMovementLocked(false);
    setServiceResolutions({});
    setPlayerDialogue(null);
    setVillainDialogue(null);
    setTransportDestination(null);
    resetSpeedBoost();
  }, [restartKey]);

  useEffect(() => {
    if (shootRequest > 0) setMovementLocked(true);
  }, [shootRequest]);

  const recordSectionTrigger = (sectionId: string, triggerId: string) => {
    if (completedSectionsRef.current.has(sectionId)) return;

    const activatedTriggers = activatedSectionTriggersRef.current[sectionId] ?? new Set<string>();
    activatedTriggers.add(triggerId);
    activatedSectionTriggersRef.current[sectionId] = activatedTriggers;

    const requiredTriggerCount = requiredSectionTriggers[sectionId];
    if (requiredTriggerCount === undefined || activatedTriggers.size < requiredTriggerCount) return;

    completedSectionsRef.current.add(sectionId);
    onSectionComplete();
  };

  const resetProgressForPenalty = () => {
    activatedSectionTriggersRef.current = {};
    completedSectionsRef.current.clear();
    setServiceResolutions({});
    setPenaltyResetCount((current) => current + 1);
    resetSpeedBoost();
    onPenaltyCollect();
  };

  const sectionResetKey = `${restartKey}:${penaltyResetCount}`;

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
      <Environment preset="warehouse" background={false} environmentIntensity={0.16} />
      <ModularTerrain radius={7} />
      <HomeBase />
      <LogoLightField
        onCoinCollect={onCoinCollect}
        onOpenShare={onOpenShare}
        onPenaltyCollect={resetProgressForPenalty}
        restartKey={restartKey}
      />
      <TransportPads onTransport={setTransportDestination} restartKey={restartKey} />
      <HubSections
        onSectionTrigger={recordSectionTrigger}
        restartKey={sectionResetKey}
        serviceResolutions={serviceResolutions}
      />
      <CombatPrototype
        onBonusCollect={onBonusCollect}
        restartKey={sectionResetKey}
        shootRequest={shootRequest}
        onSectionTrigger={recordSectionTrigger}
        onPlayerDialogue={(text) => setPlayerDialogue(createDialogue(text))}
        onVillainDialogue={(sectionName, text) => {
          setVillainDialogue({
            ...createDialogue(text),
            sectionName,
          });
        }}
        onSectionResolved={(sectionId) => {
          recordSectionTrigger(sectionId, "resolved");
          setServiceResolutions((current) => ({
            ...current,
            [sectionId]: true,
          }));
        }}
        villainDialogue={villainDialogue}
      />
      <CharacterController
        dialogue={playerDialogue}
        movementLocked={movementLocked}
        onFixedAnimationComplete={handleShootAnimationComplete}
        restartKey={restartKey}
        shootRequest={shootRequest}
        transportDestination={transportDestination}
      />
    </>
  );
}
