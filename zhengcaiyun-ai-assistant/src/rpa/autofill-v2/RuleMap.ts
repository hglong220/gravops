/**
 * 规则映射 V2
 * 
 * 职责：
 * 1. 内置高频核心字段的判定逻辑
 * 2. 只有当规则无法覆盖时才求助 AI
 * 3. 确保品牌、型号、产地等关键字段秒填且准确
 */

import type { FieldCandidate, ProductData, SemanticDecision } from './types';

interface Rule {
    keywords: string[];
    semantic: string;
    // 默认执行动作建议
    defaultAction: 'type' | 'select' | 'click_radio';
    // 默认值（如果 productData 中没有）
    defaultValue?: string;
}

const RULES: Rule[] = [
    // 核心字段
    { keywords: ['品牌'], semantic: 'brand', defaultAction: 'type' },
    { keywords: ['型号', '规格型号', '产品型号'], semantic: 'model', defaultAction: 'type' },
    { keywords: ['产地', '产地区域', '生产地'], semantic: 'origin', defaultAction: 'select', defaultValue: '中国' },
    { keywords: ['生产厂商', '生产厂家', '制造商', '生产商'], semantic: 'manufacturer', defaultAction: 'type' },
    { keywords: ['电商平台链接', '商品详情页链接', '商品链接', '链接地址'], semantic: 'platform_link', defaultAction: 'type' },

    // 单位与数量
    { keywords: ['计量单位', '单位', '销售单位'], semantic: 'unit', defaultAction: 'select', defaultValue: '件' },
    { keywords: ['库存', '库存数量', '预警库存'], semantic: 'stock', defaultAction: 'type', defaultValue: '9999' },
    { keywords: ['价格', '单价', '销售价'], semantic: 'price', defaultAction: 'type' },

    // 质保与认证
    { keywords: ['质保期', '保修期', '质保时间', '保质期'], semantic: 'warranty', defaultAction: 'type', defaultValue: '12个月' },
    { keywords: ['能效等级', '节能等级'], semantic: 'energy_level', defaultAction: 'select' },

    // 是否类字段（默认填"否"）
    { keywords: ['是否中小企业', '中小企业制造', '小微企业', '是否属于中小企业'], semantic: 'is_sme_product', defaultAction: 'click_radio', defaultValue: '否' },
    { keywords: ['是否节能', '节能产品', '是否为节能产品'], semantic: 'is_energy_saving', defaultAction: 'click_radio', defaultValue: '否' },
    { keywords: ['是否环保', '环保认证', '环保产品'], semantic: 'is_env_certified', defaultAction: 'click_radio', defaultValue: '否' },
    { keywords: ['是否进口', '进口产品'], semantic: 'is_imported', defaultAction: 'click_radio', defaultValue: '否' },
    { keywords: ['是否3C', '3C认证', '国家强制认证'], semantic: 'is_3c_certified', defaultAction: 'click_radio', defaultValue: '否' },

    // 包装信息
    { keywords: ['包装规格', '包装单位', '包装'], semantic: 'package_spec', defaultAction: 'type', defaultValue: '1件/箱' },
    { keywords: ['净重', '重量'], semantic: 'weight', defaultAction: 'type' },
    { keywords: ['尺寸', '外形尺寸', '产品尺寸'], semantic: 'dimensions', defaultAction: 'type' },

    // 其他通用字段
    { keywords: ['商品名称', '产品名称', '名称'], semantic: 'title', defaultAction: 'type' },
    { keywords: ['商品编码', '产品编码', 'SKU', '货号'], semantic: 'sku', defaultAction: 'type' },
];

/**
 * 尝试应用规则
 */
export function matchRule(field: FieldCandidate, productData: ProductData): SemanticDecision | null {
    const label = field.label.toLowerCase();

    for (const rule of RULES) {
        if (rule.keywords.some(k => label.includes(k.toLowerCase()))) {
            // 从 productData 获取值，如果没有则使用默认值
            let val = productData[rule.semantic as keyof ProductData];

            // 处理特殊情况
            if (rule.semantic === 'manufacturer' && !val) {
                val = productData.brand; // 制造商默认使用品牌
            }
            if (rule.semantic === 'title' && !val) {
                val = productData.title;
            }

            // 如果没有值，使用默认值
            if (!val && rule.defaultValue) {
                val = rule.defaultValue;
            }

            // 如果还是没有值，返回 null 让其他方法处理
            if (!val) {
                console.log(`[RuleMap] 规则匹配但无值: ${field.label} -> ${rule.semantic}`);
                return null;
            }

            console.log(`[RuleMap] 规则匹配成功: ${field.label} -> ${val}`);

            return {
                signature: field.signature,
                semantic: rule.semantic,
                confidence: 1.0,
                source: 'rule',
                fillValue: String(val),
                fillPlan: {
                    kind: 'use_product_data',
                    key: rule.semantic
                },
                executePlan: {
                    action: rule.defaultAction,
                    payload: String(val)
                }
            };
        }
    }

    // 针对 "是否"、"有无" 的通用逻辑
    if (label.includes('是否') || label.includes('有无')) {
        return {
            signature: field.signature,
            semantic: 'boolean_default',
            confidence: 0.8,
            source: 'rule',
            fillValue: '否',
            fillPlan: {
                kind: 'fixed_value',
                value: '否'
            },
            executePlan: {
                action: 'click_radio',
                payload: '否'
            }
        };
    }

    return null;
}

export const RuleMap = {
    matchRule
};
