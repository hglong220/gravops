import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const mode = searchParams.get('mode') || 'grouped';

        if (mode === 'details') {
            const userId = searchParams.get('userId');
            if (!userId) {
                return NextResponse.json({ error: 'UserId is required for details mode' }, { status: 400 });
            }

            const drafts = await prisma.productDraft.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 100 // Limit to recent 100 for performance
            });

            return NextResponse.json({ drafts });
        }

        // Grouped Mode (Default)
        // 1. Fetch all tasks to aggregate
        const tasks = await prisma.copyTask.findMany({
            orderBy: { updatedAt: 'desc' }
        });

        // 2. Group by userId
        const userStats = new Map<string, {
            userId: string;
            taskCount: number;
            runningTasks: number;
            totalLinks: number;
            successLinks: number;
            failedLinks: number;
            lastActive: Date;
        }>();

        for (const task of tasks) {
            if (!userStats.has(task.userId)) {
                userStats.set(task.userId, {
                    userId: task.userId,
                    taskCount: 0,
                    runningTasks: 0,
                    totalLinks: 0,
                    successLinks: 0,
                    failedLinks: 0,
                    lastActive: task.updatedAt
                });
            }

            const stats = userStats.get(task.userId)!;
            stats.taskCount++;
            if (task.status === 'running') stats.runningTasks++;
            stats.totalLinks += task.totalCount;
            stats.successLinks += task.successCount;
            stats.failedLinks += task.failedCount;
            if (task.updatedAt > stats.lastActive) stats.lastActive = task.updatedAt;
        }

        // 3. Fetch User Details
        const userIds = Array.from(userStats.keys());
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true, companyName: true }
        });

        const userMap = new Map(users.map(u => [u.id, u]));

        // 4. Combine
        const result = Array.from(userStats.values()).map(stats => {
            const user = userMap.get(stats.userId);
            return {
                ...stats,
                companyName: user?.companyName || '未绑定企业',
                email: user?.email || 'Unknown'
            };
        });

        return NextResponse.json({ companies: result });

    } catch (error) {
        console.error('Fetch tasks error:', error);
        return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
    }
}
