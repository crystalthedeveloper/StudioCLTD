import images from './screen-assets.json';
import { isCompactVisualBudget } from './visualQuality';

/** Same source artwork, sized before download; URL changes only with image content. */
export function screenAssetForDevice(path: string) {
  const image = images[path as keyof typeof images];
  if (!image) throw new Error(`Screen asset is missing from the generated manifest: ${path}`);
  return image[isCompactVisualBudget() ? 'mobile' : 'desktop'].url;
}
