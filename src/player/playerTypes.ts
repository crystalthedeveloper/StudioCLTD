export const characterAnimationStates = ["idle", "walk", "run", "jump", "fall", "die", "victory"] as const;

export type CharacterAnimationState = (typeof characterAnimationStates)[number];
