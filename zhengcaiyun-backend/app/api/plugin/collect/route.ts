/**
 * Plugin Collect API - 接收插件推送的商品数据
 * POST /api/plugin/collect
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPluginLicenseFromRequest } from '@/lib/plugin-auth';

export const dynamic = 'force-dynamic';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
    try {
        const auth = await getPluginLicenseFromRequest(request);

        if (!auth) {
            return NextResponse.json(
                { success: false, message: 'Unauthorized' },
                { status: 401, headers: corsHeaders }
            );
        }

        const body = await request.json();
        const product = body.product || body;

        const {
            title,
            brand,
            model,
            mainImages,
            detailImages,
            specs,
            detailHtml,
            sourceUrl,
            originalUrl,
            zcyItemUrl,
            price,
            stock
        } = product || {};

        const userId = auth.license.userId;
        if (!userId) {
            return NextResponse.json(
                { success: false, message: 'License is not linked to a user', code: 'LICENSE_NOT_LINKED' },
                { status: 403, headers: corsHeaders }
            );
        }

        const draft = await prisma.productDraft.create({
            data: {
                userId,
                originalUrl: originalUrl || sourceUrl || zcyItemUrl || 'plugin-upload',
                title: title || '未知商品',
                brand: brand || null,
                model: model || null,
                images: JSON.stringify(mainImages || []),
                detailHtml: detailHtml || JSON.stringify(detailImages || []),
                attributes: JSON.stringify(specs || {}),
                skuData: JSON.stringify({ price: price || 0, stock: stock || 99 }),
                status: 'collected'
            }
        });

        return NextResponse.json(
            {
                success: true,
                message: '推送成功',
                data: {
                    id: draft.id,
                    title: draft.title
                }
            },
            { headers: corsHeaders }
        );
    } catch (error) {
        console.error('[Plugin Collect] Error:', error);

        return NextResponse.json(
            {
                success: false,
                message: '推送后端失败',
                error: error instanceof Error ? error.message : '未知错误'
            },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function GET() {
    return NextResponse.json(
        { success: true, message: 'Plugin Collect API is working' },
        { headers: corsHeaders }
    );
}
