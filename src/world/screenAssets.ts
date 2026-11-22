import images from './screen-assets.json';
import { isCompactVisualBudget } from './visualQuality';

/** Same source artwork, sized before download; URL changes only with image content. */
export function screenAssetForDevice(path: string) {
  const image = (images as Record<string, { mobile: { url: string }; desktop: { url: string } }>)[path];
  if (!image) throw new Error(`Screen asset is missing from the generated manifest: ${path}`);
  return image[isCompactVisualBudget() ? 'mobile' : 'desktop'].url;
}
