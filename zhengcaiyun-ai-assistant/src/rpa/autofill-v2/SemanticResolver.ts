import type { FieldCandidate, SemanticDecision, ProductData } from './types';
import { RuleMap } from './RuleMap';

// 记录失效节点，避免无限重试
const BLACKLIST = new Set<string>();

/**
 * V2 语义解析器：规则优先 + AI 兜底
 * 
 * ⚠️ 重要：点选类（select/radio）不调用 AI！
 * 因为此时还不知道真实选项，AI 会瞎猜。
 * 让 FillExecutor 打开下拉获取真实选项后再决策。
 */
export async function resolveField(field: FieldCandidate, productData: ProductData): Promise<SemanticDecision> {

    // 1. 熔断判定
    if (BLACKLIST.has(field.signature)) {
        console.log(`[V2 Resolver] 跳过熔断字段: ${field.label}`);
        return createFailedDecision(field, '熔断');
    }

    // 2. ⭐ 点选类（select/radio/unknown）：不调用 AI！
    // 返回占位符，让 FillExecutor 用真实选项决策
    if (field.controlType === 'select' || field.controlType === 'radio' || field.controlType === 'unknown') {
        console.log(`[V2 Resolver] 点选类: ${field.label} -> 交给 Executor 处理`);
        return {
            signature: field.signature,
            semantic: 'enum_placeholder',
            confidence: 1,
            source: 'rule',
            fillValue: '__ENUM_PLACEHOLDER__',
            fillPlan: { kind: 'fixed_value', value: '' },
            executePlan: { action: 'select', payload: '__ENUM_PLACEHOLDER__' }
        };
    }

    // 3. 输入类：优先使用本地规则映射
    const ruleDecision = RuleMap.matchRule(field, productData);
    if (ruleDecision && ruleDecision.executePlan?.payload) {
        console.log(`[V2 Resolver] ✅ 规则命中: ${field.label} -> ${ruleDecision.executePlan.payload}`);
        return ruleDecision;
    }

    // 4. 从 specs 中智能匹配
    const specsDecision = matchFromSpecs(field, productData);
    if (specsDecision && specsDecision.executePlan?.payload) {
        console.log(`[V2 Resolver] ✅ Specs 匹配: ${field.label} -> ${specsDecision.executePlan.payload}`);
        return specsDecision;
    }

    // 5. 调用后端 AI 服务（仅输入类才调用）
    try {
        console.log(`[V2 Resolver] 🤖 调用 AI 解析: ${field.label}`);
        const baseUrl = process.env.PLASMO_PUBLIC_BACKEND_URL || 'http://localhost:3000';
        const response = await fetch(`${baseUrl}/api/autofill/semantic-resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ field, productData }),
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            console.warn(`[V2 Resolver] AI 服务返回错误: ${response.status}`);
            return createDefaultDecision(field, productData);
        }

        const decision = await response.json() as SemanticDecision;
        const payload = decision.executePlan?.payload;

        if (!payload || payload.length > 100 || payload.includes('没有提供') || payload === field.label) {
            console.warn(`[V2 Resolver] AI 返回无效: "${payload}"`);
            return createDefaultDecision(field, productData);
        }

        console.log(`[V2 Resolver] ✅ AI 决议: ${field.label} -> ${payload}`);
        return { ...decision, fillValue: payload };

    } catch (e: any) {
        console.warn(`[V2 Resolver] AI 调用异常: ${e.message}`);
        return createDefaultDecision(field, productData);
    }
}

/**
 * 从 specs 中智能匹配字段值
 */
function matchFromSpecs(field: FieldCandidate, productData: ProductData): SemanticDecision | null {
    const specs = productData.specs;
    if (!specs || typeof specs !== 'object') return null;

    const label = field.label.toLowerCase();

    // 遍历 specs，寻找最匹配的键
    for (const [key, value] of Object.entries(specs)) {
        const keyLower = key.toLowerCase();
        // 精确匹配或包含匹配
        if (keyLower === label || label.includes(keyLower) || keyLower.includes(label)) {
            if (value && typeof value === 'string' && value.trim()) {
                return {
                    signature: field.signature,
                    semantic: `specs_${key}`,
                    confidence: 0.9,
                    source: 'specs',
                    fillValue: value,
                    fillPlan: { kind: 'use_product_data', key },
                    executePlan: { action: 'type', payload: value }
                };
            }
        }
    }

    return null;
}

/**
 * 创建默认决策（当 AI 失败时的兜底）
 */
function createDefaultDecision(field: FieldCandidate, productData: ProductData): SemanticDecision {
    const label = field.label.toLowerCase();
    let defaultValue = '';

    // 根据常见字段类型提供默认值
    if (label.includes('产地') || label.includes('产地区域')) {
        defaultValue = '中国';
    } else if (label.includes('质保') || label.includes('保修')) {
        defaultValue = '12个月';
    } else if (label.includes('是否') || label.includes('有无')) {
        defaultValue = '否';
    } else if (label.includes('单位') || label.includes('计量')) {
        defaultValue = '件';
    } else if (label.includes('库存') || label.includes('数量')) {
        defaultValue = productData.stock?.toString() || '9999';
    } else if (label.includes('价格') || label.includes('单价')) {
        defaultValue = productData.price?.toString() || '';
    } else if (label.includes('品牌')) {
        defaultValue = productData.brand || '';
    } else if (label.includes('型号')) {
        defaultValue = productData.model || '';
    } else if (label.includes('厂商') || label.includes('制造商') || label.includes('厂家')) {
        defaultValue = productData.manufacturer || productData.brand || '';
    } else if (label.includes('链接') || label.includes('网址') || label.includes('地址')) {
        defaultValue = productData.platform_link || '';
    }

    if (defaultValue) {
        console.log(`[V2 Resolver] 📌 使用默认值: ${field.label} -> ${defaultValue}`);
        return {
            signature: field.signature,
            semantic: 'default',
            confidence: 0.6,
            source: 'default',
            fillValue: defaultValue,
            fillPlan: { kind: 'fixed_value', value: defaultValue },
            executePlan: { action: 'type', payload: defaultValue }
        };
    }

    // 无法确定值，熔断
    BLACKLIST.add(field.signature);
    return createFailedDecision(field, '无法确定填充值');
}

function createFailedDecision(field: FieldCandidate, reason: string): SemanticDecision {
    return {
        signature: field.signature,
        semantic: 'failed',
        confidence: 0,
        source: 'failed',
        fillValue: '',
        executePlan: { action: 'type', payload: '' },
        fillPlan: { kind: 'fixed_value', value: '' }
    };
}

export const SemanticResolver = {
    resolveField
};
