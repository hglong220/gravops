import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActorFromRequest } from '@/lib/request-actor';

/**
 * GET /api/copy/tasks/pending
 * 获取待采集的商品列表（status = 'pending'）
 */
export async function GET(request: NextRequest) {
    try {
        const actor = await getActorFromRequest(request);
        if (!actor) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = actor.kind === 'user' ? actor.userId : actor.userId;
        if (!userId) {
            return NextResponse.json(
                { error: 'License is not linked to a user', code: 'LICENSE_NOT_LINKED' },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '10');

        const pendingDrafts = await prisma.productDraft.findMany({
            where: {
                userId,
                status: 'pending',
                OR: [
                    { copyTaskId: null }, // Single products (always process)
                    {
                        copyTask: {
                            status: 'running' // Only process running tasks
                        }
                    }
                ]
            },
            take: limit,
            orderBy: {
                createdAt: 'asc' // FIFO
            }
        });

        return NextResponse.json({
            success: true,
            drafts: pendingDrafts,
            tasks: pendingDrafts,
            count: pendingDrafts.length
        }, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            }
        });

    } catch (error) {
        console.error('获取待处理任务失败:', error);
        return NextResponse.json({
            success: false,
            error: '获取失败: ' + (error as Error).message
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
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
