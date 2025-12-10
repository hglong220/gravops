import { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

const prisma = new PrismaClient();

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

        const draft = await prisma.productDraft.findUnique({
            where: { id }
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
                'Access-Control-Allow-Headers': 'Content-Type',
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
        const body = await request.json();
        const { title, price, stock, detailHtml, attributes } = body;

        // Construct update data
        const updateData: any = {};
        if (title !== undefined) updateData.title = title;
        if (detailHtml !== undefined) updateData.detailHtml = detailHtml;
        if (attributes !== undefined) updateData.attributes = JSON.stringify(attributes);

        // Update SKU data if price or stock provided
        if (price !== undefined || stock !== undefined) {
            const draft = await prisma.productDraft.findUnique({ where: { id } });
            if (draft) {
                const skuData = JSON.parse(draft.skuData || '{}');
                if (price !== undefined) skuData.price = price;
                if (stock !== undefined) skuData.stock = stock;
                updateData.skuData = JSON.stringify(skuData);
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
                'Access-Control-Allow-Headers': 'Content-Type',
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

        await prisma.productDraft.delete({
            where: { id }
        });

        return NextResponse.json({ success: true }, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
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
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
