import { useFrame, type RenderCallback } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { AnimationAction, AnimationClip, AnimationMixer, Object3D, Frustum, Matrix4, Sphere, Vector3 } from "three";
import { isGameFocused, subscribeGameFocus } from "./gameFocus";

export function useGameFrame(callback: RenderCallback) {
  useFrame((state, delta, frame) => {
    if (isGameFocused()) callback(state, delta, frame);
  });
}

/** One gameplay mixer, with a static idle preview while simulation is paused. */
export function useGameAnimations(clips: AnimationClip[], root: RefObject<Object3D>, idleName: string) {
  const visibility = useMemo(() => ({ frustum: new Frustum(), matrix: new Matrix4(), sphere: new Sphere(new Vector3(), 3) }), []);
  const mixers = useRef<{ gameplay: AnimationMixer; preview: AnimationMixer } | null>(null);
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
    const syncPause = () => {
      if (isGameFocused()) {
        // stop restores the exact pose captured before preview, without resetting
        // gameplay action times, fades, or death animation state.
        preview.stopAllAction();
      } else if (idle) {
        preview.clipAction(idle).reset().setEffectiveWeight(1).play();
        preview.update(0);
      }
    };
    syncPause();
    const unsubscribe = subscribeGameFocus(syncPause);
    return () => {
      unsubscribe();
      preview.stopAllAction();
      gameplay.stopAllAction();
      preview.uncacheRoot(object);
      gameplay.uncacheRoot(object);
      mixers.current = null;
    };
  }, [clips, idleName, root]);

  useFrame(({ camera }, delta) => {
    if (!isGameFocused()) return;
    // Keep nearby attack/death feedback smooth; damage is independent of mixers.
    if (idleName === "idleV" && root.current) {
      root.current.getWorldPosition(visibility.sphere.center);
      visibility.frustum.setFromProjectionMatrix(visibility.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      if (camera.position.distanceToSquared(visibility.sphere.center) > 24 * 24
        && !visibility.frustum.intersectsSphere(visibility.sphere)) return;
    }
    mixers.current?.gameplay.update(delta);
  });
  return { actions };
}
