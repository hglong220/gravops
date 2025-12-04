import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { ids } = body as { ids: string[] };

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'No ids provided' }, { status: 400 });
        }

        const result = await prisma.productDraft.deleteMany({
            where: {
                id: { in: ids }
            }
        });

        return NextResponse.json({ success: true, deleted: result.count });
    } catch (error) {
        console.error('批量删除草稿失败:', error);
        return NextResponse.json({ error: '批量删除失败: ' + (error as Error).message }, { status: 500 });
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
