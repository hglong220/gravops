/**
 * 图片代理 API
 * 
 * 用于下载远程图片，解决跨域问题
 * 返回 Base64 编码的图片数据
 */

import { NextRequest, NextResponse } from 'next/server';

// 允许的图片域名白名单
const ALLOWED_DOMAINS = [
    'img10.360buyimg.com',
    'img11.360buyimg.com',
    'img12.360buyimg.com',
    'img13.360buyimg.com',
    'img14.360buyimg.com',
    'img20.360buyimg.com',
    'img30.360buyimg.com',
    'img.alicdn.com',
    'gw.alicdn.com',
    'cbu01.alicdn.com',
    'image.suning.cn',
    // 可根据需要添加更多
];

// CORS 头
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/image-proxy?url=xxx
 * 验证图片是否存在（HEAD请求）
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const imageUrl = searchParams.get('url');

        if (!imageUrl) {
            return NextResponse.json(
                { error: '缺少 url 参数' },
                { status: 400, headers: corsHeaders }
            );
        }

        // 验证域名
        const urlObj = new URL(imageUrl);
        const isAllowed = ALLOWED_DOMAINS.some(domain => urlObj.hostname.includes(domain));

        if (!isAllowed) {
            console.log(`[Image Proxy] 域名不在白名单: ${urlObj.hostname}`);
            // 不强制拒绝，只记录日志
        }

        // HEAD 请求检查图片是否存在
        const headResponse = await fetch(imageUrl, {
            method: 'HEAD',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': urlObj.origin,
            },
        });

        if (!headResponse.ok) {
            return NextResponse.json(
                { exists: false, status: headResponse.status },
                { headers: corsHeaders }
            );
        }

        const contentType = headResponse.headers.get('content-type');
        const contentLength = headResponse.headers.get('content-length');

        return NextResponse.json(
            {
                exists: true,
                contentType,
                contentLength: contentLength ? parseInt(contentLength) : null,
            },
            { headers: corsHeaders }
        );

    } catch (error) {
        console.error('[Image Proxy] 检查图片失败:', error);
        return NextResponse.json(
            { exists: false, error: String(error) },
            { status: 500, headers: corsHeaders }
        );
    }
}

/**
 * POST /api/image-proxy
 * body: { url: string }
 * 下载图片并返回 Base64
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { url: imageUrl } = body;

        if (!imageUrl) {
            return NextResponse.json(
                { error: '缺少 url 参数' },
                { status: 400, headers: corsHeaders }
            );
        }

        console.log(`[Image Proxy] 下载图片: ${imageUrl}`);

        const urlObj = new URL(imageUrl);

        // 下载图片
        const response = await fetch(imageUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': urlObj.origin,
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
            },
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: `下载失败: ${response.status}` },
                { status: response.status, headers: corsHeaders }
            );
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');

        console.log(`[Image Proxy] 下载成功: ${buffer.length} bytes`);

        return NextResponse.json(
            {
                success: true,
                data: `data:${contentType};base64,${base64}`,
                contentType,
                size: buffer.length,
            },
            { headers: corsHeaders }
        );

    } catch (error) {
        console.error('[Image Proxy] 下载图片失败:', error);
        return NextResponse.json(
            { error: String(error) },
            { status: 500, headers: corsHeaders }
        );
    }
}

/**
 * 批量下载图片
 * POST /api/image-proxy/batch
 * body: { urls: string[] }
 */
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { urls } = body;

        if (!urls || !Array.isArray(urls)) {
            return NextResponse.json(
                { error: '缺少 urls 参数' },
                { status: 400, headers: corsHeaders }
            );
        }

        console.log(`[Image Proxy] 批量下载 ${urls.length} 张图片`);

        const results: Array<{
            url: string;
            success: boolean;
            data?: string;
            error?: string;
        }> = [];

        // 并行下载（限制并发数）
        const batchSize = 3;
        for (let i = 0; i < urls.length; i += batchSize) {
            const batch = urls.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(async (url: string) => {
                    try {
                        const urlObj = new URL(url);
                        const response = await fetch(url, {
                            method: 'GET',
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                'Referer': urlObj.origin,
                            },
                        });

                        if (!response.ok) {
                            return { url, success: false, error: `HTTP ${response.status}` };
                        }

                        const contentType = response.headers.get('content-type') || 'image/jpeg';
                        const arrayBuffer = await response.arrayBuffer();
                        const buffer = Buffer.from(arrayBuffer);
                        const base64 = buffer.toString('base64');

                        return {
                            url,
                            success: true,
                            data: `data:${contentType};base64,${base64}`,
                        };
                    } catch (error) {
                        return { url, success: false, error: String(error) };
                    }
                })
            );
            results.push(...batchResults);
        }

        const successCount = results.filter(r => r.success).length;
        console.log(`[Image Proxy] 批量下载完成: ${successCount}/${urls.length} 成功`);

        return NextResponse.json(
            {
                success: successCount > 0,
                total: urls.length,
                downloaded: successCount,
                results,
            },
            { headers: corsHeaders }
        );

    } catch (error) {
        console.error('[Image Proxy] 批量下载失败:', error);
        return NextResponse.json(
            { error: String(error) },
            { status: 500, headers: corsHeaders }
        );
    }
}
