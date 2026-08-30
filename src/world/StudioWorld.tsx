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
  damageFlashUntil: number;
  onBonusCollect: () => void;
  onCoinCollect: () => void;
  onHealthCollect: () => boolean;
  onOpenShare: () => void;
  onPlayerDamage: () => void;
  onReset: () => void;
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

export function StudioWorld({ damageFlashUntil, onBonusCollect, onCoinCollect, onHealthCollect, onOpenShare, onPlayerDamage, onReset, onSectionComplete, restartKey, shootRequest }: StudioWorldProps) {
  const dialogueIdRef = useRef(0);
  const activatedSectionTriggersRef = useRef<Record<string, Set<string>>>({});
  const completedSectionsRef = useRef(new Set<string>());
  const [movementLocked, setMovementLocked] = useState(false);
  const [activeServiceInfoId, setActiveServiceInfoId] = useState<string | null>(null);
  const [serviceResolutions, setServiceResolutions] = useState<Record<string, boolean>>({});
  const [playerDialogue, setPlayerDialogue] = useState<DialogueMessage | null>(null);
  const [transportDestination, setTransportDestination] = useState<TransportDestination | null>(null);
  const handleShootAnimationComplete = useCallback(() => setMovementLocked(false), []);

  useEffect(() => {
    activatedSectionTriggersRef.current = {};
    completedSectionsRef.current.clear();
    setMovementLocked(false);
    setActiveServiceInfoId(null);
    setServiceResolutions({});
    setPlayerDialogue(null);
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
        onHealthCollect={onHealthCollect}
        onOpenShare={onOpenShare}
        onReset={onReset}
        restartKey={restartKey}
      />
      <TransportPads onTransport={setTransportDestination} restartKey={restartKey} />
      <HubSections
        activeServiceInfoId={activeServiceInfoId}
        onSectionTrigger={recordSectionTrigger}
        restartKey={restartKey}
        serviceResolutions={serviceResolutions}
      />
      <CombatPrototype
        onBonusCollect={onBonusCollect}
        onInfoChange={setActiveServiceInfoId}
        onPlayerDamage={onPlayerDamage}
        restartKey={restartKey}
        shootRequest={shootRequest}
        onSectionTrigger={recordSectionTrigger}
        onPlayerDialogue={(text) => setPlayerDialogue(createDialogue(text))}
        onSectionResolved={(sectionId) => {
          recordSectionTrigger(sectionId, "resolved");
          setServiceResolutions((current) => ({
            ...current,
            [sectionId]: true,
          }));
        }}
      />
      <CharacterController
        damageFlashUntil={damageFlashUntil}
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
