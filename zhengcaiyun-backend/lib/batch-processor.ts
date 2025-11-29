import { prisma } from './prisma';
import { scrapeJDProduct } from './scrapers/jd-product-scraper';
import { scrapeTmallProduct } from './scrapers/tmall-scraper';
import { scrapeTaobaoProduct } from './scrapers/taobao-scraper';
import { scrapeSuningProduct } from './scrapers/suning-scraper';
import { detectPlatform, Platform } from './url-detector';

/**
 * 批量处理pending状态的商品草稿
 * 可以在cron job或后台任务中调用
 */
export async function processPendingDrafts(limit: number = 10): Promise<void> {
    console.log(`[Batch Processor] Starting to process up to ${limit} pending drafts...`);

    // 获取pending状态的草稿
    const pendingDrafts = await prisma.productDraft.findMany({
        where: {
            status: 'pending'
        },
        take: limit,
        orderBy: {
            createdAt: 'asc' // 先处理旧的
        }
    });

    if (pendingDrafts.length === 0) {
        console.log('[Batch Processor] No pending drafts found');
        return;
    }

    console.log(`[Batch Processor] Found ${pendingDrafts.length} pending drafts`);

    for (const draft of pendingDrafts) {
        try {
            await processSingleDraft(draft.id, draft.originalUrl);
        } catch (error) {
            console.error(`[Batch Processor] Failed to process draft ${draft.id}:`, error);
            // 更新为失败状态
            await prisma.productDraft.update({
                where: { id: draft.id },
                data: {
                    status: 'failed'
                }
            });

            // 更新任务失败计数
            if (draft.copyTaskId) {
                await updateTaskProgress(draft.copyTaskId);
            }
        }
    }

    console.log('[Batch Processor] Batch processing completed');
}

/**
 * 处理单个草稿
 */
export async function processSingleDraft(draftId: string, url: string): Promise<void> {
    console.log(`[Batch Processor] Processing draft ${draftId} from ${url}`);

    const platform = detectPlatform(url);

    if (platform === 'unknown' || platform === 'zcy') {
        console.warn(`[Batch Processor] Unsupported platform or ZCY internal copy: ${platform}`);
        return;
    }

    let productData;

    // 根据平台调用不同爬虫
    switch (platform) {
        case 'jd':
            productData = await scrapeJDProduct(url);
            break;
        case 'tmall':
            productData = await scrapeTmallProduct(url);
            break;
        case 'taobao':
            productData = await scrapeTaobaoProduct(url);
            break;
        case 'suning':
            productData = await scrapeSuningProduct(url);
            break;
        default:
            throw new Error(`Unsupported platform: ${platform}`);
    }

    // 更新草稿
    await prisma.productDraft.update({
        where: { id: draftId },
        data: {
            title: productData.title,
            images: JSON.stringify(productData.images),
            attributes: JSON.stringify(productData.attributes),
            detailHtml: productData.detailHtml,
            skuData: JSON.stringify(productData.skuData),
            shopName: productData.shopName || platform.toUpperCase(),
            status: 'scraped'
        }
    });

    console.log(`[Batch Processor] Successfully processed draft ${draftId}`);

    // 更新任务进度
    const draft = await prisma.productDraft.findUnique({
        where: { id: draftId }
    });

    if (draft?.copyTaskId) {
        await updateTaskProgress(draft.copyTaskId);
    }
}

/**
 * 更新任务进度
 */
async function updateTaskProgress(taskId: string): Promise<void> {
    const scraptedCount = await prisma.productDraft.count({
        where: {
            copyTaskId: taskId,
            status: 'scraped'
        }
    });

    const failedCount = await prisma.productDraft.count({
        where: {
            copyTaskId: taskId,
            status: 'failed'
        }
    });

    const task = await prisma.copyTask.findUnique({
        where: { id: taskId }
    });

    if (!task) return;

    const isCompleted = (scraptedCount + failedCount) >= task.totalCount;

    await prisma.copyTask.update({
        where: { id: taskId },
        data: {
            successCount: scraptedCount,
            failedCount: failedCount,
            status: isCompleted ? 'completed' : 'running'
        }
    });

    console.log(`[Batch Processor] Updated task ${taskId}: ${scraptedCount}/${task.totalCount} completed`);
}
