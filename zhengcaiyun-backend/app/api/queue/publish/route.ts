import { NextResponse } from 'next/server';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis({
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: null,
    retryStrategy: () => null  // Redis 不可用时返回 null
});

const publishQueue = new Queue('zcy-publish', { connection });

export async function POST(request: Request) {
    try {
        const { draftId, userId } = await request.json();

        if (!draftId || !userId) {
            return NextResponse.json(
                { error: '缺少必要参数' },
                { status: 400 }
            );
        }

        // 添加任务到队列
        const job = await publishQueue.add(
            'publish',
            { draftId, userId },
            {
                jobId: `publish-${draftId}`,  // 防止重复提交
                priority: 1
            }
        );

        return NextResponse.json({
            success: true,
            taskId: job.id,
            draftId,
            message: '任务已加入队列'
        });

    } catch (error: any) {
        console.error('Submit error:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}

// 查询任务状态
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const taskId = searchParams.get('taskId');

        if (!taskId) {
            return NextResponse.json(
                { error: '缺少 taskId' },
                { status: 400 }
            );
        }

        const job = await publishQueue.getJob(taskId);

        if (!job) {
            return NextResponse.json(
                { error: '任务不存在' },
                { status: 404 }
            );
        }

        const state = await job.getState();
        const progress = job.progress;

        return NextResponse.json({
            taskId,
            status: state,
            progress,
            data: job.data
        });

    } catch (error: any) {
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
