import { AnimationAction, AnimationClip, AnimationUtils, LoopOnce, LoopRepeat } from "three";
import { gameNow, isGameFocused } from "../player/gameFocus";

export const attackCooldownMs = 450;
export function villainClips(clips: AnimationClip[]) {
  const hit = clips.find((clip) => clip.name === "hitV");
  // hitV contains two strikes. Keep the first strike and recovery as one attack.
  return hit ? [...clips, AnimationUtils.subclip(hit, "attackV", 0, 40, 30)] : clips;
}
export function createVillainCombat(actions: Record<string, AnimationAction | null>) {
  let current: AnimationAction | null = null;
  let motion = "";
  let nextAttackAt = 0;
  function setMotion(next: "idle" | "running" | "attack" | "dead") {
    if (motion === next) return;
    const action = actions[{ idle: "idleV", running: "runV", attack: "attackV", dead: "dieV" }[next]];
    if (!action) return;
    const previous = current;
    motion = next;
    current = action;
    action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1);
    action.setLoop(next === "dead" || next === "attack" ? LoopOnce : LoopRepeat, Infinity);
    action.clampWhenFinished = next === "dead" || next === "attack";
    action.play();
    if (previous) { previous.fadeOut(0.12); action.fadeIn(0.12); }
  }
  return {
    setMotion,
    /** Visual feedback only. Returns true during attack/recovery; never applies damage. */
    updateAttack(inRange: boolean, alive: boolean) {
      if (!isGameFocused()) return true;
      if (!alive) { setMotion("dead"); return true; }
      if (!inRange) {
        if (motion === "attack") { nextAttackAt = gameNow() + attackCooldownMs; setMotion("idle"); }
        return false;
      }
      if (motion !== "attack") {
        setMotion("idle");
        if (gameNow() < nextAttackAt || !actions.attackV) return true;
        setMotion("attack");
      }
      if (current && current.time >= current.getClip().duration) {
        nextAttackAt = gameNow() + attackCooldownMs;
        setMotion("idle");
      }
      return true;
    },
  };
}
