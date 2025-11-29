import { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

const prisma = new PrismaClient();

/**
 * GET /api/copy/tasks/pending
 * 获取待采集的商品列表（status = 'pending'）
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '10');
        const userId = searchParams.get('userId') || 'demo-user';

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
