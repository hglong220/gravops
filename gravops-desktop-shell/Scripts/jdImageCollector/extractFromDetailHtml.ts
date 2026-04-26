// Stable core module. Run `npm run test:jd-image` before changing this file.

import { normalizeJdImageUrl } from './imageNormalize';
import type { ImageRecord } from './types';

export function extractFromDetailHtml(html: string, captureId: string, productId: string, skuId?: string): ImageRecord[] {
  const records: ImageRecord[] = [];
  const seen = new Set<string>();
  const normalizedHtml = String(html || '').replace(/\\\//g, '/').replace(/&amp;/g, '&');
  const patterns = [
    /https?:\/\/[^"'\\\s<>]+(?:jpg|jpeg|png|gif)(?:\?[^"'\\\s<>]*)?/gi,
    /\/\/[^"'\\\s<>]+(?:jpg|jpeg|png|gif)(?:\?[^"'\\\s<>]*)?/gi,
    /(?:^|["'\s(])((?:\/?jfs\/|s\d+x\d+_jfs\/)[^"'\\\s<>]+(?:jpg|jpeg|png|gif)(?:\?[^"'\\\s<>]*)?)/gi
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(normalizedHtml))) {
      const url = normalizeJdImageUrl(match[1] || match[0], 'detail');
      if (!url || seen.has(url)) continue;
      seen.add(url);
      records.push({ url, source: 'detail_html', captureId, productId, skuId, keepReason: 'detail-html-source' });
    }
  }

  return records;
}
