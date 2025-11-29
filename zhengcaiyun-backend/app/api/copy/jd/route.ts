import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { scrapeJDProduct } from '@/lib/scrapers/jd-product-scraper';

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
        const user = { userId: 'test-user-001', licenseKey: 'TEST-2024' };

        const body = await request.json();
        const { url } = body;

        if (!url || !url.includes('jd.com')) {
            return NextResponse.json(
                { error: '请提供有效的京东商品链接' },
                { status: 400 }
            );
        }

        console.log(`[API /copy/jd] User ${user.userId} copying: ${url}`);

        // 检查是否已存在
        const existing = await prisma.productDraft.findFirst({
            where: {
                userId: user.userId,
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

        // 爬取商品数据
        console.log('[API /copy/jd] Scraping product data...');
        const productData = await scrapeJDProduct(url);

        // 保存到数据库
        let draft;
        if (existing) {
            draft = await prisma.productDraft.update({
                where: { id: existing.id },
                data: {
                    title: productData.title,
                    images: JSON.stringify(productData.images),
                    attributes: JSON.stringify(productData.attributes),
                    detailHtml: productData.detailHtml,
                    skuData: JSON.stringify(productData.skuData),
                    shopName: productData.shopName || '京东',
                    status: 'scraped'
                }
            });
        } else {
            draft = await prisma.productDraft.create({
                data: {
                    userId: user.userId,
                    originalUrl: url,
                    title: productData.title,
                    images: JSON.stringify(productData.images),
                    attributes: JSON.stringify(productData.attributes),
                    detailHtml: productData.detailHtml,
                    skuData: JSON.stringify(productData.skuData),
                    shopName: productData.shopName || '京东',
                    status: 'scraped'
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
