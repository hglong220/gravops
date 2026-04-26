// jdImageCollector is a stable core module.
// Any change to collectDetailImages, networkCapture, imageFilter, or productConsistencyCheck
// must pass `npm run test:jd-image` before merge.
//
// The production WebView runtime currently executes jd-webview-reader.js. This module defines
// the stable contract and pure guard functions that future refactors must preserve.

export * from './types';
export * from './imageNormalize';
export * from './imageFilter';
export * from './networkCapture';
export * from './extractFromDetailHtml';
export * from './extractFromDom';
export * from './collectMainImages';
export * from './collectDetailImages';
export * from './productConsistencyCheck';
export * from './debugLogger';
export * from './healthCheck';

import type { JdImageCollectResult } from './types';

export async function collectJdProductImages(productUrl: string): Promise<JdImageCollectResult> {
  throw new Error(
    `collectJdProductImages(${productUrl}) must be called through the Gravops WebView reader runtime. ` +
    'Do not bypass jd-webview-reader.js until this module is wired into a bundled browser runtime and regression-tested.'
  );
}
