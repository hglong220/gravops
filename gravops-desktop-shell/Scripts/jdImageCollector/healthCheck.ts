// Stable core module. Run `npm run test:jd-image` before changing this file.

import type { JdImageCollectResult } from './types';

export type HealthCheckResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

export function checkJdImageCollectHealth(result: JdImageCollectResult, options: { allowEmptyDetailImages?: boolean } = {}): HealthCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const allImages = [...result.mainImages, ...result.detailImages];
  const captureIds = new Set(allImages.map((item) => item.captureId));
  const productIds = new Set(allImages.map((item) => item.productId));
  const networkFallbackCount = result.detailImages.filter((item) => item.source === 'network_fallback').length;
  const mainUrls = new Set(result.mainImages.map((item) => item.url));
  const repeatedDetailUrls = result.detailImages.filter((item) => mainUrls.has(item.url));

  if (result.mainImages.length < 1) errors.push('main-images-empty');
  if (!options.allowEmptyDetailImages && result.detailImages.length < 1) errors.push('detail-images-empty');
  if (captureIds.size > 1) errors.push('capture-id-mismatch');
  if (productIds.size > 1) errors.push('product-id-mismatch');
  if (result.productId && productIds.size === 1 && !productIds.has(result.productId)) errors.push('result-product-id-mismatch');
  if (networkFallbackCount > 0 && networkFallbackCount / Math.max(1, result.detailImages.length) > 0.5) {
    warnings.push('network-fallback-ratio-high');
  }
  if (repeatedDetailUrls.length === result.detailImages.length && result.detailImages.length > 0) {
    errors.push('detail-images-duplicate-main-images');
  }
  if (!result.pageUrl.includes(result.productId)) errors.push('page-url-product-id-mismatch');
  if (result.errors.length) errors.push(...result.errors.map((item) => `collector-error:${item}`));

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}
