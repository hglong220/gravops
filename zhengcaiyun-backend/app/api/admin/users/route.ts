import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search');

        const whereClause: any = {};
        if (search) {
            whereClause.OR = [
                { email: { contains: search } },
                { companyName: { contains: search } },
                { name: { contains: search } },
                { phone: { contains: search } }
            ];
        }

        const users = await prisma.user.findMany({
            where: whereClause,
            include: {
                licenses: true,
                _count: {
                    select: { orders: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(users);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, action, data } = body;

        if (!userId) {
            return NextResponse.json({ error: 'UserId is required' }, { status: 400 });
        }

        if (action === 'ban' || action === 'unban') {
            const user = await prisma.user.update({
                where: { id: userId },
                data: { isBanned: action === 'ban' }
            });
            return NextResponse.json(user);
        }

        if (action === 'update') {
            const { email, companyName, creditCode, name, phone } = data;
            const user = await prisma.user.update({
                where: { id: userId },
                data: {
                    email,
                    companyName,
                    creditCode,
                    name,
                    phone
                }
            });
            return NextResponse.json(user);
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
}
