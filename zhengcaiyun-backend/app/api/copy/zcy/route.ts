import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

/**
 * POST /api/copy/zcy
 * 政采云站内复制 - 接收前端提取的数据并保存
 */
export async function POST(request: NextRequest) {
    try {
        // 临时禁用授权验证
        const user = { userId: 'test-user-001', licenseKey: 'TEST-2024' };

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

        console.log(`[API /copy/zcy] User ${user.userId} copying from ZCY: ${originalUrl}`);

        const existing = await prisma.productDraft.findFirst({
            where: {
                userId: user.userId,
                originalUrl
            }
        });

        let draft;
        if (existing) {
            draft = await prisma.productDraft.update({
                where: { id: existing.id },
                data: {
                    title: title || existing.title,
                    images: typeof images === 'string' ? images : JSON.stringify(images || []),
                    attributes: typeof attributes === 'string' ? attributes : JSON.stringify(attributes || {}),
                    detailHtml: detailHtml || existing.detailHtml,
                    skuData: typeof skuData === 'string' ? skuData : JSON.stringify(skuData || {}),
                    shopName: shopName || existing.shopName,
                    status: 'scraped'
                }
            });
        } else {
            draft = await prisma.productDraft.create({
                data: {
                    userId: user.userId,
                    originalUrl,
                    title: title || '政采云商品',
                    images: typeof images === 'string' ? images : JSON.stringify(images || []),
                    attributes: typeof attributes === 'string' ? attributes : JSON.stringify(attributes || {}),
                    detailHtml: detailHtml || '',
                    skuData: typeof skuData === 'string' ? skuData : JSON.stringify(skuData || {}),
                    shopName: shopName || '政采云店铺',
                    status: 'scraped'
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
