import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Vector2 } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

export function CinematicPostProcessing() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const viewport = useThree((state) => state.viewport);

  const composer = useMemo(() => new EffectComposer(gl), [gl]);
  const renderPass = useMemo(() => new RenderPass(scene, camera), [camera, scene]);
  const bloomPass = useMemo(
    () => new UnrealBloomPass(new Vector2(size.width, size.height), 0.44, 0.76, 0.36),
    [size.height, size.width]
  );

  useEffect(() => {
    composer.addPass(renderPass);
    composer.addPass(bloomPass);

    return () => {
      composer.removePass(renderPass);
      composer.removePass(bloomPass);
      composer.dispose();
    };
  }, [bloomPass, composer, renderPass]);

  useEffect(() => {
    composer.setPixelRatio(Math.min(viewport.dpr, 1));
    composer.setSize(size.width, size.height);
    bloomPass.setSize(size.width, size.height);
  }, [bloomPass, composer, size.height, size.width, viewport.dpr]);

  useFrame(() => {
    composer.render();
  }, 1);

  return null;
}
