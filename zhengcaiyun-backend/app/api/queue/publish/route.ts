import { NextResponse } from 'next/server';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

let publishQueue: Queue | null = null;

function getPublishQueue(): Queue {
    if (publishQueue) return publishQueue;

    const redisUrl = process.env.REDIS_URL;
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;

    const connection = redisUrl
        ? new Redis(redisUrl, {
            maxRetriesPerRequest: null,
            retryStrategy: () => null // Redis 不可用时返回 null
        })
        : new Redis({
            host: redisHost,
            port: redisPort,
            maxRetriesPerRequest: null,
            retryStrategy: () => null // Redis 不可用时返回 null
        });

    publishQueue = new Queue('zcy-publish', { connection });
    return publishQueue;
}

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
        const job = await getPublishQueue().add(
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

        const job = await getPublishQueue().getJob(taskId);

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
