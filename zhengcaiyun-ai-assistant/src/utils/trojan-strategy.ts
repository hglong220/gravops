/**
 * 木马策略引擎
 * 处理高风险商品的智能上传策略
 */

import { analyzeCategory, analyzeApprovalStatus, captureScreenshot } from '../services/ai-service';
import { uploadProduct, checkApprovalStatusFromDOM, clickEditButton, type ProductData } from './zcy-dom';

export interface TrojanStrategy {
    originalProduct: ProductData;
    substituteProduct: ProductData;
    productId?: string;
    status: 'pending' | 'uploading' | 'monitoring' | 'approved' | 'rejected' | 'replaced';
}

/**
 * 判断商品是否为高风险
 */
import { analyzeProduct } from '../services/api-client';

/**
 * 判断商品是否为高风险 (AI 驱动)
 */
export async function isHighRiskProduct(productName: string, licenseKey: string): Promise<{ isRisk: boolean; safeName?: string }> {
    try {
        const result = await analyzeProduct(productName, licenseKey);
        console.log('[Trojan] AI Risk Analysis:', result);
        const isRisk = result.riskLevel === 'high' || result.suggestedAction === 'trojan_strategy';
        return { isRisk, safeName: result.safeName };
    } catch (error) {
        console.error('[Trojan] Risk analysis failed:', error);
        // Fallback to keyword check
        const riskKeywords = ['军用', '警用', '涉密', '特殊', '管制', '禁止', '限制', '敏感'];
        const isRisk = riskKeywords.some(keyword => productName.includes(keyword));
        return { isRisk };
    }
}

/**
 * 生成替代商品 (AI 驱动)
 */
export async function generateSubstituteProduct(
    originalProduct: ProductData,
    licenseKey: string,
    suggestedSafeName?: string
): Promise<ProductData> {
    // Use AI suggested name if available, otherwise fallback to list
    let safeName = suggestedSafeName;

    if (!safeName) {
        const safeNames = [
            '多功能办公设备',
            '计算机配件套装',
            '网络辅助设备',
            '高清图像采集仪',
            '数据处理终端'
        ];
        safeName = safeNames[Math.floor(Math.random() * safeNames.length)];
    }

    console.log('[Trojan] Using safe name:', safeName);

    // Generate a unique identifier to help find the product later
    const uniqueId = Math.random().toString(36).substring(2, 8).toUpperCase();

    const substitute: ProductData = {
        ...originalProduct,
        name: `${safeName} - ${originalProduct.name.substring(0, 2)}... [#${uniqueId}]`, // 添加唯一标识
        description: `标准办公采购物资，符合相关技术规范。(系统编号: ${uniqueId})`,
        category: '办公设备/计算机/配件' // 默认安全类目
    };

    return substitute;
}

/**
 * 执行木马策略
 */
export async function executeTrojanStrategy(
    originalProduct: ProductData,
    licenseKey: string,
    onProgress?: (status: string) => void
): Promise<{ success: boolean; productId?: string }> {
    try {
        // 1. 检查是否高风险
        onProgress?.('检测商品风险等级...');
        const isHighRisk = await isHighRiskProduct(originalProduct.name, licenseKey);

        if (!isHighRisk) {
            onProgress?.('低风险商品，直接上传');
            const result = await uploadProduct(originalProduct);
            return { success: result.success };
        }

        // 2. 生成替代商品
        onProgress?.('高风险商品，生成替代品...');
        const substitute = await generateSubstituteProduct(originalProduct, licenseKey);
        console.log('[Trojan] Generated substitute:', substitute);

        // 3. 上传替代商品
        onProgress?.(`上传替代商品: ${substitute.name}...`);
        const uploadResult = await uploadProduct(substitute);

        if (!uploadResult.success) {
            return { success: false };
        }

        // 4. 获取商品ID（模拟）
        // 在真实场景中，uploadProduct 应该返回 productId
        // 这里我们为了演示，假设一个 ID
        const productId = '12345678';
        onProgress?.(`商品已提交 (ID: ${productId})`);

        // 5. 监控审核状态
        onProgress?.('监控审核状态 (模拟)...');
        // 真实场景会轮询页面，这里我们模拟等待
        await sleep(2000);

        // 模拟审核通过
        onProgress?.('审核已通过！(模拟)');

        // 6. 修改为真实商品
        onProgress?.('正在还原为真实商品...');
        await sleep(1000);

        // 再次调用上传逻辑，这次用真实数据
        const restoreResult = await uploadProduct(originalProduct);

        if (restoreResult.success) {
            onProgress?.('木马策略执行成功！商品已还原。');
            return { success: true, productId };
        } else {
            onProgress?.('还原失败，请人工检查。');
            return { success: false, productId };
        }

    } catch (error) {
        console.error('[Trojan] 策略执行失败:', error);
        return { success: false };
    }
}

/**
 * 从页面提取商品ID
 */
async function extractProductId(): Promise<string | null> {
    // 从URL提取
    const url = window.location.href;
    const match = url.match(/product[/-](\d+)/i);
    if (match) {
        return match[1];
    }

    // 从页面元素提取
    const idElement = document.querySelector('[data-product-id]');
    if (idElement) {
        return idElement.getAttribute('data-product-id');
    }

    return null;
}

/**
 * 监控审核状态
 */
async function monitorApproval(
    productId: string,
    options: { checkInterval: number; maxWaitTime: number }
): Promise<boolean> {
    const startTime = Date.now();
    console.log(`[Monitor] 开始监控商品 ${productId} (超时: ${options.maxWaitTime}ms)`);

    while (Date.now() - startTime < options.maxWaitTime) {
        // 1. 导航到商品详情页
        await navigateToProduct(productId);
        await sleep(3000); // 等待页面加载

        // 2. 优先使用 DOM 检查 (快速、免费)
        let status = checkApprovalStatusFromDOM();
        console.log(`[Monitor] DOM状态检查: ${status}`);

        // 3. 如果 DOM 无法确定，使用 AI 视觉分析 (慢、付费)
        if (status === 'unknown') {
            console.log('[Monitor] DOM无法确定状态，尝试AI视觉分析...');
            try {
                const screenshot = await captureScreenshot();
                if (screenshot) {
                    status = await analyzeApprovalStatus(screenshot) as any;
                    console.log(`[Monitor] AI状态分析: ${status}`);
                }
            } catch (err) {
                console.error('[Monitor] AI分析失败:', err);
            }
        }

        // 4. 判断结果
        if (status === 'approved') {
            console.log('[Monitor] ✅ 商品已审核通过！');
            return true;
        } else if (status === 'rejected') {
            console.warn('[Monitor] ❌ 商品被拒绝');
            return false;
        }

        // 5. 继续等待
        console.log(`[Monitor] 商品审核中... 下次检查: ${options.checkInterval / 1000}秒后`);
        await sleep(options.checkInterval);
    }

    console.warn('[Monitor] 监控超时');
    return false;
}

/**
 * 导航到商品页面
 */
async function navigateToProduct(productId: string): Promise<void> {
    const url = `https://www.zcygov.cn/product/${productId}`;
    window.location.href = url;
}

/**
 * 替换为原始商品
 */
async function replaceWithOriginal(
    productId: string,
    originalProduct: ProductData
): Promise<void> {
    console.log('[Trojan] 开始替换为真实商品...');

    // 1. 进入编辑模式
    // 注意：我们假设在详情页点击“编辑”会跳转到编辑页，或者当前页面变为可编辑状态
    const success = await clickEditButton(productId);

    if (!success) {
        // 尝试直接访问编辑URL (如果URL规律已知)
        // window.location.href = `.../edit/${productId}`;
        console.warn('[Trojan] 未找到编辑按钮，尝试直接进入编辑模式可能失败');
    }

    await sleep(3000); // 等待编辑页面加载

    // 2. 覆盖填写真实信息
    // 强制覆盖模式
    console.log('[Trojan] 正在填写真实商品信息...');
    const result = await uploadProduct(originalProduct);

    if (result.success) {
        console.log('[Trojan] ✅ 替换填写完成，请人工确认提交或自动提交');
        // 可选：自动点击提交
        // clickSubmitButton();
    } else {
        console.error('[Trojan] ❌ 替换填写失败:', result.error);
        throw new Error(result.error);
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
