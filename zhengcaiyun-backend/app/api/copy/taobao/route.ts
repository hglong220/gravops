import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { scrapeTaobaoProduct } from '@/lib/scrapers/taobao-scraper';

export async function POST(request: NextRequest) {
    try {
        // 临时禁用授权验证
        const user = { userId: 'test-user-001', licenseKey: 'TEST-2024' };

        const body = await request.json();
        const { url } = body;

        if (!url || !url.includes('taobao.com')) {
            return NextResponse.json(
                { error: '请提供有效的淘宝商品链接' },
                { status: 400 }
            );
        }

        console.log(`[API /copy/taobao] User ${user.userId} copying: ${url}`);

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

        console.log('[API /copy/taobao] Scraping product data...');
        const productData = await scrapeTaobaoProduct(url);

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
                    shopName: productData.shopName || '淘宝',
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
                    shopName: productData.shopName || '淘宝',
                    status: 'scraped'
                }
            });
        }

        console.log(`[API /copy/taobao] Successfully saved draft: ${draft.id}`);

        return NextResponse.json({
            success: true,
            draft,
            message: '淘宝商品复制成功'
        });

    } catch (error) {
        console.error('[API /copy/taobao] Error:', error);
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
