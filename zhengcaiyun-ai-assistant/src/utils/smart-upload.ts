/**
 * 智能上传流程编排器
 * 整合 AI 分析、图片搜索、DOM 操作等功能
 */

import { analyzeProduct, searchProductImages, logUsage } from '../services/api-client';
import {
    fillProductName,
    fillDescription,
    findCategorySelector,
    selectCategory,
    uploadImage,
    submitForm,
    type ProductData,
} from './zcy-dom';

export interface SmartUploadOptions {
    productName: string;
    licenseKey: string;
    enableAI?: boolean;
    enableImageSearch?: boolean;
    autoSubmit?: boolean;
}

export interface SmartUploadResult {
    success: boolean;
    steps: {
        aiAnalysis?: {
            success: boolean;
            category?: string;
            riskLevel?: string;
        };
        imageSearch?: {
            success: boolean;
            imageCount?: number;
        };
        fillForm?: {
            success: boolean;
            error?: string;
        };
        submit?: {
            success: boolean;
        };
    };
    usedTrojanStrategy?: boolean;
}

export async function executeSmartUpload(
    options: SmartUploadOptions
): Promise<SmartUploadResult> {
    const result: SmartUploadResult = {
        success: false,
        steps: {},
    };

    try {
        console.log('[SmartUpload] 开始智能上传流程:', options.productName);

        // ========== 步骤 1: AI 分析 ==========
        let aiCategory: string | undefined;
        let aiSuggestedAction: string | undefined;

        if (options.enableAI !== false) {
            try {
                console.log('[SmartUpload] 调用 AI 分析...');
                const aiResult = await analyzeProduct(
                    options.productName,
                    options.licenseKey
                );

                result.steps.aiAnalysis = {
                    success: true,
                    category: aiResult.category,
                    riskLevel: aiResult.riskLevel,
                };

                aiCategory = aiResult.category;
                aiSuggestedAction = aiResult.suggestedAction;

                console.log('[SmartUpload] AI 分析结果:', {
                    category: aiCategory,
                    riskLevel: aiResult.riskLevel,
                    action: aiSuggestedAction,
                });

                if (aiSuggestedAction === 'trojan_strategy') {
                    console.log('[SmartUpload] AI 建议使用木马策略');
                    result.usedTrojanStrategy = false;
                }
            } catch (error) {
                console.error('[SmartUpload] AI 分析失败:', error);
                result.steps.aiAnalysis = { success: false };
            }
        }

        // ========== 步骤 2: 图片搜索 ==========
        let searchedImages: string[] = [];

        if (options.enableImageSearch !== false) {
            try {
                console.log('[SmartUpload] 搜索商品图片...');
                const images = await searchProductImages(
                    options.productName,
                    options.licenseKey
                );

                searchedImages = images.slice(0, 3).map((img) => img.url);

                result.steps.imageSearch = {
                    success: true,
                    imageCount: searchedImages.length,
                };

                console.log(`[SmartUpload] 找到 ${searchedImages.length} 张图片`);
            } catch (error) {
                console.error('[SmartUpload] 图片搜索失败:', error);
                result.steps.imageSearch = { success: false, imageCount: 0 };
            }
        }

        // ========== 步骤 3: 填写表单 ==========
        try {
            console.log('[SmartUpload] 开始填写表单...');

            if (!fillProductName(options.productName)) {
                throw new Error('无法填写商品名称');
            }

            await sleep(500);

            // 填写商品描述 (如果 AI 分析结果中有 reasoning，可以用作描述，或者使用默认描述)
            const description = aiSuggestedAction ? `AI推荐操作: ${aiSuggestedAction}` : '智能上传助手自动填写';
            if (fillDescription(description)) {
                console.log('[SmartUpload] 已填写商品描述');
            } else {
                console.warn('[SmartUpload] 无法填写商品描述 (非致命错误)');
            }

            await sleep(500);

            if (aiCategory) {
                const categorySelector = findCategorySelector();
                if (categorySelector) {
                    categorySelector.click();
                    await sleep(500);

                    const matchedCategory = findBestCategoryMatch(aiCategory);
                    if (matchedCategory) {
                        selectCategory(matchedCategory);
                        console.log('[SmartUpload] 已选择类目:', matchedCategory);
                    }

                    await sleep(500);
                }
            }

            if (searchedImages.length > 0) {
                for (const imageUrl of searchedImages) {
                    await uploadImage(imageUrl);
                    await sleep(800);
                }
            }

            result.steps.fillForm = { success: true };
            console.log('[SmartUpload] 表单填写完成');

        } catch (error) {
            console.error('[SmartUpload] 表单填写失败:', error);
            result.steps.fillForm = { success: false, error: (error as Error).message };
        }

        // ========== 记录使用日志 ==========
        await logUsage(options.licenseKey, 'smart_upload', {
            productName: options.productName,
            aiUsed: options.enableAI !== false,
            imageSearchUsed: options.enableImageSearch !== false,
            success: result.steps.fillForm?.success || false,
        });

        result.success = result.steps.fillForm?.success || false;
        return result;

    } catch (error) {
        console.error('[SmartUpload] 流程执行失败:', error);
        return result;
    }
}

function findBestCategoryMatch(aiCategory: string): string | null {
    const keywords = aiCategory.split('/');
    const options = document.querySelectorAll(
        '.category-option, [class*="category-item"], .dropdown-item, li'
    );

    for (let i = keywords.length - 1; i >= 0; i--) {
        const keyword = keywords[i];
        for (const option of options) {
            const text = option.textContent?.trim();
            if (text && text.includes(keyword)) {
                console.log(`[CategoryMatch] 匹配到类目: ${text} (关键词: ${keyword})`);
                return text;
            }
        }
    }

    console.warn('[CategoryMatch] 未找到匹配的类目');
    return null;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
