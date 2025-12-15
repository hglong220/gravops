import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActorFromRequest } from '@/lib/request-actor';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        // 临时使用测试用户，生产环境应使用 getAuthUser
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

        // 获取待发布的任务 (一次取1个，避免并发过多)
        const draft = await prisma.productDraft.findFirst({
            where: {
                userId,
                status: 'pending_publish'
            },
            orderBy: {
                createdAt: 'asc'
            }
        });

        if (!draft) {
            return NextResponse.json({ task: null });
        }

        // 标记为处理中，防止重复获取
        await prisma.productDraft.update({
            where: { id: draft.id },
            data: { status: 'processing_publish' }
        });

        return NextResponse.json({
            task: {
                id: draft.id,
                originalUrl: draft.originalUrl
            }
        });

    } catch (error) {
        console.error('[API /next-batch] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
