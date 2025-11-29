import { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

const prisma = new PrismaClient();

/**
 * DELETE /api/copy/tasks/[id]
 * 删除批量任务及其关联的草稿
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;

        // Transaction to ensure both task and drafts are deleted
        await prisma.$transaction(async (tx) => {
            // 1. Delete associated drafts
            await tx.productDraft.deleteMany({
                where: { copyTaskId: id }
            });

            // 2. Delete the task
            await tx.copyTask.delete({
                where: { id }
            });
        });

        return NextResponse.json({ success: true }, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            }
        });

    } catch (error) {
        console.error('删除任务失败:', error);
        return NextResponse.json({
            success: false,
            error: '删除失败: ' + (error as Error).message
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
            'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
