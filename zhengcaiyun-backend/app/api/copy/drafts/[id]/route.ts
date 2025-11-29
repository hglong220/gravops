import { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

const prisma = new PrismaClient();

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

export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'PUT, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
