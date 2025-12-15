import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateLicenseKey } from '@/lib/license-utils';
import { getAdminFromRequest } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
    try {
        const admin = getAdminFromRequest(request);
        if (!admin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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
                },
                devices: {
                    select: { id: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(
            licenses.map((l: any) => ({
                ...l,
                currentDevices: Array.isArray(l.devices) ? l.devices.length : 0
            }))
        );
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch licenses' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const admin = getAdminFromRequest(request);
        if (!admin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { plan, durationDays, companyName, userId, userEmail } = body;

        let resolvedUserId: string | undefined = userId;

        if (!resolvedUserId && typeof userEmail === 'string' && userEmail.trim()) {
            const user = await prisma.user.findUnique({
                where: { email: userEmail.trim() },
                select: { id: true }
            });
            if (user?.id) resolvedUserId = user.id;
        }

        if (resolvedUserId) {
            const exists = await prisma.user.findUnique({
                where: { id: resolvedUserId },
                select: { id: true }
            });
            if (!exists) {
                return NextResponse.json({ error: 'User not found' }, { status: 400 });
            }
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (durationDays || 30));

        const license = await prisma.license.create({
            data: {
                key: generateLicenseKey(companyName),
                userId: resolvedUserId || undefined,
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
        const admin = getAdminFromRequest(request);
        if (!admin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { licenseId, action, userId, maxDevices } = body;

        if (
            !licenseId ||
            !['revoke', 'extend', 'link_user', 'reset_devices', 'set_max_devices'].includes(action)
        ) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        if (action === 'revoke') {
            const license = await prisma.license.update({
                where: { id: licenseId },
                data: { status: 'suspended', suspendReason: 'Admin Revoked' }
            });
            return NextResponse.json(license);
        } else if (action === 'link_user') {
            if (!userId) {
                return NextResponse.json({ error: 'UserId is required' }, { status: 400 });
            }

            const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
            if (!user) {
                return NextResponse.json({ error: 'User not found' }, { status: 400 });
            }

            const license = await prisma.license.update({
                where: { id: licenseId },
                data: { userId }
            });
            return NextResponse.json(license);
        } else if (action === 'reset_devices') {
            await prisma.device.deleteMany({ where: { licenseId } });
            const license = await prisma.license.findUnique({
                where: { id: licenseId },
                include: { devices: true, user: { select: { email: true, companyName: true } } }
            });
            return NextResponse.json(license);
        } else if (action === 'set_max_devices') {
            const nextMax = Number(maxDevices);
            if (!Number.isFinite(nextMax) || nextMax <= 0) {
                return NextResponse.json({ error: 'maxDevices must be a positive number' }, { status: 400 });
            }

            const license = await prisma.license.update({
                where: { id: licenseId },
                data: { maxDevices: Math.floor(nextMax) }
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
