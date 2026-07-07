export const characterAnimationStates = ["idle", "run"] as const;

export type CharacterAnimationState = (typeof characterAnimationStates)[number];
