import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search');
        const status = searchParams.get('status');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        const where: any = {};

        if (search) {
            where.OR = [
                { id: { contains: search } },
                { user: { companyName: { contains: search } } },
                { user: { email: { contains: search } } }
            ];
        }

        if (status && status !== 'all') {
            where.status = status;
        }

        if (startDate && endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999); // Include the entire end day
            where.createdAt = {
                gte: new Date(startDate),
                lte: end
            };
        }

        const orders = await prisma.order.findMany({
            where,
            include: {
                user: {
                    select: { email: true, companyName: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(orders);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }
}
