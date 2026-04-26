// Stable core module. Run `npm run test:jd-image` before changing this file.

import type { ProductConsistencyInput } from './types';

export function checkProductConsistency(input: ProductConsistencyInput): { ok: boolean; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (input.expectedProductId && input.currentProductId && input.expectedProductId !== input.currentProductId) {
    errors.push('当前页面商品状态不一致，已拒绝采集详情图，避免上传错商品图片。');
  }

  if (input.expectedSkuId && input.currentSkuId && input.expectedSkuId !== input.currentSkuId) {
    errors.push('当前页面 SKU 与采集 SKU 不一致，已拒绝采集详情图。');
  }

  const expectedCodes = new Set([input.expectedModel, input.expectedSkuId, input.expectedProductId].filter(Boolean));
  const foundCodes = Array.from(new Set((input.detailText || '').match(/\b[A-Z]{1,5}\d{3,8}\b/g) || []));
  const mismatches = foundCodes.filter((code) => expectedCodes.size && !expectedCodes.has(code));
  if (mismatches.length) {
    warnings.push(`警告：详情内容货号与当前商品货号不一致，可能是 SPU 通用详情或页面状态错乱。found=${mismatches.join('|')}`);
  }

  return {
    ok: errors.length === 0,
    warnings,
    errors
  };
}
