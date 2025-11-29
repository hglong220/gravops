import { NextRequest, NextResponse } from 'next/server';
import { searchImages } from '@/lib/crawler';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const keyword = searchParams.get('keyword');
    const licenseKey = searchParams.get('licenseKey');

    if (!keyword || !licenseKey) {
        return NextResponse.json({ error: '缺少必要参数: keyword, licenseKey' }, { status: 400 });
    }

    try {
        // 1. Verify License
        const license = await prisma.license.findUnique({
            where: { key: licenseKey }
        });

        if (!license || license.status !== 'active' || new Date() > license.expiresAt) {
            return NextResponse.json({ error: '授权无效或已过期' }, { status: 401 });
        }

        // 2. Call Crawler
        const images = await searchImages(keyword);

        return NextResponse.json({
            keyword,
            count: images.length,
            images
        });

    } catch (error) {
        console.error('Image Search API Error:', error);
        return NextResponse.json({ error: '图片搜索服务暂时不可用' }, { status: 500 });
    }
}
