import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActorFromRequest } from '@/lib/request-actor';
import { readJdProductViaCdp } from '@/lib/scrapers/jd-cdp-product-reader';
import { withScrapeLock } from '@/lib/scrape-lock';

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

function hasUsableJdDraft(draft: any): boolean {
    const parse = (value: string | null | undefined, fallback: any) => {
        if (!value) return fallback;
        try {
            return JSON.parse(value);
        } catch {
            return fallback;
        }
    };

    const images = parse(draft.images, []);
    const detailImages = parse(draft.detailImages, []);
    const attributes = parse(draft.attributes, {});
    const skuData = parse(draft.skuData, {});

    return (
        Array.isArray(images) &&
        images.length > 0 &&
        Array.isArray(detailImages) &&
        detailImages.length > 0 &&
        attributes &&
        Object.keys(attributes).length > 0 &&
        skuData &&
        typeof skuData === 'object' &&
        Object.keys(skuData).length > 0
    );
}

/**
 * POST /api/copy/jd
 * 复制京东商品到草稿箱  
 */
export async function POST(request: NextRequest) {
    try {
        // 临时禁用授权验证用于测试
        // const user = await getAuthUser(request);
        // if (!user) {
        //     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        // }

        // 使用测试用户
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

        if (!url || !url.includes('jd.com')) {
            return NextResponse.json(
                { error: '请提供有效的京东商品链接' },
                { status: 400 }
            );
        }

        console.log(`[API /copy/jd] User ${userId} copying: ${url}`);

        // 检查是否已存在
        const existing = await prisma.productDraft.findFirst({
            where: {
                userId,
                originalUrl: url
            }
        });

        if (existing && existing.status === 'scraped' && hasUsableJdDraft(existing)) {
            return NextResponse.json({
                success: true,
                draft: existing,
                message: '商品已存在于草稿箱'
            });
        }

        // 爬取商品数据
        console.log('[API /copy/jd] Scraping product data...');
        let productData;
        try {
            productData = await withScrapeLock(
                () => readJdProductViaCdp(url),
                { maxConcurrency: 1, maxWaitMs: 15_000 }
            );
        } catch (err) {
            if ((err as Error)?.message === 'SCRAPE_BUSY') {
                return NextResponse.json(
                    { error: '当前已有商品读取任务在运行，请稍后再试' },
                    { status: 503 }
                );
            }
            throw err;
        }

        // 保存到数据库
        let draft;
        if (existing) {
            // ⭐ 优先从 skuData.model 提取型号（已确保与价格一致）
            const extractedBrand = productData.brand || productData.attributes?.['品牌'] || undefined;
            const extractedModel = productData.model || productData.skuData?.model || productData.attributes?.['型号'] || productData.attributes?.['商品型号'] || productData.attributes?.['货号'] || undefined;
            const cleanedModel = addSpaceToModel(extractedModel);

            // ⭐ 采集器已经选择了最便宜的SKU，price就是市场价
            const marketPrice = parseFloat(productData.skuData.price) || 0;
            const salePrice = marketPrice > 0 ? Math.round(marketPrice * 0.9 * 100) / 100 : 0;

            console.log(`[JD采集] 价格计算: 市场价=${marketPrice}, 销售价=${salePrice}, SKU price=${productData.skuData.price}`);

            draft = await prisma.productDraft.update({
                where: { id: existing.id },
                data: {
                    title: productData.title,
                    images: JSON.stringify(productData.images),
                    attributes: JSON.stringify(productData.attributes),
                    detailHtml: productData.detailHtml,
                    detailImages: JSON.stringify(productData.detailImages || []),
                    skuData: JSON.stringify(productData.skuData),
                    shopName: productData.shopName || '京东',
                    status: 'scraped',
                    brand: extractedBrand,
                    model: cleanedModel || undefined,
                    marketPrice: marketPrice,
                    price: salePrice
                }
            });
        } else {
            // ⭐ 优先从 skuData.model 提取型号（已确保与价格一致）
            const extractedBrand = productData.brand || productData.attributes?.['品牌'] || undefined;
            const extractedModel = productData.model || productData.skuData?.model || productData.attributes?.['型号'] || productData.attributes?.['商品型号'] || productData.attributes?.['货号'] || undefined;
            const cleanedModel = addSpaceToModel(extractedModel);

            // ⭐ 采集器已经选择了最便宜的SKU，price就是市场价
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
                    detailImages: JSON.stringify(productData.detailImages || []),
                    skuData: JSON.stringify(productData.skuData),
                    shopName: productData.shopName || '京东',
                    status: 'scraped',
                    brand: extractedBrand,
                    model: cleanedModel || undefined,
                    marketPrice: marketPrice,
                    price: salePrice
                }
            });
        }

        console.log(`[API /copy/jd] Successfully saved draft: ${draft.id}`);

        return NextResponse.json({
            success: true,
            draft,
            message: '京东商品复制成功'
        });

    } catch (error) {
        console.error('[API /copy/jd] Error:', error);
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
