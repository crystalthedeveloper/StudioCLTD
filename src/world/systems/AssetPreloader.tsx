import { useGLTF, useTexture } from "@react-three/drei";
import { useEffect } from "react";
import { LinearFilter, SRGBColorSpace, Texture } from "three";

const characterPath = "/characters/char.glb";

const requiredTexturePaths = [
  "/images/8k_stars_milky_way.jpg",
  "/images/8k_venus_surface.jpg",
  "/images/8k_earth_nightmap.jpg",
  "/images/quickFix/quick-fix-bad.png",
  "/images/quickFix/quick-fix-good.png",
  "/images/urgentFix/urgent-fix-bad.png",
  "/images/urgentFix/urgent-fix-good.png",
  "/images/performance/performance-bad.png",
  "/images/performance/performance-good.png",
  "/images/siteImprovement/site-improvement-bad.png",
  "/images/siteImprovement/site-improvement-good.png",
  "/images/tips/tip.png",
  "/images/values/value.png",
  "/images/offers/quick-fix.png",
  "/images/offers/urgent-fix.png",
  "/images/offers/performance.png",
  "/images/offers/site-improvement.png",
] as const;

type AssetPreloaderProps = {
  onReady: () => void;
};

export function AssetPreloader({ onReady }: AssetPreloaderProps) {
  useGLTF(characterPath);
  const textures = useTexture([...requiredTexturePaths]) as Texture[];

  useEffect(() => {
    textures.forEach((texture) => {
      texture.colorSpace = SRGBColorSpace;
      texture.generateMipmaps = false;
      texture.minFilter = LinearFilter;
      texture.magFilter = LinearFilter;
      texture.needsUpdate = true;
    });

    onReady();
  }, [onReady, textures]);

  return null;
}

useGLTF.preload(characterPath);
requiredTexturePaths.forEach((path) => useTexture.preload(path));
