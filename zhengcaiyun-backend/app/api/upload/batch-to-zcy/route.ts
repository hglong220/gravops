/**
 * API: 批量上传商品到政采云
 * POST /api/upload/batch-to-zcy
 */

import { NextRequest, NextResponse } from 'next/server';
import uploadOrchestrator from '@/lib/upload-orchestrator';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { products, options } = body;

        if (!products || !Array.isArray(products)) {
            return NextResponse.json(
                { error: '缺少商品列表' },
                { status: 400 }
            );
        }

        if (products.length === 0) {
            return NextResponse.json(
                { error: '商品列表为空' },
                { status: 400 }
            );
        }

        console.log(`📦 收到批量上传请求: ${products.length} 个商品`);

        // 执行批量上传
        const result = await uploadOrchestrator.uploadBatch(products, options);

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('批量上传API错误:', error);

        return NextResponse.json({
            success: false,
            message: error.message
        }, { status: 500 });
    }
}
