import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
    const user = getAuthUser(request);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Today Uploads
        const todayUploads = await prisma.productDraft.count({
            where: {
                userId: user.userId,
                createdAt: { gte: today }
            }
        });

        // 2. Success Rate
        const totalDrafts = await prisma.productDraft.count({
            where: { userId: user.userId }
        });
        const successDrafts = await prisma.productDraft.count({
            where: {
                userId: user.userId,
                status: 'published'
            }
        });
        const successRate = totalDrafts > 0
            ? ((successDrafts / totalDrafts) * 100).toFixed(1)
            : '0.0';

        // 3. License Status
        const license = await prisma.license.findFirst({
            where: {
                userId: user.userId,
                status: 'active'
            },
            orderBy: { expiresAt: 'desc' }
        });

        let licenseInfo = {
            status: '无有效授权',
            daysRemaining: 0,
            plan: '免费版'
        };

        if (license) {
            const now = new Date();
            const diffTime = Math.max(0, license.expiresAt.getTime() - now.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            licenseInfo = {
                status: '在线',
                daysRemaining: diffDays,
                plan: license.plan === 'yearly' ? '年度专业版' : '月度专业版' // Simplified mapping
            };
        }

        // 4. Recent Activity
        const recentActivity = await prisma.productDraft.findMany({
            where: { userId: user.userId },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
                id: true,
                title: true,
                status: true,
                createdAt: true,
                categoryPath: true
            }
        });

        return NextResponse.json({
            todayUploads,
            successRate,
            license: licenseInfo,
            recentActivity
        });

    } catch (error) {
        console.error('Failed to fetch user stats:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
