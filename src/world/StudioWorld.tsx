import { CharacterController } from "../player/CharacterController";
import { CinematicPostProcessing } from "./systems/CinematicPostProcessing";
import { GlowCubeField } from "./systems/GlowCubeField";
import { ModularTerrain } from "./systems/ModularTerrain";
import { SpaceSky } from "./systems/SpaceSky";
import { WorldLights } from "./systems/WorldLights";

export function StudioWorld() {
  return (
    <>
      <WorldLights />
      <SpaceSky />
      <ModularTerrain radius={7} />
      <GlowCubeField />
      <CharacterController />
      <CinematicPostProcessing />
    </>
  );
}
