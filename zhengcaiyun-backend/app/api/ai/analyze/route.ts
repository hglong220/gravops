import { NextRequest, NextResponse } from 'next/server';
import { analyzeProduct } from '@/lib/ai-service';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { productName, description, licenseKey } = body;

        if (!productName || !licenseKey) {
            return NextResponse.json({ error: '缺少必要参数: productName, licenseKey' }, { status: 400 });
        }

        // 1. Verify License
        const license = await prisma.license.findUnique({
            where: { key: licenseKey }
        });

        if (!license || license.status !== 'active' || new Date() > license.expiresAt) {
            return NextResponse.json({ error: '授权无效或已过期' }, { status: 401 });
        }

        // 2. Call AI Service
        const result = await analyzeProduct(productName, description);

        // 3. Log Usage (Optional: Add UsageRecord model later)
        // await prisma.usageRecord.create(...)

        return NextResponse.json(result);

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'AI分析服务暂时不可用' }, { status: 500 });
    }
}
