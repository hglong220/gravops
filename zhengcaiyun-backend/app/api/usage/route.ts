import { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

const prisma = new PrismaClient();

/**
 * POST /api/usage/record
 * 记录使用情况
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { licenseKey, productName, status } = body;

        const license = await prisma.license.findUnique({
            where: { key: licenseKey }
        });

        if (!license) {
            return NextResponse.json({ error: '无效授权' }, { status: 401 });
        }

        // 记录使用情况
        await prisma.usageRecord.create({
            data: {
                licenseId: license.id,
                productName,
                status
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('记录使用情况失败:', error);
        return NextResponse.json({ error: '记录失败' }, { status: 500 });
    }
}

/**
 * GET /api/usage/stats
 * 获取使用统计
 */
export async function GET(request: NextRequest) {
    try {
        const licenseKey = request.nextUrl.searchParams.get('license');

        if (!licenseKey) {
            return NextResponse.json({ error: '缺少授权码' }, { status: 400 });
        }

        const license = await prisma.license.findUnique({
            where: { key: licenseKey },
            include: {
                usageRecords: {
                    orderBy: { createdAt: 'desc' },
                    take: 100
                },
                devices: true
            }
        });

        if (!license) {
            return NextResponse.json({ error: '无效授权' }, { status: 401 });
        }

        const totalUploads = license.usageRecords.length;
        const successCount = license.usageRecords.filter(r => r.status === 'success').length;
        const failedCount = totalUploads - successCount;

        return NextResponse.json({
            license: {
                key: license.key,
                companyName: license.companyName,
                plan: license.plan,
                status: license.status,
                expiresAt: license.expiresAt
            },
            stats: {
                totalUploads,
                successCount,
                failedCount,
                successRate: totalUploads > 0 ? (successCount / totalUploads * 100).toFixed(2) : 0,
                deviceCount: license.devices.length
            },
            recentRecords: license.usageRecords.slice(0, 10)
        });
    } catch (error) {
        console.error('获取统计失败:', error);
        return NextResponse.json({ error: '获取失败' }, { status: 500 });
    }
}
