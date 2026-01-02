/**
 * AI类目匹配测试API
 * GET /api/test-ai-category?title=xxx
 * 仅开发环境可用
 */

import { NextRequest, NextResponse } from 'next/server'
import { matchCategoryWithAI } from '@/lib/ai-category-match'

export async function GET(request: NextRequest) {
    // 生产环境禁止访问测试接口
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
            { error: 'Test API not available in production' },
            { status: 403 }
        )
    }

    const title = request.nextUrl.searchParams.get('title') || '得力白板120*90cm'

    console.log('[Test] 测试AI类目匹配:', title)

    try {
        const result = await matchCategoryWithAI(title)

        return NextResponse.json({
            success: true,
            title,
            result
        })
    } catch (error) {
        console.error('[Test] 错误:', error)
        return NextResponse.json({
            success: false,
            error: String(error)
        }, { status: 500 })
    }
}
