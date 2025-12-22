import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActorFromRequest } from '@/lib/request-actor';

/**
 * GET /api/copy/drafts/[id]
 * 获取单个商品草稿
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;

        const actor = await getActorFromRequest(request);
        if (!actor) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } }
            );
        }

        const userId = actor.kind === 'user' ? actor.userId : actor.userId;
        if (!userId) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'License is not linked to a user',
                    code: 'LICENSE_NOT_LINKED'
                },
                { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } }
            );
        }

        const draft = await prisma.productDraft.findFirst({
            where: { id, userId }
        });

        if (!draft) {
            return NextResponse.json(
                { success: false, error: '草稿不存在' },
                {
                    status: 404,
                    headers: { 'Access-Control-Allow-Origin': '*' }
                }
            );
        }

        // 解析 JSON 字段
        const result = {
            ...draft,
            attributes: draft.attributes ? JSON.parse(draft.attributes) : {},
            skuData: draft.skuData ? JSON.parse(draft.skuData) : {},
            images: draft.images ? JSON.parse(draft.images) : []
        };

        // 从 skuData 提取 price 和 stock
        if (result.skuData) {
            if (!result.price && result.skuData.price) {
                result.price = result.skuData.price;
            }
            if (!result.stock && result.skuData.stock) {
                result.stock = result.skuData.stock;
            }
        }

        return NextResponse.json(result, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            }
        });

    } catch (error) {
        console.error('获取草稿失败:', error);
        return NextResponse.json({
            success: false,
            error: '获取失败: ' + (error as Error).message
        }, {
            status: 500,
            headers: { 'Access-Control-Allow-Origin': '*' }
        });
    }
}

/**
 * PUT /api/copy/drafts/[id]
 * 更新商品草稿
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;

        const actor = await getActorFromRequest(request);
        if (!actor) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } }
            );
        }

        const userId = actor.kind === 'user' ? actor.userId : actor.userId;
        if (!userId) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'License is not linked to a user',
                    code: 'LICENSE_NOT_LINKED'
                },
                { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } }
            );
        }

        const existingDraft = await prisma.productDraft.findFirst({
            where: { id, userId }
        });

        if (!existingDraft) {
            return NextResponse.json(
                { success: false, error: '草稿不存在' },
                { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } }
            );
        }

        const body = await request.json();
        const {
            title,
            price,
            marketPrice,
            stock,
            detailHtml,
            attributes,
            images,
            detailImages,
            categoryPath,
            brand,
            model,
            originalUrl
        } = body;

        // Construct update data
        const updateData: any = {};
        if (title !== undefined) updateData.title = title;
        if (detailHtml !== undefined) updateData.detailHtml = detailHtml;
        if (categoryPath !== undefined) updateData.categoryPath = categoryPath;
        if (brand !== undefined) updateData.brand = brand;
        if (model !== undefined) updateData.model = model;
        if (originalUrl !== undefined) updateData.originalUrl = originalUrl;

        if (attributes !== undefined) {
            updateData.attributes =
                typeof attributes === 'string' ? attributes : JSON.stringify(attributes);
        }

        if (images !== undefined) {
            updateData.images =
                typeof images === 'string' ? images : JSON.stringify(images || []);
        }

        if (detailImages !== undefined) {
            updateData.detailImages =
                typeof detailImages === 'string'
                    ? detailImages
                    : JSON.stringify(detailImages || []);
        }

        // Update SKU data if price or stock provided
        if (price !== undefined || stock !== undefined) {
            const skuData = JSON.parse(existingDraft.skuData || '{}');

            if (price !== undefined) {
                const parsedPrice =
                    typeof price === 'number'
                        ? price
                        : Number.parseFloat(String(price).replace(/[^0-9.]/g, ''));
                if (Number.isFinite(parsedPrice)) {
                    skuData.price = parsedPrice;
                    updateData.price = parsedPrice;
                }
            }

            if (stock !== undefined) {
                const parsedStock =
                    typeof stock === 'number'
                        ? stock
                        : Number.parseInt(String(stock).replace(/[^0-9]/g, ''), 10);
                if (Number.isFinite(parsedStock)) {
                    skuData.stock = parsedStock;
                    updateData.stock = parsedStock;
                }
            }

            updateData.skuData = JSON.stringify(skuData);
        }

        // 处理市场价
        if (marketPrice !== undefined) {
            const parsedMarketPrice =
                typeof marketPrice === 'number'
                    ? marketPrice
                    : Number.parseFloat(String(marketPrice).replace(/[^0-9.]/g, ''));
            if (Number.isFinite(parsedMarketPrice)) {
                updateData.marketPrice = parsedMarketPrice;
            }
        }

        const updatedDraft = await prisma.productDraft.update({
            where: { id },
            data: updateData
        });

        return NextResponse.json({ success: true, draft: updatedDraft }, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'PUT, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            }
        });

    } catch (error) {
        console.error('更新草稿失败:', error);
        return NextResponse.json({
            success: false,
            error: '更新失败: ' + (error as Error).message
        }, {
            status: 500,
            headers: {
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

/**
 * DELETE /api/copy/drafts/[id]
 * 删除商品草稿
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;

        const actor = await getActorFromRequest(request);
        if (!actor) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } }
            );
        }

        const userId = actor.kind === 'user' ? actor.userId : actor.userId;
        if (!userId) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'License is not linked to a user',
                    code: 'LICENSE_NOT_LINKED'
                },
                { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } }
            );
        }

        const existingDraft = await prisma.productDraft.findFirst({
            where: { id, userId }
        });

        if (!existingDraft) {
            return NextResponse.json(
                { success: false, error: '草稿不存在' },
                { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } }
            );
        }

        await prisma.productDraft.delete({
            where: { id }
        });

        return NextResponse.json({ success: true }, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            }
        });

    } catch (error) {
        console.error('删除草稿失败:', error);
        return NextResponse.json({
            success: false,
            error: '删除失败: ' + (error as Error).message
        }, {
            status: 500,
            headers: {
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
