import { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

const prisma = new PrismaClient();

/**
 * GET /api/copy/get?id=xxx
 * 获取单个草稿详情
 */
export async function GET(request: NextRequest) {
    try {
        const id = request.nextUrl.searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: '缺少ID' }, { status: 400 });
        }

        const draft = await prisma.productDraft.findUnique({
            where: { id }
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
