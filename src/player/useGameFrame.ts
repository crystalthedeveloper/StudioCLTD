import { useFrame, type RenderCallback } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { AnimationAction, AnimationClip, AnimationMixer, Object3D } from "three";
import { isGameFocused, subscribeGameFocus } from "./gameFocus";

export function useGameFrame(callback: RenderCallback) {
  useFrame((state, delta, frame) => {
    if (isGameFocused()) callback(state, delta, frame);
  });
}

/** One gameplay mixer, with a static idle preview while simulation is paused. */
export function useGameAnimations(clips: AnimationClip[], root: RefObject<Object3D>, idleName: string) {
  const mixers = useRef<{ gameplay: AnimationMixer; preview: AnimationMixer } | null>(null);
  const [animationReady, setAnimationReady] = useState(false);
  const actions = useMemo(() => {
    const result: Record<string, AnimationAction | null> = {};
    for (const clip of clips) {
      Object.defineProperty(result, clip.name, {
        enumerable: true,
        get: () => mixers.current?.gameplay.clipAction(clip) ?? null,
      });
    }
    return result;
  }, [clips]);

  useLayoutEffect(() => {
    const object = root.current;
    if (!object) return;
    const gameplay = new AnimationMixer(object);
    const preview = new AnimationMixer(object);
    mixers.current = { gameplay, preview };
    const idle = clips.find((clip) => clip.name === idleName);
    if (import.meta.env?.DEV && !idle) {
      let armatureFound = false;
      let skinnedMeshFound = false;
      object.traverse((child) => {
        if (child.type === "Bone" || child.name.toLowerCase().includes("armature")) armatureFound = true;
        if (child.type === "SkinnedMesh") skinnedMeshFound = true;
      });
      console.warn("[villain] idle animation could not bind", {
        availableAnimations: clips.map((clip) => clip.name),
        clonedRoot: object.name || "(unnamed)",
        armatureFound,
        skinnedMeshFound,
      });
    }
    const startGameplayIdle = () => {
      if (!idle) return false;
      gameplay.clipAction(idle).reset().setEffectiveWeight(1).play();
      gameplay.update(0);
      return true;
    };
    const syncPause = () => {
      if (isGameFocused()) {
        // stop restores the exact pose captured before preview, without resetting
        // gameplay action times, fades, or death animation state.
        preview.stopAllAction();
        startGameplayIdle();
      } else if (idle) {
        preview.clipAction(idle).reset().setEffectiveWeight(1).play();
        preview.update(0);
      }
    };
    setAnimationReady(Boolean(idle && startGameplayIdle()));
    syncPause();
    const unsubscribe = subscribeGameFocus(syncPause);
    return () => {
      unsubscribe();
      preview.stopAllAction();
      gameplay.stopAllAction();
      preview.uncacheRoot(object);
      gameplay.uncacheRoot(object);
      mixers.current = null;
      setAnimationReady(false);
    };
  }, [clips, idleName, root]);

  useFrame((_, delta) => {
    if (!isGameFocused()) return;
    // Every active villain advances its mixer, including pooled villains that
    // are just outside the camera. This guarantees a recycled villain has a
    // valid idle pose before it becomes visible again.
    mixers.current?.gameplay.update(delta);
  });
  return { actions, animationReady };
}
