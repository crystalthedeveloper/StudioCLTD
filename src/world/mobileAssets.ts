import variants from './mobile-assets.json';
import { isCompactVisualBudget } from './visualQuality';

/** Stable URL keys allow Drei and screen loaders to share each resource. */
export function assetForDevice(path: string) {
  return isCompactVisualBudget() ? (variants as Record<string, string>)[path] ?? path : path;
}
