import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

/**
 * GET /api/copy/image-proxy?url=...
 * 代理获取图片，解决防盗链和CORS问题
 */
export async function GET(request: NextRequest) {
    // 1. Auth Check
    const user = await getAuthUser(request);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = request.nextUrl.searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    try {
        // 1. Determine headers based on source domain
        const headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };

        if (url.includes('jd.com')) {
            headers['Referer'] = 'https://www.jd.com/';
        } else if (url.includes('tmall.com') || url.includes('taobao.com')) {
            headers['Referer'] = 'https://www.taobao.com/';
        }

        // 2. Fetch image from source
        const response = await fetch(url, { headers });

        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }

        const blob = await response.blob();
        const contentType = response.headers.get('content-type') || 'image/jpeg';

        // 3. Return image with CORS headers
        return new NextResponse(blob, {
            headers: {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=86400'
            }
        });

    } catch (error) {
        console.error('Image proxy error:', error);
        return NextResponse.json({ error: 'Failed to proxy image' }, { status: 500 });
    }
}

export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
