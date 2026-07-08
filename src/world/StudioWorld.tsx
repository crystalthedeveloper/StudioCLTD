import { Environment } from "@react-three/drei";
import { useState } from "react";
import { CharacterController } from "../player/CharacterController";
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
  const [quickFixResolved, setQuickFixResolved] = useState(false);

  return (
    <>
      <WorldLights />
      <SpaceSky />
      <Environment preset="warehouse" background={false} environmentIntensity={0.08} />
      <ModularTerrain radius={7} />
      <GlowCubeField />
      <SpeedPowerUp />
      <HubSections quickFixResolved={quickFixResolved} onActiveSectionChange={onActiveSectionChange} />
      <CombatPrototype onQuickFixResolved={() => setQuickFixResolved(true)} />
      <CharacterController />
      <CinematicPostProcessing />
    </>
  );
}
