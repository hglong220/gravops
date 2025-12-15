import { NextRequest, NextResponse } from 'next/server';
import { getActorFromRequest } from '@/lib/request-actor';

const ALLOWED_IMAGE_HOST_PATTERNS: RegExp[] = [
    /(^|\.)jd\.com$/i,
    /(^|\.)jd\.hk$/i,
    /(^|\.)360buyimg\.com$/i,
    /(^|\.)alicdn\.com$/i,
    /(^|\.)tmall\.com$/i,
    /(^|\.)taobao\.com$/i,
    /(^|\.)suning\.com$/i,
    /(^|\.)suning\.cn$/i,
    /(^|\.)zcycdn\.com$/i,
    /(^|\.)zcygov\.cn$/i
];

function isPrivateIp(hostname: string): boolean {
    if (hostname.includes(':')) return true; // block IPv6 literals by default
    const m = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m) return false;

    const parts = m.slice(1).map((n) => parseInt(n, 10));
    if (parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return true;

    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
}

function isAllowedImageHost(hostname: string): boolean {
    const host = hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.lan')) return false;
    if (isPrivateIp(host)) return false;
    return ALLOWED_IMAGE_HOST_PATTERNS.some((re) => re.test(host));
}

/**
 * GET /api/copy/image-proxy?url=...
 * 代理获取图片，解决防盗链和CORS问题
 */
export async function GET(request: NextRequest) {
    const actor = await getActorFromRequest(request);
    if (!actor) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = actor.kind === 'user' ? actor.userId : actor.userId;
    if (!userId) {
        return NextResponse.json({ error: 'License is not linked to a user' }, { status: 401 });
    }

    const url = request.nextUrl.searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    try {
        let parsedUrl: URL;
        try {
            parsedUrl = new URL(url);
        } catch {
            return NextResponse.json({ error: 'Invalid url parameter' }, { status: 400 });
        }

        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            return NextResponse.json({ error: 'Invalid url protocol' }, { status: 400 });
        }

        const hostname = parsedUrl.hostname.toLowerCase();
        if (!isAllowedImageHost(hostname)) {
            return NextResponse.json({ error: 'Blocked image host' }, { status: 400 });
        }

        // 1. Determine headers based on source domain
        const headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };

        if (hostname.endsWith('jd.com') || hostname.endsWith('jd.hk') || hostname.endsWith('360buyimg.com')) {
            headers['Referer'] = 'https://www.jd.com/';
        } else if (hostname.endsWith('tmall.com') || hostname.endsWith('taobao.com') || hostname.endsWith('alicdn.com')) {
            headers['Referer'] = 'https://www.taobao.com/';
        } else if (hostname.endsWith('suning.com') || hostname.endsWith('suning.cn')) {
            headers['Referer'] = 'https://www.suning.com/';
        }

        // 2. Fetch image from source
        const response = await fetch(parsedUrl.toString(), { headers, redirect: 'manual' });

        // 防止被利用做 SSRF 跳转
        if (response.status >= 300 && response.status < 400) {
            return NextResponse.json({ error: 'Redirects are not allowed' }, { status: 400 });
        }

        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }

        const blob = await response.blob();
        const contentType = response.headers.get('content-type') || 'image/jpeg';

        // 基础校验：只允许图片类返回（允许少数站点返回 octet-stream）
        const ct = contentType.toLowerCase();
        if (!ct.startsWith('image/') && ct !== 'application/octet-stream') {
            return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
        }

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
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
