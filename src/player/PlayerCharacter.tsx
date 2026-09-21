import { Group } from "three";
import { PlayerRollingEffects } from "./PlayerRollingEffects";
import { MutableRefObject, useRef } from "react";
import { DialogueBubble, DialogueMessage } from "../ui/DialogueBubble";
import { playerSphereRadius as sphereRadius } from "./playerDimensions";
import { CharacterAnimationState } from "./playerTypes";
import { PlayerSmokeOrb } from "./PlayerSmokeOrb";

type PlayerCharacterProps = {
  animationStateRef: MutableRefObject<CharacterAnimationState>;
  damageFlashUntil: number;
  dialogue: DialogueMessage | null;
  yawRef: MutableRefObject<number>;
};

/** Visual replacement only; CharacterController retains the original Rapier sphere. */
export function PlayerCharacter({ damageFlashUntil, dialogue }: PlayerCharacterProps) {
  const groundAnchor = useRef<Group>(null);
  return <group>
    <group ref={groundAnchor} name="Player ground-effect anchor" />
    <PlayerRollingEffects sphere={groundAnchor} />
    <PlayerSmokeOrb damageFlashUntil={damageFlashUntil} />
    <DialogueBubble message={dialogue} position={[0, 2.65 - sphereRadius, 0]} />
  </group>;
}
