import { scenerySettings } from "./scenery/sceneryLayout";
import { isCompactVisualBudget } from "./visualQuality";
import { WINTER_THEME_ENABLED } from "./winterTheme";
import { WinterSnow } from "./systems/WinterSnow";
import { FixPowerPickups } from "./systems/FixPowerPickups";
import { Environment } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import { WinterScenery } from "./systems/WinterScenery";
import { CharacterController } from "../player/CharacterController";
import { DialogueMessage } from "../ui/DialogueBubble";
import { CombatPrototype } from "./systems/CombatPrototype";
import { HubSections } from "./systems/HubSections";
import { HomeBase } from "./systems/HomeBase";
import { LogoLightField } from "./systems/LogoLightField";
import { ModularTerrain, useSharedGroundMaterial } from "./systems/ModularTerrain";
import { SpaceSky } from "./systems/SpaceSky";
import { WorldLights } from "./systems/WorldLights";
import { TransportPads } from "./systems/TransportPads";
import type { TransportDestination } from "./systems/TransportPads";

type StudioWorldProps = {
  damageFlashUntil: number;
  onVillainReward: (amount: number) => void;
  onCoinCollect: () => void;
  onHealthCollect: () => boolean;
  onOpenShare: () => void;
  onPlayerDamage: () => void;
  onReset: () => void;
  onSectionComplete: () => void;
  restartKey: number;
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

export function StudioWorld({ damageFlashUntil, onVillainReward, onCoinCollect, onHealthCollect, onOpenShare, onPlayerDamage, onReset, onSectionComplete, restartKey }: StudioWorldProps) {
  const groundMaterial = useSharedGroundMaterial();
  const dialogueIdRef = useRef(0);
  const activatedSectionTriggersRef = useRef<Record<string, Set<string>>>({});
  const completedSectionsRef = useRef(new Set<string>());
  const [activeServiceInfoId, setActiveServiceInfoId] = useState<string | null>(null);
  const [serviceResolutions, setServiceResolutions] = useState<Record<string, boolean>>({});
  const [playerDialogue, setPlayerDialogue] = useState<DialogueMessage | null>(null);
  const [transportDestination, setTransportDestination] = useState<TransportDestination | null>(null);

  useEffect(() => {
    activatedSectionTriggersRef.current = {};
    completedSectionsRef.current.clear();
    setActiveServiceInfoId(null);
    setServiceResolutions({});
    setPlayerDialogue(null);
    setTransportDestination(null);
  }, [restartKey]);


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
      {scenerySettings.enabled && <WinterScenery />}
      {WINTER_THEME_ENABLED && <WinterSnow />}
      <FixPowerPickups key={`powers:${restartKey}`} />
      <SpaceSky />
      {!isCompactVisualBudget() && <Environment preset="warehouse" background={false} environmentIntensity={0.16} />}
      <ModularTerrain material={groundMaterial} />
      <HomeBase material={groundMaterial} />
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
        key={`combat:${restartKey}`}
        onVillainReward={onVillainReward}
        onInfoChange={setActiveServiceInfoId}
        onPlayerDamage={onPlayerDamage}
        restartKey={restartKey}
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
        restartKey={restartKey}
        transportDestination={transportDestination}
      />
    </>
  );
}
