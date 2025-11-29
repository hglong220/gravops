/**
 * 审核状态监控服务
 * 定期检查商品审核状态，批准后触发修改
 */

import { prisma } from './prisma';

export interface ProductMonitor {
    id: string;
    originalProductName: string;
    safeProductName: string;
    uploadedProductId: string;
    status: 'pending' | 'approved' | 'rejected' | 'modified';
    createdAt: Date;
    checkUrl: string;
}

/**
 * 创建监控任务
 */
export async function createMonitorTask(params: {
    userId: string;
    originalProductName: string;
    safeProductName: string;
    uploadedProductId: string;
    checkUrl: string;
}): Promise<string> {
    // TODO: 在实际数据库中创建监控记录
    console.log('[Monitor] Created task:', params);
    return 'TASK-' + Date.now();
}

/**
 * 检查商品审核状态
 */
export async function checkApprovalStatus(productId: string): Promise<{
    approved: boolean;
    status: string;
}> {
    // Mock: 随机返回审核状态
    const random = Math.random();

    if (random > 0.7) {
        return { approved: true, status: 'approved' };
    } else if (random > 0.3) {
        return { approved: false, status: 'pending' };
    } else {
        return { approved: false, status: 'rejected' };
    }
}

/**
 * 生成安全替代商品
 */
export async function generateSafeAlternative(riskyProduct: string): Promise<{
    safeName: string;
    safeDescription: string;
    reasoning: string;
}> {
    console.log('[TrojanStrategy] Generating safe alternative for:', riskyProduct);

    // 敏感词库
    const sensitiveKeywords = ['刀', '枪', 'VPN', '翻墙', '爆', '违禁'];

    // 提取非敏感部分
    let safeName = riskyProduct;
    for (const keyword of sensitiveKeywords) {
        safeName = safeName.replace(new RegExp(keyword, 'g'), '');
    }

    // 添加通用办公用品描述
    if (!safeName || safeName.trim().length < 2) {
        safeName = '办公文具套装';
    }

    return {
        safeName: safeName.trim() || '办公用品',
        safeDescription: '办公室日常使用的通用文具用品',
        reasoning: `移除敏感关键词，使用通用类目名称`
    };
}

/**
 * 自动修改已审核商品
 */
export async function modifyApprovedProduct(params: {
    productId: string;
    newName: string;
    newDescription: string;
    newImages: string[];
}): Promise<{ success: boolean; error?: string }> {
    console.log('[TrojanStrategy] Modifying product:', params.productId);

    try {
        // TODO: 实际调用政采云API修改商品
        // 这需要模拟登录态和CSRF token

        await new Promise(resolve => setTimeout(resolve, 1000));

        return { success: true };
    } catch (error: any) {
        return {
            success: false,
            error: error.message
        };
    }
}
