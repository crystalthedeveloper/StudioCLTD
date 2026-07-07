import { CharacterController } from "../player/CharacterController";
import { CinematicPostProcessing } from "./systems/CinematicPostProcessing";
import { CombatPrototype } from "./systems/CombatPrototype";
import { GlowCubeField } from "./systems/GlowCubeField";
import { HubSections } from "./systems/HubSections";
import { ModularTerrain } from "./systems/ModularTerrain";
import { SpaceSky } from "./systems/SpaceSky";
import { WorldLights } from "./systems/WorldLights";

type StudioWorldProps = {
  onActiveSectionChange: (sectionName: string | null) => void;
};

export function StudioWorld({ onActiveSectionChange }: StudioWorldProps) {
  return (
    <>
      <WorldLights />
      <SpaceSky />
      <ModularTerrain radius={7} />
      <GlowCubeField />
      <HubSections onActiveSectionChange={onActiveSectionChange} />
      <CombatPrototype />
      <CharacterController />
      <CinematicPostProcessing />
    </>
  );
}
