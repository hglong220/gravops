// Stable core module. Run `npm run test:jd-image` before changing this file.

import type { ImageRecord } from './types';
import { filterJdImage } from './imageFilter';

export function mergeDetailImages(args: {
  captureId: string;
  productId: string;
  mainImages: ImageRecord[];
  detailHtmlImages: ImageRecord[];
  detailDomImages: ImageRecord[];
  networkFallbackImages: ImageRecord[];
}): ImageRecord[] {
  const trusted = [...args.detailHtmlImages, ...args.detailDomImages];
  const useNetworkFallback = trusted.length < 3;
  const candidates = useNetworkFallback ? [...trusted, ...args.networkFallbackImages] : trusted;
  const seen = new Set<string>();
  const mainUrls = args.mainImages.map((item) => item.url);
  const kept: ImageRecord[] = [];

  for (const candidate of candidates) {
    if (seen.has(candidate.url)) continue;
    const decision = filterJdImage(candidate, {
      captureId: args.captureId,
      productId: args.productId,
      mainImageUrls: mainUrls
    });
    if (!decision.keep) continue;
    seen.add(candidate.url);
    kept.push({ ...candidate, keepReason: decision.reason });
  }

  return kept;
}
