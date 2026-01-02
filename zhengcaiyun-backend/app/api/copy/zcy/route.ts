import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActorFromRequest } from '@/lib/request-actor';

// 辅助函数：在型号的字母和数字之间自动加空格
function addSpaceToModel(model: string | null | undefined): string {
    if (!model) return '';
    return model.replace(/([a-zA-Z])(\d)/g, '$1 $2').trim();
}

// 辅助函数：从 skuData 中提取价格并计算销售价
function calculatePrices(skuData: any): { marketPrice?: number; price?: number } {
    let parsedSku = skuData;
    if (typeof skuData === 'string') {
        try {
            parsedSku = JSON.parse(skuData);
        } catch {
            return {};
        }
    }
    const originalPrice = parsedSku?.price;
    if (!originalPrice || isNaN(parseFloat(originalPrice))) {
        return {};
    }
    const marketPrice = parseFloat(originalPrice);
    const salePrice = Math.round(marketPrice * 0.9 * 100) / 100;
    return {
        marketPrice: marketPrice,
        price: salePrice
    };
}

/**
 * POST /api/copy/zcy
 * 政采云站内复制 - 接收前端提取的数据并保存
 */
export async function POST(request: NextRequest) {
    try {
        // 临时禁用授权验证
        const actor = await getActorFromRequest(request);
        if (!actor) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = actor.kind === 'user' ? actor.userId : actor.userId;
        if (!userId) {
            return NextResponse.json({ error: 'License is not linked to a user' }, { status: 401 });
        }

        const body = await request.json();
        const {
            originalUrl,
            title,
            images,
            attributes,
            detailHtml,
            skuData,
            shopName,
            rapidMode
        } = body;

        if (!originalUrl || !originalUrl.includes('zcygov.cn')) {
            return NextResponse.json(
                { error: '请提供有效的政采云商品链接' },
                { status: 400 }
            );
        }

        console.log(`[API /copy/zcy] User ${userId} copying from ZCY: ${originalUrl}`);

        const existing = await prisma.productDraft.findFirst({
            where: {
                userId,
                originalUrl
            }
        });

        let draft;
        if (existing) {
            let parsedAttrs = attributes;
            if (typeof attributes === 'string') {
                try { parsedAttrs = JSON.parse(attributes); } catch { parsedAttrs = {}; }
            }
            const extractedBrand = parsedAttrs?.['品牌'] || undefined;
            const extractedModel = parsedAttrs?.['型号'] || parsedAttrs?.['商品型号'] || undefined;
            const cleanedModel = addSpaceToModel(extractedModel);

            let parsedSku = skuData;
            if (typeof skuData === 'string') {
                try { parsedSku = JSON.parse(skuData); } catch { parsedSku = {}; }
            }
            const marketPrice = parseFloat(parsedSku?.price || '0') || 0;
            const salePrice = marketPrice > 0 ? Math.round(marketPrice * 0.9 * 100) / 100 : 0;

            draft = await prisma.productDraft.update({
                where: { id: existing.id },
                data: {
                    title: title || existing.title,
                    images: typeof images === 'string' ? images : JSON.stringify(images || []),
                    attributes: typeof attributes === 'string' ? attributes : JSON.stringify(attributes || {}),
                    detailHtml: detailHtml || existing.detailHtml,
                    skuData: typeof skuData === 'string' ? skuData : JSON.stringify(skuData || {}),
                    shopName: shopName || existing.shopName,
                    status: 'scraped',
                    brand: extractedBrand,
                    model: cleanedModel || undefined,
                    marketPrice: marketPrice,
                    price: salePrice
                }
            });
        } else {
            let parsedAttrs = attributes;
            if (typeof attributes === 'string') {
                try { parsedAttrs = JSON.parse(attributes); } catch { parsedAttrs = {}; }
            }
            const extractedBrand = parsedAttrs?.['品牌'] || undefined;
            const extractedModel = parsedAttrs?.['型号'] || parsedAttrs?.['商品型号'] || undefined;
            const cleanedModel = addSpaceToModel(extractedModel);

            let parsedSku = skuData;
            if (typeof skuData === 'string') {
                try { parsedSku = JSON.parse(skuData); } catch { parsedSku = {}; }
            }
            const marketPrice = parseFloat(parsedSku?.price || '0') || 0;
            const salePrice = marketPrice > 0 ? Math.round(marketPrice * 0.9 * 100) / 100 : 0;

            draft = await prisma.productDraft.create({
                data: {
                    userId,
                    originalUrl,
                    title: title || '政采云商品',
                    images: typeof images === 'string' ? images : JSON.stringify(images || []),
                    attributes: typeof attributes === 'string' ? attributes : JSON.stringify(attributes || {}),
                    detailHtml: detailHtml || '',
                    skuData: typeof skuData === 'string' ? skuData : JSON.stringify(skuData || {}),
                    shopName: shopName || '政采云店铺',
                    status: 'scraped',
                    brand: extractedBrand,
                    model: cleanedModel || undefined,
                    marketPrice: marketPrice,
                    price: salePrice
                }
            });
        }

        console.log(`[API /copy/zcy] Successfully saved draft: ${draft.id}`);

        return NextResponse.json({
            success: true,
            draft,
            message: '政采云商品复制成功',
            rapidMode: !!rapidMode
        });

    } catch (error) {
        console.error('[API /copy/zcy] Error:', error);
        return NextResponse.json(
            {
                error: '复制失败',
                details: (error as Error).message
            },
            { status: 500 }
        );
    }
}

export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
