import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActorFromRequest } from '@/lib/request-actor';
import { scrapeTmallProduct } from '@/lib/scrapers/tmall-scraper';

// 辅助函数：在型号的字母和数字之间自动加空格
function addSpaceToModel(model: string | null | undefined): string {
    if (!model) return '';
    return model.replace(/([a-zA-Z])(\d)/g, '$1 $2').trim();
}

// 辅助函数：从 skuData 中提取价格并计算销售价
function calculatePrices(skuData: any): { marketPrice?: number; price?: number } {
    const originalPrice = skuData?.price;
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
        const { url } = body;

        if (!url || !url.includes('tmall.com')) {
            return NextResponse.json(
                { error: '请提供有效的天猫商品链接' },
                { status: 400 }
            );
        }

        console.log(`[API /copy/tmall] User ${userId} copying: ${url}`);

        const existing = await prisma.productDraft.findFirst({
            where: {
                userId,
                originalUrl: url
            }
        });

        if (existing && existing.status === 'scraped') {
            return NextResponse.json({
                success: true,
                draft: existing,
                message: '商品已存在于草稿箱'
            });
        }

        console.log('[API /copy/tmall] Scraping product data...');
        const productData = await scrapeTmallProduct(url);

        let draft;
        if (existing) {
            // ⭐ 优先从 skuData.model 提取型号
            const extractedBrand = productData.attributes?.['品牌'] || undefined;
            const extractedModel = productData.skuData?.model || productData.attributes?.['型号'] || productData.attributes?.['商品型号'] || undefined;
            const cleanedModel = addSpaceToModel(extractedModel);

            const marketPrice = parseFloat(productData.skuData.price) || 0;
            const salePrice = marketPrice > 0 ? Math.round(marketPrice * 0.9 * 100) / 100 : 0;

            draft = await prisma.productDraft.update({
                where: { id: existing.id },
                data: {
                    title: productData.title,
                    images: JSON.stringify(productData.images),
                    attributes: JSON.stringify(productData.attributes),
                    detailHtml: productData.detailHtml,
                    skuData: JSON.stringify(productData.skuData),
                    shopName: productData.shopName || '天猫',
                    status: 'scraped',
                    brand: extractedBrand,
                    model: cleanedModel || undefined,
                    marketPrice: marketPrice,
                    price: salePrice
                }
            });
        } else {
            // ⭐ 优先从 skuData.model 提取型号
            const extractedBrand = productData.attributes?.['品牌'] || undefined;
            const extractedModel = productData.skuData?.model || productData.attributes?.['型号'] || productData.attributes?.['商品型号'] || undefined;
            const cleanedModel = addSpaceToModel(extractedModel);

            const marketPrice = parseFloat(productData.skuData.price) || 0;
            const salePrice = marketPrice > 0 ? Math.round(marketPrice * 0.9 * 100) / 100 : 0;

            draft = await prisma.productDraft.create({
                data: {
                    userId,
                    originalUrl: url,
                    title: productData.title,
                    images: JSON.stringify(productData.images),
                    attributes: JSON.stringify(productData.attributes),
                    detailHtml: productData.detailHtml,
                    skuData: JSON.stringify(productData.skuData),
                    shopName: productData.shopName || '天猫',
                    status: 'scraped',
                    brand: extractedBrand,
                    model: cleanedModel || undefined,
                    marketPrice: marketPrice,
                    price: salePrice
                }
            });
        }

        console.log(`[API /copy/tmall] Successfully saved draft: ${draft.id}`);

        return NextResponse.json({
            success: true,
            draft,
            message: '天猫商品复制成功'
        });

    } catch (error) {
        console.error('[API /copy/tmall] Error:', error);
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
