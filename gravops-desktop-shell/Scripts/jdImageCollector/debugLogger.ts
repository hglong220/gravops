// Stable core module. Run `npm run test:jd-image` before changing this file.

import type { CollectDebugInfo, JdImageCollectResult } from './types';

export function createDebugInfo(result: JdImageCollectResult): CollectDebugInfo {
  return {
    captureId: result.captureId,
    productId: result.productId,
    skuId: result.skuId,
    pageUrl: result.pageUrl,
    mainImageCount: result.mainImages.length,
    detailHtmlImageCount: result.detailImages.filter((item) => item.source === 'detail_html').length,
    detailDomImageCount: result.detailImages.filter((item) => item.source === 'detail_dom').length,
    networkFallbackImageCount: result.detailImages.filter((item) => item.source === 'network_fallback').length,
    finalDetailImageCount: result.detailImages.length,
    filteredImageCount: 0,
    imageDecisions: []
  };
}

export function shouldDebugJdImages(): boolean {
  return typeof process !== 'undefined' && process.env.JD_IMAGE_DEBUG === 'true';
}
