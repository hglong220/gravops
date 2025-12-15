import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActorFromRequest } from '@/lib/request-actor';

export async function GET(request: NextRequest) {
    try {
        // 临时禁用授权验证用于测试
        const actor = await getActorFromRequest(request);
        if (!actor) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = actor.kind === 'user' ? actor.userId : actor.userId;
        if (!userId) {
            return NextResponse.json({ error: 'License is not linked to a user' }, { status: 401 });
        }

        const taskId = request.nextUrl.searchParams.get('taskId');
        const where: any = {
            userId
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
