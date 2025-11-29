import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { detectPlatform, isValidProductUrl, normalizeUrl } from '@/lib/url-detector';

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { productUrls, shopName, shopUrl } = body;

        if (!productUrls || !Array.isArray(productUrls) || productUrls.length === 0) {
            return NextResponse.json({ error: 'No product URLs provided' }, { status: 400 });
        }

        // 验证和规范化URLs
        const validUrls = productUrls
            .map((url: string) => normalizeUrl(url.trim()))
            .filter((url: string) => isValidProductUrl(url));

        if (validUrls.length === 0) {
            return NextResponse.json({ error: '没有有效的商品链接' }, { status: 400 });
        }

        console.log(`[API /copy/batch-create] Validated ${validUrls.length}/${productUrls.length} URLs`);

        // 统计各平台数量
        const platformStats: Record<string, number> = {};
        validUrls.forEach((url: string) => {
            const platform = detectPlatform(url);
            platformStats[platform] = (platformStats[platform] || 0) + 1;
        });

        console.log('[API /copy/batch-create] Platform stats:', platformStats);

        // 1. 创建CopyTask
        const task = await prisma.copyTask.create({
            data: {
                userId: user.userId,
                shopUrl: shopUrl || '',
                shopName: shopName || 'Batch Copy',
                totalCount: validUrls.length,
                successCount: 0,
                failedCount: 0,
                status: 'running'
            }
        });

        // 2. 创建ProductDrafts (Batch)
        let createdCount = 0;

        for (const url of validUrls) {
            const platform = detectPlatform(url);
            const platformShopName = shopName || `${platform.toUpperCase()} 批量复制`;

            const existing = await prisma.productDraft.findFirst({
                where: {
                    userId: user.userId,
                    originalUrl: url
                }
            });

            if (!existing) {
                await prisma.productDraft.create({
                    data: {
                        userId: user.userId,
                        originalUrl: url,
                        title: `待采集商品 (${platform})`,
                        status: body.rapidMode ? 'pending_publish' : 'pending',
                        copyTaskId: task.id,
                        shopName: platformShopName
                    }
                });
                createdCount++;
            } else {
                // Update existing to link to this task and reset status
                await prisma.productDraft.update({
                    where: { id: existing.id },
                    data: {
                        copyTaskId: task.id,
                        status: body.rapidMode ? 'pending_publish' : 'pending', // Reset to pending or pending_publish
                        shopName: shopName || existing.shopName
                    }
                });
            }
        }

        return NextResponse.json({
            success: true,
            taskId: task.id,
            message: `任务创建成功，共 ${validUrls.length} 个商品，新增 ${createdCount} 个草稿`,
            platformStats
        });

    } catch (error) {
        console.error('创建批量任务失败:', error);
        return NextResponse.json({ error: '创建失败: ' + (error as Error).message }, { status: 500 });
    }
}

export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
