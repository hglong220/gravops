import { NextRequest, NextResponse } from 'next/server';
import { analyzeScreenshot } from '@/lib/ai-service';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { image, licenseKey, context } = body;

        if (!image || !licenseKey) {
            return NextResponse.json({ error: 'Missing image or licenseKey' }, { status: 400 });
        }

        // 1. Verify License
        const license = await prisma.license.findUnique({
            where: { key: licenseKey }
        });

        if (!license || license.status !== 'active' || new Date() > license.expiresAt) {
            return NextResponse.json({ error: 'Invalid or expired license' }, { status: 401 });
        }

        // 2. Call AI Service
        const result = await analyzeScreenshot(image, context);

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Visual Analyze API Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
