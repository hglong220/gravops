/**
 * 上传编排服务
 * 统一协调所有服务，完成完整的上传流程
 */

import rpaUpload from './rpa-upload';
import priceComparison from './price-comparison';
import categoryMatch from './category-match';
import imageProcessing from './image-processing';

interface ProductUploadRequest {
    product: any;
    options?: {
        pricingStrategy?: 'aggressive' | 'conservative' | 'smart';
        manualReview?: boolean;
    };
}

interface ProductUploadResponse {
    success: boolean;
    productId?: string;
    message: string;
    details: {
        priceComparison: any;
        category: any;
        images: any;
        pricing: any;
        timeUsed: number;
    };
    warnings: string[];
    needsAction?: {
        type: 'manual_category' | 'manual_price' | 'manual_images';
        data: any;
    };
}

export class UploadOrchestrator {

    /**
     * 完整的上传流程（单品）
     */
    async uploadSingle(request: ProductUploadRequest): Promise<ProductUploadResponse> {
        const startTime = Date.now();
        const warnings: string[] = [];
        const product = request.product;

        console.log('='.repeat(70));
        console.log('🚀 开始上传商品:', product.title);
        console.log('📦 来源:', product.source);
        console.log('='.repeat(70));

        try {
            // ========== 并行处理阶段 ==========
            console.log('\n⚡ 阶段1: 并行处理（AI分析+图片+比价）');

            const [priceCompResult, categoryResult, imageResult] = await Promise.all([
                // 1. 获取比价信息
                (async () => {
                    console.log('🔍 [1/3] 获取比价信息...');
                    const result = await priceComparison.getPriceComparison(product);
                    console.log(`✅ [1/3] 比价: ${result.status}`);
                    return result;
                })(),

                // 2. AI匹配类目
                (async () => {
                    console.log('🤖 [2/3] AI匹配类目...');
                    const result = await categoryMatch.matchCategory(product);
                    console.log(`✅ [2/3] 类目: ${result.category.name} (${result.confidence})`);
                    return result;
                })(),

                // 3. 获取合规图片
                (async () => {
                    console.log('🖼️  [3/3] 获取合规图片...');
                    const result = await imageProcessing.getComplianceImages(product);
                    console.log(`✅ [3/3] 图片: ${result.images.length}张 (${result.source})`);
                    return result;
                })()
            ]);

            // ========== 检查阶段 ==========
            console.log('\n🔍 阶段2: 检查结果');

            // 检查比价
            if (priceCompResult.status === 'not_found') {
                return {
                    success: false,
                    message: '未找到京东/天猫/苏宁比价链接',
                    details: {
                        priceComparison: priceCompResult,
                        category: categoryResult,
                        images: imageResult,
                        pricing: null,
                        timeUsed: Date.now() - startTime
                    },
                    warnings,
                    needsAction: {
                        type: 'manual_price',
                        data: {
                            message: '请手动提供京东/天猫/苏宁商品链接',
                            alternatives: priceCompResult.alternatives
                        }
                    }
                };
            }

            // 检查类目置信度
            if (categoryResult.needManualReview) {
                warnings.push(`⚠️ 类目置信度较低 (${categoryResult.confidence})，建议人工确认`);

                if (!request.options?.manualReview && categoryResult.confidence < 0.75) {
                    return {
                        success: false,
                        message: '类目匹配置信度过低，需要人工选择',
                        details: {
                            priceComparison: priceCompResult,
                            category: categoryResult,
                            images: imageResult,
                            pricing: null,
                            timeUsed: Date.now() - startTime
                        },
                        warnings,
                        needsAction: {
                            type: 'manual_category',
                            data: {
                                suggested: categoryResult.category,
                                alternatives: categoryResult.alternatives,
                                reasoning: categoryResult.reasoning
                            }
                        }
                    };
                }
            }

            // 检查图片合规度
            if (imageResult.needManualReview) {
                warnings.push(`⚠️ 图片合规度: ${imageResult.compliance}，建议人工检查`);
            }

            if (imageResult.compliance < 0.80) {
                warnings.push('⚠️ 图片合规度过低，强烈建议人工审核');
            }

            // ========== 定价阶段 ==========
            console.log('\n💰 阶段3: 计算最优定价');

            const pricing = priceComparison.calculateOptimalPrice(
                priceCompResult.comparison!,
                {
                    strategy: request.options?.pricingStrategy || 'smart'
                }
            );

            console.log(`✅ 定价: ¥${pricing.yourPrice} (下浮${pricing.discount}%)`);

            // ========== RPA上传阶段 ==========
            console.log('\n🤖 阶段4: RPA自动上传到政采云');

            const uploadResult = await rpaUpload.uploadProduct(product);

            if (!uploadResult.success) {
                return {
                    success: false,
                    message: uploadResult.message,
                    details: {
                        priceComparison: priceCompResult,
                        category: categoryResult,
                        images: imageResult,
                        pricing,
                        timeUsed: Date.now() - startTime
                    },
                    warnings
                };
            }

            // ========== 成功 ==========
            console.log('\n' + '='.repeat(70));
            console.log('🎉 上传成功！');
            console.log(`📦 商品ID: ${uploadResult.productId}`);
            console.log(`⏱️  总耗时: ${((Date.now() - startTime) / 1000).toFixed(1)}秒`);
            console.log('='.repeat(70));

            return {
                success: true,
                productId: uploadResult.productId,
                message: '上传成功',
                details: {
                    priceComparison: priceCompResult,
                    category: categoryResult,
                    images: imageResult,
                    pricing,
                    timeUsed: Date.now() - startTime
                },
                warnings
            };

        } catch (error: any) {
            console.error('❌ 上传失败:', error.message);

            return {
                success: false,
                message: `上传失败: ${error.message}`,
                details: {
                    priceComparison: null,
                    category: null,
                    images: null,
                    pricing: null,
                    timeUsed: Date.now() - startTime
                },
                warnings
            };
        }
    }

    /**
     * 批量上传
     */
    async uploadBatch(products: any[], options?: {
        concurrency?: number;
        delayBetweenBatches?: number;
    }): Promise<{
        total: number;
        success: number;
        failed: number;
        results: ProductUploadResponse[];
    }> {
        const concurrency = options?.concurrency || 3;  // 并发数
        const delay = options?.delayBetweenBatches || 10000;  // 批次间延迟

        console.log('='.repeat(70));
        console.log(`📦 批量上传: ${products.length} 个商品`);
        console.log(`⚙️  并发数: ${concurrency}`);
        console.log('='.repeat(70));

        const results: ProductUploadResponse[] = [];
        const queue = [...products];

        while (queue.length > 0) {
            const batch = queue.splice(0, concurrency);

            console.log(`\n🔄 处理批次: ${batch.length} 个商品`);

            // 并行处理这一批
            const batchResults = await Promise.all(
                batch.map(product => this.uploadSingle({ product }))
            );

            results.push(...batchResults);

            // 批次间随机延迟（防封号）
            if (queue.length > 0) {
                const randomDelay = delay + Math.floor(Math.random() * 5000);
                console.log(`⏸️  暂停 ${randomDelay / 1000} 秒...`);
                await new Promise(resolve => setTimeout(resolve, randomDelay));
            }
        }

        const success = results.filter(r => r.success).length;
        const failed = results.length - success;

        console.log('\n' + '='.repeat(70));
        console.log('📊 批量上传完成');
        console.log(`✅ 成功: ${success}/${results.length}`);
        console.log(`❌ 失败: ${failed}/${results.length}`);
        console.log('='.repeat(70));

        return {
            total: results.length,
            success,
            failed,
            results
        };
    }

    /**
     * 预检查（上传前检查）
     */
    async preCheck(product: any): Promise<{
        canUpload: boolean;
        issues: string[];
        warnings: string[];
        suggestions: string[];
    }> {
        const issues: string[] = [];
        const warnings: string[] = [];
        const suggestions: string[] = [];

        // 检查必填字段
        if (!product.title) {
            issues.push('❌ 缺少商品标题');
        }

        if (!product.price) {
            issues.push('❌ 缺少商品价格');
        }

        if (!product.images || product.images.length === 0) {
            issues.push('❌ 缺少商品图片');
        }

        // 检查来源
        if (!['jd', 'tmall', 'suning', 'taobao', 'zcy'].includes(product.source)) {
            issues.push('❌ 不支持的商品来源');
        }

        // 检查是否能获取比价链接
        if (product.source === 'taobao' || product.source === 'zcy') {
            warnings.push('⚠️ 需要查找京东/天猫/苏宁同款作为比价链接');
            suggestions.push('💡 建议：优先从京东/天猫/苏宁采集商品');
        }

        // 检查标题长度
        if (product.title.length > 60) {
            warnings.push('⚠️ 标题过长，可能需要精简');
        }

        // 检查价格合理性
        if (product.price < 10) {
            warnings.push('⚠️ 价格过低，可能不符合政采云要求');
        }

        if (product.price > 100000) {
            warnings.push('⚠️ 价格过高，建议人工审核');
        }

        return {
            canUpload: issues.length === 0,
            issues,
            warnings,
            suggestions
        };
    }
}

export default new UploadOrchestrator();
