/**
 * 政采云比价系统
 * 核心功能：
 * 1. 从京东/天猫/苏宁获取比价链接
 * 2. 智能搜索同款商品
 * 3. 计算最优定价
 */

interface PriceComparison {
    platform: 'jd' | 'tmall' | 'suning';
    url: string;
    price: number;
    title: string;
    similarity?: number;
}

interface PricingStrategy {
    yourPrice: number;
    originalPrice: number;
    discount: number;
    competitiveness: 'high' | 'medium' | 'low';
}

export class PriceComparisonService {

    /**
     * 获取比价信息
     */
    async getPriceComparison(product: any): Promise<{
        status: 'direct' | 'found' | 'not_found' | 'manual_required';
        comparison?: PriceComparison;
        alternatives?: PriceComparison[];
        message: string;
    }> {
        const source = product.source; // jd, taobao, tmall, suning, zcy

        // 情况1：从京东/天猫/苏宁采集 → 直接使用 ✅
        if (['jd', 'tmall', 'suning'].includes(source)) {
            console.log('✅ 使用原始比价链接');

            return {
                status: 'direct',
                comparison: {
                    platform: source as any,
                    url: product.sourceUrl,
                    price: product.price,
                    title: product.title
                },
                message: '✅ 直接使用原链接作为比价依据'
            };
        }

        // 情况2：从淘宝或政采云 → 需要查找 ⚠️
        if (['taobao', 'zcy'].includes(source)) {
            console.log('⚠️ 需要在京东/天猫/苏宁查找同款...');

            const alternatives = await this.findAlternatives(product);

            if (alternatives.length > 0) {
                // 选择最佳比价商品
                const best = this.selectBest(alternatives, product.price);

                return {
                    status: 'found',
                    comparison: best,
                    alternatives: alternatives,
                    message: `✅ 在${best.platform}找到同款商品`
                };
            } else {
                return {
                    status: 'not_found',
                    message: '❌ 未找到京东/天猫/苏宁同款，需要人工提供比价链接',
                };
            }
        }

        return {
            status: 'manual_required',
            message: '⚠️ 不支持的来源平台'
        };
    }

    /**
     * 在京东/天猫/苏宁搜索同款
     */
    private async findAlternatives(product: any): Promise<PriceComparison[]> {
        const keyword = this.extractSearchKeyword(product.title);
        console.log('🔍 搜索关键词:', keyword);

        const alternatives: PriceComparison[] = [];

        try {
            // 并行搜索三个平台
            const [jdResults, tmallResults, suningResults] = await Promise.all([
                this.searchJD(keyword),
                this.searchTmall(keyword),
                this.searchSuning(keyword)
            ]);

            // 从每个平台找最相似的
            const allResults = [
                ...jdResults.map(r => ({ ...r, platform: 'jd' as const })),
                ...tmallResults.map(r => ({ ...r, platform: 'tmall' as const })),
                ...suningResults.map(r => ({ ...r, platform: 'suning' as const }))
            ];

            for (const item of allResults) {
                const similarity = this.calculateSimilarity(product.title, item.title);

                if (similarity > 0.85) { // 相似度>85%
                    alternatives.push({
                        platform: item.platform,
                        url: item.url,
                        price: item.price,
                        title: item.title,
                        similarity: similarity
                    });
                }
            }

            console.log(`✅ 找到 ${alternatives.length} 个同款商品`);

        } catch (error) {
            console.error('搜索同款失败:', error);
        }

        return alternatives;
    }

    /**
     * 搜索京东
     */
    private async searchJD(keyword: string): Promise<any[]> {
        try {
            const response = await fetch('/api/search/jd', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keyword, limit: 10 })
            });

            if (response.ok) {
                const data = await response.json();
                return data.products || [];
            }
        } catch (error) {
            console.error('京东搜索失败:', error);
        }

        return [];
    }

    /**
     * 搜索天猫
     */
    private async searchTmall(keyword: string): Promise<any[]> {
        try {
            const response = await fetch('/api/search/tmall', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keyword, limit: 10 })
            });

            if (response.ok) {
                const data = await response.json();
                return data.products || [];
            }
        } catch (error) {
            console.error('天猫搜索失败:', error);
        }

        return [];
    }

    /**
     * 搜索苏宁
     */
    private async searchSuning(keyword: string): Promise<any[]> {
        try {
            const response = await fetch('/api/search/suning', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keyword, limit: 10 })
            });

            if (response.ok) {
                const data = await response.json();
                return data.products || [];
            }
        } catch (error) {
            console.error('苏宁搜索失败:', error);
        }

        return [];
    }

    /**
     * 提取搜索关键词
     */
    private extractSearchKeyword(title: string): string {
        // 移除无关词汇
        const noise = ['2024款', '新款', '官方旗舰店', '正品', '包邮', '促销'];
        let keyword = title;

        noise.forEach(word => {
            keyword = keyword.replace(word, '');
        });

        // 提取品牌和型号
        const brandPattern = /(联想|华为|小米|Apple|ThinkPad|戴尔|惠普)/i;
        const modelPattern = /([A-Z0-9]+\s?[A-Z0-9]*)/;

        const brandMatch = keyword.match(brandPattern);
        const modelMatch = keyword.match(modelPattern);

        if (brandMatch && modelMatch) {
            return `${brandMatch[0]} ${modelMatch[0]}`;
        }

        // 如果找不到，返回前20个字符
        return keyword.substring(0, 20).trim();
    }

    /**
     * 计算相似度
     */
    private calculateSimilarity(title1: string, title2: string): number {
        // 简化版：关键词匹配度
        const words1 = title1.toLowerCase().split(/\s+/);
        const words2 = title2.toLowerCase().split(/\s+/);

        let matchCount = 0;

        words1.forEach(word => {
            if (word.length > 2 && words2.some(w => w.includes(word) || word.includes(w))) {
                matchCount++;
            }
        });

        return matchCount / Math.max(words1.length, words2.length);
    }

    /**
     * 选择最佳比价商品
     */
    private selectBest(alternatives: PriceComparison[], originalPrice: number): PriceComparison {
        // 策略：优先选价格高的（下浮后更有竞争力）+ 相似度高的
        alternatives.sort((a, b) => {
            // 优先级1：相似度
            const simDiff = (b.similarity || 0) - (a.similarity || 0);
            if (Math.abs(simDiff) > 0.05) {
                return simDiff > 0 ? 1 : -1;
            }

            // 优先级2：价格（选择较高的）
            return b.price - a.price;
        });

        return alternatives[0];
    }

    /**
     * 计算最优定价
     */
    calculateOptimalPrice(
        priceComparison: PriceComparison,
        options: {
            strategy?: 'aggressive' | 'conservative' | 'smart';
            competitorPrices?: number[];
        } = {}
    ): PricingStrategy {
        const basePrice = priceComparison.price;
        const strategy = options.strategy || 'smart';

        // 政采云要求：下浮3-10%
        const minPrice = Math.floor(basePrice * 0.90); // 下浮10%
        const maxPrice = Math.floor(basePrice * 0.97); // 下浮3%

        let yourPrice: number;
        let competitiveness: 'high' | 'medium' | 'low';

        if (strategy === 'aggressive') {
            // 激进：下浮9%
            yourPrice = Math.floor(basePrice * 0.91);
            competitiveness = 'high';

        } else if (strategy === 'conservative') {
            // 保守：下浮4%
            yourPrice = Math.floor(basePrice * 0.96);
            competitiveness = 'low';

        } else {
            // 智能定价（推荐）
            if (options.competitorPrices && options.competitorPrices.length > 0) {
                const lowestCompetitor = Math.min(...options.competitorPrices);

                // 比最低竞品再便宜1-2%
                yourPrice = Math.floor(lowestCompetitor * 0.98);

                // 确保在允许范围内
                if (yourPrice < minPrice) yourPrice = minPrice;
                if (yourPrice > maxPrice) yourPrice = Math.floor(basePrice * 0.92);

                competitiveness = yourPrice < lowestCompetitor ? 'high' : 'medium';
            } else {
                // 没有竞品数据，下浮5%（安全）
                yourPrice = Math.floor(basePrice * 0.95);
                competitiveness = 'medium';
            }
        }

        const discount = Math.round((1 - yourPrice / basePrice) * 100);

        return {
            yourPrice,
            originalPrice: basePrice,
            discount,
            competitiveness
        };
    }
}

export default new PriceComparisonService();
