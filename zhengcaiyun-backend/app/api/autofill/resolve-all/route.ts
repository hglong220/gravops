import { NextRequest, NextResponse } from 'next/server';
import AIService from '@/lib/ai-service';

export const runtime = 'nodejs';

interface FieldInfo {
    label: string;
    type: 'radio' | 'input' | 'enum' | 'cascade' | 'upload' | 'unknown';
    options: string[];
}

interface ProductData {
    title: string;
    brand?: string;
    model?: string;
    price?: number;
    salePrice?: number;
    manufacturer?: string;
    specs?: Record<string, string>;
    platform_link?: string;
}

interface Decision {
    label: string;
    value: string;
}

/**
 * V2 核心 API：一次性解析所有字段
 * 
 * 设计原则：
 * - 扫描一遍、解析一遍、填写一遍
 * - AI 只负责决策，不负责填写
 * - 商品数据是主数据源
 */
export async function POST(req: NextRequest) {
    try {
        const { productData, fields } = await req.json() as {
            productData: ProductData;
            fields: FieldInfo[];
        };

        if (!fields || fields.length === 0) {
            return NextResponse.json({ decisions: [] });
        }

        console.log(`[Resolve All] 开始解析 ${fields.length} 个字段`);
        console.log(`[Resolve All] 商品: ${productData.title?.substring(0, 50)}`);

        const decisions: Decision[] = [];

        // 第一步：快速规则匹配（不调 AI）
        const needAI: FieldInfo[] = [];

        for (const field of fields) {
            const quickValue = quickResolve(field, productData);
            if (quickValue !== null) {
                decisions.push({ label: field.label, value: quickValue });
                console.log(`[Resolve All] 快速规则: ${field.label} -> ${quickValue}`);
            } else {
                needAI.push(field);
            }
        }

        // 第二步：剩余字段调 AI（一次性）
        if (needAI.length > 0) {
            console.log(`[Resolve All] 需要 AI 解析 ${needAI.length} 个字段`);

            const aiDecisions = await resolveWithAI(needAI, productData);
            decisions.push(...aiDecisions);
        }

        console.log(`[Resolve All] 完成，共 ${decisions.length} 个决策`);
        return NextResponse.json({ decisions });

    } catch (error: any) {
        console.error('[Resolve All] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * 快速规则匹配（基于模式识别，不调 AI）
 */
function quickResolve(field: FieldInfo, productData: ProductData): string | null {
    const label = field.label.toLowerCase();
    const options = field.options;
    const brand = (productData.brand || '').toLowerCase();
    const title = (productData.title || '').toLowerCase();
    const specs = productData.specs || {};

    // ==================== 直接映射（从商品数据取值）====================

    // 品牌
    if (label.includes('品牌') && productData.brand) {
        return productData.brand;
    }

    // 型号
    if (label.includes('型号') && productData.model) {
        return productData.model;
    }

    // 生产厂商
    if ((label.includes('厂商') || label.includes('厂家') || label.includes('生产')) && productData.manufacturer) {
        return productData.manufacturer;
    }

    // 价格
    if (label.includes('市场价') || label.includes('原价')) {
        return productData.price?.toString() || '';
    }
    if (label.includes('销售价') || label.includes('售价')) {
        return productData.salePrice?.toString() || productData.price?.toString() || '';
    }

    // 库存
    if (label.includes('库存') || label.includes('数量')) {
        return '99';
    }

    // 链接
    if (label.includes('链接') || label.includes('网址')) {
        return productData.platform_link || '';
    }

    // ==================== 选择题规则 ====================

    if (options.length === 0) return null;

    // 产地（根据品牌判断）
    if (label === '产地' || label.includes('产地')) {
        const internationalBrands = ['hp', '惠普', 'canon', '佳能', 'epson', '爱普生', 'brother', '兄弟', 'dell', '戴尔', 'lenovo', '联想', 'samsung', '三星', 'xerox', '施乐'];
        const isInternational = internationalBrands.some(b => brand.includes(b));

        if (isInternational) {
            const foreign = options.find(o => o.includes('境外'));
            if (foreign) return foreign;
        }
        const domestic = options.find(o => o.includes('境内'));
        if (domestic) return domestic;
    }

    // 是否类 → 选"否/不需要"
    if (label.includes('是否') || label.includes('有无')) {
        const no = options.find(o => o.includes('否') || o.includes('不') || o.includes('无'));
        if (no) return no;
    }

    // 安装 → 不需要
    if (label.includes('安装')) {
        const noInstall = options.find(o => o.includes('不需要') || o.includes('否') || o.includes('不'));
        if (noInstall) return noInstall;
    }

    // 计量单位
    if (label.includes('单位') || label.includes('计量')) {
        if (title.match(/机|设备|仪|器/) && options.includes('台')) return '台';
        if (options.includes('件')) return '件';
        if (options.includes('个')) return '个';
    }

    // 质保时间
    if (label.includes('质保') || label.includes('保修')) {
        const month12 = options.find(o => o.includes('12'));
        if (month12) return month12;
    }

    // 运费模板
    if (label.includes('运费') || label.includes('模板')) {
        const def = options.find(o => o.includes('默认') || o.includes('包邮'));
        if (def) return def;
    }

    // 能效等级
    if (label.includes('能效') || label.includes('等级')) {
        if (options.includes('二级')) return '二级';
        if (options.includes('一级')) return '一级';
    }

    // ==================== 从 specs 参数字典查找 ====================

    // 尝试从 specs 中找匹配的值
    for (const [key, value] of Object.entries(specs)) {
        if (key.includes(field.label) || field.label.includes(key)) {
            // 如果是选择题，验证值在选项中
            if (options.length > 0) {
                const match = options.find(o => o.includes(value) || value.includes(o));
                if (match) return match;
            } else {
                return value;
            }
        }
    }

    return null;
}

/**
 * 调用 AI 解析剩余字段（一次性调用）
 */
async function resolveWithAI(fields: FieldInfo[], productData: ProductData): Promise<Decision[]> {
    const fieldsDescription = fields.map((f, i) => {
        const optionsText = f.options.length > 0
            ? `可选项: [${f.options.join(', ')}]`
            : '(自由填写)';
        return `${i + 1}. "${f.label}" (${f.type}) ${optionsText}`;
    }).join('\n');

    const specsText = Object.entries(productData.specs || {})
        .slice(0, 50)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');

    const prompt = `
你是一个政采云商品发布助手。

商品信息：
- 标题: ${productData.title || '未知'}
- 品牌: ${productData.brand || '未知'}
- 型号: ${productData.model || '未知'}
- 生产厂商: ${productData.manufacturer || productData.brand || '未知'}
- 参数字典:
${specsText || '(无)'}

需要决定以下字段的填写值：
${fieldsDescription}

请为每个字段选择最合适的值。

规则：
1. 如果是选择题，必须从可选项中选择一个，不能自己编造
2. 如果是自由填写，根据商品信息和参数字典确定值
3. 优先从参数字典中找对应的值
4. 不确定的字段可以留空 ""

返回 JSON 数组格式：
[
  { "label": "字段名1", "value": "填写值1" },
  { "label": "字段名2", "value": "填写值2" }
]

只返回 JSON，不要其他内容。
`;

    try {
        const result = await AIService.analyzeFormSection(prompt);

        // 解析结果
        let decisions: Decision[] = [];

        if (Array.isArray(result)) {
            decisions = result;
        } else if (typeof result === 'string') {
            const cleaned = result.replace(/```json|```/g, '').trim();
            decisions = JSON.parse(cleaned);
        } else if (result && typeof result === 'object') {
            // 可能是对象格式
            if (Array.isArray((result as any).decisions)) {
                decisions = (result as any).decisions;
            }
        }

        // 验证并过滤有效决策
        const validDecisions: Decision[] = [];
        for (const d of decisions) {
            if (!d.label || d.value === undefined) continue;

            // 找对应的字段
            const field = fields.find(f => f.label === d.label);
            if (!field) continue;

            // 如果是选择题，验证值在选项中
            if (field.options.length > 0) {
                const match = field.options.find(o =>
                    o === d.value || o.includes(d.value) || d.value.includes(o)
                );
                if (match) {
                    validDecisions.push({ label: d.label, value: match });
                    console.log(`[Resolve All] AI: ${d.label} -> ${match}`);
                } else {
                    // 兜底：选第一个
                    validDecisions.push({ label: d.label, value: field.options[0] });
                    console.log(`[Resolve All] AI 兜底: ${d.label} -> ${field.options[0]}`);
                }
            } else {
                validDecisions.push({ label: d.label, value: d.value });
                console.log(`[Resolve All] AI: ${d.label} -> ${d.value}`);
            }
        }

        // 为未返回的字段添加兜底值
        for (const field of fields) {
            if (!validDecisions.find(d => d.label === field.label)) {
                const fallback = field.options.length > 0 ? field.options[0] : '';
                validDecisions.push({ label: field.label, value: fallback });
                console.log(`[Resolve All] 兜底: ${field.label} -> ${fallback}`);
            }
        }

        return validDecisions;

    } catch (error) {
        console.error('[Resolve All] AI 调用失败:', error);

        // 全部兜底
        return fields.map(f => ({
            label: f.label,
            value: f.options.length > 0 ? f.options[0] : ''
        }));
    }
}
