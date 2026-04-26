// Stable core module. Run `npm run test:jd-image` before changing this file.

import type { ImageRecord } from './types';

export type NetworkCaptureRecord = {
  captureId: string;
  productId: string;
  skuId?: string;
  pageUrl: string;
  title?: string;
  source: 'detail_html' | 'network_fallback';
  url: string;
  timestamp: number;
  body?: string;
};

export function assertCaptureBelongsToCurrentProduct(record: NetworkCaptureRecord, captureId: string, productId: string): boolean {
  return record.captureId === captureId && record.productId === productId;
}

export function networkCaptureToImage(record: NetworkCaptureRecord): ImageRecord {
  return {
    url: record.url,
    source: record.source === 'network_fallback' ? 'network_fallback' : 'detail_html',
    captureId: record.captureId,
    productId: record.productId,
    skuId: record.skuId,
    keepReason: 'network-capture-current-product'
  };
}
