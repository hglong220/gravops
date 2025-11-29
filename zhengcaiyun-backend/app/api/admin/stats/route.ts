import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const totalUsers = await prisma.user.count();
        const activeLicenses = await prisma.license.count({
            where: { status: 'active' }
        });

        const revenueResult = await prisma.order.aggregate({
            _sum: { amount: true },
            where: { status: 'paid' }
        });
        const totalRevenue = (revenueResult._sum.amount || 0) / 100; // Convert cents to yuan

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayUploads = await prisma.usageRecord.count({
            where: { createdAt: { gte: today } }
        });

        return NextResponse.json({
            totalUsers,
            activeLicenses,
            totalRevenue,
            todayUploads
        });
    } catch (error) {
        console.error('Failed to fetch admin stats:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
