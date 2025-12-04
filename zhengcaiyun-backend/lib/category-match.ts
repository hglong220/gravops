/**
 * 智能类目匹配服务
 * 利用18,575个政采云类目数据 + AI + 京东类目提示
 */

interface Category {
    id: number;
    categoryCode: string;
    name: string;
    level: number;
    parentId: number | null;
}

interface CategoryMatchResult {
    category: Category;
    confidence: number;
    reasoning: string;
    alternatives?: Category[];
    needManualReview: boolean;
}

export class CategoryMatchService {

    private categories: Category[] = [];

    constructor() {
        this.loadCategories();
    }

    /**
     * 加载18,575个政采云类目
     */
    private async loadCategories() {
        try {
            const response = await fetch('/api/categories.json');
            const data = await response.json();

            // 扁平化类目树
            this.categories = this.flattenCategories(data.categories);
            console.log(`✅ 加载 ${this.categories.length} 个政采云类目`);

        } catch (error) {
            console.error('加载类目失败:', error);
        }
    }

    /**
     * 扁平化类目树
     */
    private flattenCategories(tree: any[], parentId: number | null = null): Category[] {
        const result: Category[] = [];

        for (const node of tree) {
            result.push({
                id: node.id,
                categoryCode: node.categoryCode,
                name: node.name,
                level: node.level,
                parentId: parentId
            });

            if (node.children && node.children.length > 0) {
                result.push(...this.flattenCategories(node.children, node.id));
            }
        }

        return result;
    }

    /**
     * 智能匹配类目
     */
    async matchCategory(product: any): Promise<CategoryMatchResult> {
        console.log('🤖 开始AI类目匹配...');

        // 多维度信号分析
        const signals = this.analyzeProduct(product);

        // 方法1：如果有京东类目，用作提示
        if (signals.jdCategory) {
            const jdHintResults = await this.matchWithJDHint(signals);

            if (jdHintResults.confidence > 0.90) {
                return jdHintResults;
            }
        }

        // 方法2：纯AI分析
        const aiResult = await this.aiMatch(signals);

        // 方法3：关键词匹配（兜底）
        if (aiResult.confidence < 0.80) {
            const keywordResult = this.keywordMatch(signals.titleKeywords);

            if (keywordResult.confidence > aiResult.confidence) {
                return keywordResult;
            }
        }

        return aiResult;
    }

    /**
     * 多维度产品分析
     */
    private analyzeProduct(product: any) {
        return {
            // 信号1：标题关键词
            titleKeywords: this.extractKeywords(product.title),

            // 信号2：描述
            description: product.description || '',

            // 信号3：京东类目（重要提示）⭐
            jdCategory: product.jdCategory || product.categoryPath,

            // 信号4：品牌
            brand: this.extractBrand(product.title),

            // 信号5：型号
            model: this.extractModel(product.title),

            // 信号6：价格区间（辅助）
            priceRange: this.getPriceRange(product.price),

            // 信号7：规格参数
            specs: product.specs || {}
        };
    }

    /**
     * 利用京东类目作为提示
     */
    private async matchWithJDHint(signals: any): Promise<CategoryMatchResult> {
        console.log('💡 使用京东类目作为提示:', signals.jdCategory);

        // 京东类目映射表（常用100个）
        const jdMapping = this.getJDMapping();

        // 查找映射
        const mapped = jdMapping[signals.jdCategory];

        if (mapped) {
            console.log('✅ 在映射表中找到:', mapped.zcyName);

            return {
                category: this.findCategory(mapped.zcyCategoryCode),
                confidence: 0.95,
                reasoning: `京东类目"${signals.jdCategory}"映射到政采云"${mapped.zcyName}"`,
                needManualReview: false
            };
        }

        // 如果映射表中没有，用AI推断
        const prompt = `
商品信息：
- 标题：${signals.titleKeywords.join(' ')}
- 京东类目：${signals.jdCategory}
- 品牌：${signals.brand || '未知'}

任务：从政采云18,575个类目中选择最合适的
提示：京东的"${signals.jdCategory}"通常对应政采云的哪个类目组？

返回格式：
{
  "categoryCode": "A0101010203",
  "categoryName": "办公设备/计算机设备/笔记本电脑",
  "confidence": 0.92,
  "reasoning": "笔记本电脑属于办公设备类"
}
`;

        try {
            const aiResponse = await this.callAI(prompt);

            return {
                category: this.findCategory(aiResponse.categoryCode),
                confidence: aiResponse.confidence,
                reasoning: aiResponse.reasoning,
                needManualReview: aiResponse.confidence < 0.85
            };

        } catch (error) {
            console.error('AI推断失败:', error);

            // 降级到关键词匹配
            return this.keywordMatch(signals.titleKeywords);
        }
    }

    /**
     * 纯AI匹配
     */
    private async aiMatch(signals: any): Promise<CategoryMatchResult> {
        const prompt = `
商品信息：
- 标题：${signals.titleKeywords.join(' ')}
- 描述：${signals.description}
- 品牌：${signals.brand || '未知'}
- 型号：${signals.model || '未知'}
- 价格区间：${signals.priceRange}

从18,575个政采云类目中选择最合适的3级类目。
优先选择最精准的3级类目，如果不确定则选2级类目。

返回格式：
{
  "categoryCode": "A0101010203",
  "categoryName": "具体类目路径",
  "confidence": 0.88,
  "reasoning": "选择原因",
  "alternatives": ["备选1", "备选2"]
}
`;

        const aiResponse = await this.callAI(prompt);

        return {
            category: this.findCategory(aiResponse.categoryCode),
            confidence: aiResponse.confidence,
            reasoning: aiResponse.reasoning,
            alternatives: aiResponse.alternatives?.map((code: string) => this.findCategory(code)),
            needManualReview: aiResponse.confidence < 0.85
        };
    }

    /**
     * 关键词匹配（兜底）
     */
    private keywordMatch(keywords: string[]): CategoryMatchResult {
        const scores: { category: Category; score: number }[] = [];

        for (const category of this.categories) {
            let score = 0;

            for (const keyword of keywords) {
                if (category.name.includes(keyword)) {
                    score += keyword.length;
                }
            }

            if (score > 0) {
                scores.push({ category, score });
            }
        }

        scores.sort((a, b) => b.score - a.score);

        if (scores.length > 0) {
            const best = scores[0];
            const confidence = Math.min(0.75, best.score / 10);

            return {
                category: best.category,
                confidence: confidence,
                reasoning: '基于关键词匹配',
                alternatives: scores.slice(1, 4).map(s => s.category),
                needManualReview: true
            };
        }

        // 完全找不到，返回默认
        return {
            category: this.categories[0],
            confidence: 0.1,
            reasoning: '无法匹配，需要人工选择',
            needManualReview: true
        };
    }

    /**
     * 提取关键词
     */
    private extractKeywords(title: string): string[] {
        const words = title.split(/[\s\-\/]+/);
        return words.filter(w => w.length > 1 && !/^\d+$/.test(w));
    }

    /**
     * 提取品牌
     */
    private extractBrand(title: string): string | null {
        const brands = ['联想', '华为', '小米', 'Apple', 'ThinkPad', '戴尔', '惠普', 'HP', 'Dell', 'Lenovo'];

        for (const brand of brands) {
            if (title.includes(brand)) {
                return brand;
            }
        }

        return null;
    }

    /**
     * 提取型号
     */
    private extractModel(title: string): string | null {
        const match = title.match(/([A-Z0-9]{2,}[-\s]?[A-Z0-9]*)/);
        return match ? match[0] : null;
    }

    /**
     * 获取价格区间
     */
    private getPriceRange(price: number): string {
        if (price < 100) return '低价位';
        if (price < 1000) return '中低价位';
        if (price < 5000) return '中价位';
        if (price < 10000) return '中高价位';
        return '高价位';
    }

    /**
     * 查找类目
     */
    private findCategory(categoryCode: string): Category {
        const found = this.categories.find(c => c.categoryCode === categoryCode);
        return found || this.categories[0];
    }

    /**
     * 调用AI
     */
    private async callAI(prompt: string): Promise<any> {
        const response = await fetch('/api/ai/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        if (!response.ok) {
            throw new Error('AI调用失败');
        }

        return await response.json();
    }

    /**
     * 京东类目映射表（常用100个）
     */
    private getJDMapping(): Record<string, { zcyCategoryCode: string; zcyName: string }> {
        return {
            '笔记本': {
                zcyCategoryCode: 'A0101010203',
                zcyName: '办公设备/计算机设备/笔记本电脑'
            },
            '台式机': {
                zcyCategoryCode: 'A0101010201',
                zcyName: '办公设备/计算机设备/台式计算机'
            },
            '鼠标': {
                zcyCategoryCode: 'A0101020301',
                zcyName: '办公设备/外围设备/鼠标'
            },
            '键盘': {
                zcyCategoryCode: 'A0101020302',
                zcyName: '办公设备/外围设备/键盘'
            },
            // ... 更多映射
        };
    }
}

export default new CategoryMatchService();
