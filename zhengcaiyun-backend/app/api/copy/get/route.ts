import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActorFromRequest } from '@/lib/request-actor';

export const dynamic = 'force-dynamic';

/**
 * GET /api/copy/get?id=xxx
 * 获取单个草稿详情
 */
export async function GET(request: NextRequest) {
    try {
        const actor = await getActorFromRequest(request);
        if (!actor) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = actor.kind === 'user' ? actor.userId : actor.userId;
        if (!userId) {
            return NextResponse.json({ error: 'License is not linked to a user' }, { status: 401 });
        }

        const id = request.nextUrl.searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: '缺少ID' }, { status: 400 });
        }

        const draft = await prisma.productDraft.findFirst({
            where: { id, userId }
        });

        if (!draft) {
            return NextResponse.json({ error: '草稿不存在' }, { status: 404 });
        }

        return NextResponse.json({ draft });

    } catch (error) {
        console.error('获取草稿失败:', error);
        return NextResponse.json({ error: '获取失败' }, { status: 500 });
    }
}
