/**
 * API: 上传商品到政采云
 * POST /api/upload/to-zcy
 */

import { NextRequest, NextResponse } from 'next/server';
import uploadOrchestrator from '@/lib/upload-orchestrator';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { product, options } = body;

        if (!product) {
            return NextResponse.json(
                { error: '缺少商品数据' },
                { status: 400 }
            );
        }

        console.log('📦 收到上传请求:', product.title);

        // 预检查
        const preCheck = await uploadOrchestrator.preCheck(product);

        if (!preCheck.canUpload) {
            return NextResponse.json({
                success: false,
                message: '预检查失败',
                issues: preCheck.issues,
                warnings: preCheck.warnings
            }, { status: 400 });
        }

        // 执行上传
        const result = await uploadOrchestrator.uploadSingle({
            product,
            options
        });

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('上传API错误:', error);

        return NextResponse.json({
            success: false,
            message: error.message
        }, { status: 500 });
    }
}
