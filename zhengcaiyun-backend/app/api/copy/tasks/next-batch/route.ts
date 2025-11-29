import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        // 临时使用测试用户，生产环境应使用 getAuthUser
        const user = { userId: 'test-user-001' };
        // const user = await getAuthUser(request);
        // if (!user) {
        //     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        // }

        // 获取待发布的任务 (一次取1个，避免并发过多)
        const draft = await prisma.productDraft.findFirst({
            where: {
                userId: user.userId,
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
