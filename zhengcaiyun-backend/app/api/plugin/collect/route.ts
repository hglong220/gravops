/**
 * Plugin Collect API - 接收插件推送的商品数据
 * POST /api/plugin/collect
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// 处理 OPTIONS 预检请求
export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders })
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        // 插件发送的格式是 { product: {...} }
        const product = body.product || body

        console.log('[Plugin Collect] 收到推送:', product.title)

        const {
            title,
            brand,
            model,
            mainImages,
            detailImages,
            specs,
            detailHtml,
            sourceUrl,
            originalUrl,  // 采集引擎发送的是这个字段名
            zcyItemUrl,
            price,
            stock
        } = product

        // 保存到数据库
        const draft = await prisma.productDraft.create({
            data: {
                userId: 'test-user-001',
                originalUrl: originalUrl || sourceUrl || zcyItemUrl || 'plugin-upload',
                title: title || '未知商品',
                brand: brand || null,
                model: model || null,
                images: JSON.stringify(mainImages || []),
                detailHtml: detailHtml || JSON.stringify(detailImages || []),
                attributes: JSON.stringify(specs || {}),
                skuData: JSON.stringify({ price: price || 0, stock: stock || 99 }),
                status: 'collected',
            }
        })

        console.log('[Plugin Collect] 保存成功, ID:', draft.id, '标题:', title)

        return NextResponse.json({
            success: true,
            message: '推送成功',
            data: {
                id: draft.id,
                title: draft.title
            }
        }, { headers: corsHeaders })

    } catch (error) {
        console.error('[Plugin Collect] 错误:', error)

        return NextResponse.json({
            success: false,
            message: '推送后台失败',
            error: error instanceof Error ? error.message : '未知错误'
        }, {
            status: 500,
            headers: corsHeaders
        })
    }
}

// GET 用于测试
export async function GET() {
    return NextResponse.json({
        success: true,
        message: 'Plugin Collect API is working'
    }, { headers: corsHeaders })
}
