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

        const tasks = await prisma.copyTask.findMany({
            where: {
                userId: user.userId
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return NextResponse.json({
            success: true,
            tasks
        });

    } catch (error) {
        console.error('获取任务列表失败:', error);
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
