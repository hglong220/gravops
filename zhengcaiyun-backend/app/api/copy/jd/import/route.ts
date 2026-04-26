import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActorFromRequest } from '@/lib/request-actor';

type ProductData = {
  title?: string;
  price?: string;
  images?: string[];
  detailImages?: string[];
  detailHtml?: string;
  attributes?: Record<string, unknown>;
  brand?: string;
  model?: string;
  categoryPath?: string[];
  shopName?: string;
  skuData?: any;
};

function addSpaceToModel(model: string | null | undefined): string {
  if (!model) return '';
  return model.replace(/([a-zA-Z])(\d)/g, '$1 $2').trim();
}

function isLikelyJdSku(value: string | null | undefined): boolean {
  return /^\d{8,}$/.test(String(value || '').trim());
}

function extractModelToken(text: string | null | undefined): string {
  const value = String(text || '').trim();
  if (!value) return '';
  const tokens = value.match(/[A-Za-z]{1,}[A-Za-z0-9-]{2,}\d[A-Za-z0-9-]*/g) || [];
  return tokens.find(token => !isLikelyJdSku(token)) || '';
}

function resolveProductModel(
  title: string,
  productData: ProductData,
  attributes: Record<string, string>,
  skuData: any
): string {
  const candidates = [
    attributes['认证型号'],
    attributes['型号'],
    attributes['商品型号'],
    attributes['货号'],
    extractModelToken(attributes['国补备案型号']),
    extractModelToken(skuData?.selectedSaleSpecs?.[0]?.value),
    extractModelToken(skuData?.specGroups?.[0]?.selected),
    !isLikelyJdSku(productData.model) ? productData.model : '',
    !isLikelyJdSku(skuData?.model) ? skuData?.model : '',
    extractModelToken(title)
  ];

  return String(candidates.find(value => value && !isLikelyJdSku(String(value))) || '').trim();
}

function normalizeStringMap(input: Record<string, unknown> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (!key) continue;
    out[key] = String(value ?? '');
  }
  return out;
}

function buildDetailHtml(images: string[]): string {
  return images.map((src) => `<p><img src="${String(src).replace(/"/g, '&quot;')}" style="max-width:100%;" /></p>`).join('\n');
}

function summarizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 500);
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getActorFromRequest(request);
    let userId = actor?.userId || null;
    if (!userId && process.env.NODE_ENV !== 'production') {
      const smokeUser = await prisma.user.findUnique({
        where: { email: 'smoke_user' },
        select: { id: true }
      });
      userId = smokeUser?.id || null;
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const url = String(body?.url || body?.productData?.sourceUrl || '');
    const productData = (body?.productData || {}) as ProductData;

    if (!url.includes('jd.com')) {
      return NextResponse.json({ error: 'Invalid JD URL' }, { status: 400 });
    }

    const title = String(productData.title || '').trim();
    const images = Array.isArray(productData.images) ? productData.images.filter(Boolean) : [];
    const detailImages = Array.isArray(productData.detailImages) ? productData.detailImages.filter(Boolean) : [];
    if (!title || images.length === 0) {
      return NextResponse.json({ error: 'Current JD page is not readable or has no product images' }, { status: 400 });
    }

    const attributes = normalizeStringMap(productData.attributes);
    const skuData = productData.skuData && typeof productData.skuData === 'object'
      ? productData.skuData
      : { price: '0', stock: '99' };
    const extractedBrand = productData.brand || attributes['品牌'] || undefined;
    const extractedModel = resolveProductModel(title, productData, attributes, skuData) || undefined;
    const cleanedModel = addSpaceToModel(extractedModel);
    const marketPrice = parseFloat(String(skuData?.price || productData.price || '0')) || 0;
    const salePrice = marketPrice > 0 ? Math.round(marketPrice * 0.9 * 100) / 100 : 0;
    const detailHtml = productData.detailHtml || buildDetailHtml(detailImages);

    const existing = await prisma.productDraft.findFirst({
      where: {
        userId,
        originalUrl: url
      }
    });

    const data = {
      title,
      images: JSON.stringify(images),
      attributes: JSON.stringify(attributes),
      detailHtml,
      detailImages: JSON.stringify(detailImages),
      skuData: JSON.stringify(skuData),
      shopName: productData.shopName || '京东',
      status: 'scraped',
      brand: extractedBrand,
      model: cleanedModel || undefined,
      marketPrice,
      price: salePrice
    };

    const draft = existing
      ? await prisma.productDraft.update({ where: { id: existing.id }, data })
      : await prisma.productDraft.create({
          data: {
            userId,
            originalUrl: url,
            ...data
          }
        });

    return NextResponse.json({ success: true, draft, message: 'JD product saved from desktop browser' });
  } catch (error) {
    console.error('[API /copy/jd/import] Error:', error);
    return NextResponse.json({ error: 'Save failed', details: summarizeError(error) }, { status: 500 });
  }
}
