import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateLicenseKey } from '@/lib/license-utils';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search');

        const whereClause: any = {};
        if (search) {
            whereClause.OR = [
                { key: { contains: search } },
                { companyName: { contains: search } },
                { user: { email: { contains: search } } },
                { user: { companyName: { contains: search } } }
            ];
        }

        const licenses = await prisma.license.findMany({
            where: whereClause,
            include: {
                user: {
                    select: { email: true, companyName: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(licenses);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch licenses' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { plan, durationDays, companyName } = body;

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (durationDays || 30));

        const license = await prisma.license.create({
            data: {
                key: generateLicenseKey(companyName),
                companyName: companyName || 'Admin Generated',
                plan: plan || 'pro',
                expiresAt: expiresAt,
                status: 'active'
            }
        });

        return NextResponse.json(license);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to generate license' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { licenseId, action } = body;

        if (!licenseId || !['revoke', 'extend'].includes(action)) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        if (action === 'revoke') {
            const license = await prisma.license.update({
                where: { id: licenseId },
                data: { status: 'suspended', suspendReason: 'Admin Revoked' }
            });
            return NextResponse.json(license);
        } else {
            // Extend by 30 days
            const license = await prisma.license.findUnique({ where: { id: licenseId } });
            if (!license) throw new Error('License not found');

            const newExpiresAt = new Date(license.expiresAt.getTime() + 30 * 24 * 60 * 60 * 1000);
            const updated = await prisma.license.update({
                where: { id: licenseId },
                data: { expiresAt: newExpiresAt, status: 'active' }
            });
            return NextResponse.json(updated);
        }
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update license' }, { status: 500 });
    }
}
