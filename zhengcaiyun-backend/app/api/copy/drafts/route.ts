import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        // 临时禁用授权验证用于测试
        let user = await getAuthUser(request);
        if (!user) {
            // Fallback to test user for demo
            user = { userId: 'test-user-001', email: 'test@example.com' };
        }

        const taskId = request.nextUrl.searchParams.get('taskId');
        const where: any = {
            userId: user.userId
        };

        if (taskId === 'null') {
            // Single products (no associated task)
            where.copyTaskId = null;
        } else if (taskId) {
            // Products from specific batch task
            where.copyTaskId = taskId;
        }

        const drafts = await prisma.productDraft.findMany({
            where,
            orderBy: {
                createdAt: 'desc'
            }
        });

        return NextResponse.json({
            success: true,
            drafts,
            count: drafts.length
        });

    } catch (error) {
        console.error('获取草稿失败:', error);
        return NextResponse.json({
            success: false,
            error: '获取失败: ' + (error as Error).message
        }, { status: 500 });
    }
}

export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
