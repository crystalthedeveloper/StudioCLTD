import { useMemo, useRef, useState } from 'react';
import { Frustum, Matrix4, Mesh, Sphere, Vector3 } from 'three';
import { useGameFrame } from '../player/useGameFrame';

/** Frustum + distance check at 5 Hz; no per-frame React updates or allocations. */
export function useScreenVisibility() {
  const ref = useRef<Mesh>(null);
  const [visible, setVisible] = useState(false);
  const check = useRef(-Infinity);
  const scratch = useMemo(() => ({ frustum: new Frustum(), matrix: new Matrix4(), sphere: new Sphere(new Vector3(), 7) }), []);
  useGameFrame(({ camera, clock }) => {
    if (!ref.current || clock.elapsedTime - check.current < 0.2) return;
    check.current = clock.elapsedTime;
    ref.current.getWorldPosition(scratch.sphere.center);
    scratch.frustum.setFromProjectionMatrix(scratch.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const next = camera.position.distanceToSquared(scratch.sphere.center) < 85 * 85 && scratch.frustum.intersectsSphere(scratch.sphere);
    setVisible(current => current === next ? current : next);
  });
  return { ref, visible };
}
