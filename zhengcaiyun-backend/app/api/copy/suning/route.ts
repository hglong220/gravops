import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { scrapeSuningProduct } from '@/lib/scrapers/suning-scraper';

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { url } = body;

        if (!url || !url.includes('suning.com')) {
            return NextResponse.json(
                { error: '请提供有效的苏宁商品链接' },
                { status: 400 }
            );
        }

        console.log(`[API /copy/suning] User ${user.userId} copying: ${url}`);

        const existing = await prisma.productDraft.findFirst({
            where: { userId: user.userId, originalUrl: url }
        });

        if (existing && existing.status === 'scraped') {
            return NextResponse.json({
                success: true,
                draft: existing,
                message: '商品已存在于草稿箱'
            });
        }

        const productData = await scrapeSuningProduct(url);

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
                    shopName: productData.shopName || '苏宁',
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
                    shopName: productData.shopName || '苏宁',
                    status: 'scraped'
                }
            });
        }

        return NextResponse.json({
            success: true,
            draft,
            message: '苏宁商品复制成功'
        });

    } catch (error) {
        console.error('[API /copy/suning] Error:', error);
        return NextResponse.json(
            { error: '复制失败', details: (error as Error).message },
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
