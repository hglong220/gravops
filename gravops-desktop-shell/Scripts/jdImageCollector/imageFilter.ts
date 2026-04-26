// Stable core module. Run `npm run test:jd-image` before changing this file.

import { canonicalImageKey, urlPayloadSize } from './imageNormalize';
import type { ImageFilterDecision, ImageRecord } from './types';

export type FilterContext = {
  captureId: string;
  productId: string;
  mainImageUrls: string[];
  detailClickedAt?: number;
};

export function filterJdImage(image: ImageRecord & { timestamp?: number; context?: string }, context: FilterContext): ImageFilterDecision {
  const reasons: string[] = [];
  const lower = image.url.toLowerCase();
  const mainKeys = new Set(context.mainImageUrls.map(canonicalImageKey));
  const highTrustSource = image.source === 'detail_html' || image.source === 'detail_dom';
  const payloadSize = urlPayloadSize(image.url);

  if (image.captureId !== context.captureId) reasons.push('capture-id-mismatch');
  if (image.productId && image.productId !== context.productId) reasons.push('product-id-mismatch');
  if (!/\.(jpg|jpeg|png|gif)(?:$|\?)/i.test(new URL(image.url).pathname)) reasons.push('not-image-extension');
  if (mainKeys.has(canonicalImageKey(image.url))) reasons.push('same-as-main-image');
  if (/logo|avatar|qrcode|sprite|icon|joy|loading|refresh_loading|plus|crown/i.test(lower)) reasons.push('decorative');
  if (/\/comment|\/shaidan\/|getavatar|\/user\/|\/shop\/|\/popshop\/|\/babel\/|\/common\/|\/uba\/|\/misc\/|retail-mall|mall-common-component|imagetools/i.test(lower)) {
    reasons.push('comment-shop-common-or-ui');
  }
  if (image.width && image.height && (image.width < 120 || image.height < 120)) reasons.push('too-small-dom');
  if (payloadSize > 0 && payloadSize < (highTrustSource ? 2500 : 8000)) reasons.push('too-small-payload');
  if (image.source === 'network_fallback' && context.detailClickedAt && image.timestamp && image.timestamp < context.detailClickedAt) {
    reasons.push('captured-before-detail-tab');
  }

  return {
    keep: reasons.length === 0,
    reason: reasons.length ? reasons.join('|') : 'kept'
  };
}
