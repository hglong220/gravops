import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActorFromRequest } from '@/lib/request-actor';

/**
 * POST /api/copy/tasks/[id]/pause
 * 暂停批量任务
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;

        const actor = await getActorFromRequest(request);
        if (!actor) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const userId = actor.kind === 'user' ? actor.userId : actor.userId;
        if (!userId) {
            return NextResponse.json({ success: false, error: 'License is not linked to a user' }, { status: 401 });
        }

        const existingTask = await prisma.copyTask.findFirst({
            where: { id, userId }
        });
        if (!existingTask) {
            return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
        }

        const task = await prisma.copyTask.update({
            where: { id },
            data: {
                status: 'paused'
            }
        });

        return NextResponse.json({ success: true, task }, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            }
        });

    } catch (error) {
        console.error('暂停任务失败:', error);
        return NextResponse.json({
            success: false,
            error: '暂停失败: ' + (error as Error).message
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
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
