/**
 * AI 表单分析 API
 * 方案二的核心：用 DeepSeek 分析表单字段并生成映射
 */

import { NextRequest, NextResponse } from 'next/server';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

interface FormField {
    label: string;
    selector: string;
    type: string;
    required: boolean;
    name?: string;
    id?: string;
}

interface FieldMapping {
    label: string;
    selector: string;
    dataKey: string;  // 对应商品数据的字段名
    required: boolean;
    type: string;
    fillMethod?: 'input' | 'select' | 'click' | 'custom';
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { fields, productData } = body;

        if (!fields || !Array.isArray(fields)) {
            return NextResponse.json(
                { error: '缺少 fields 参数' },
                { status: 400 }
            );
        }

        const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

        if (!GOOGLE_API_KEY) {
            console.warn('[AI分析] 无 Gemini API Key，使用规则匹配');
            const mapping = ruleBasedMapping(fields);
            return NextResponse.json({ mapping, method: 'rule' });
        }

        // 构建提示词
        const fieldList = fields.slice(0, 30).map((f: FormField) =>
            `- ${f.label} (${f.required ? '必填' : '选填'}) [${f.type}] 选择器: ${f.selector}`
        ).join('\n');

        const prompt = `你是一个政采云表单填写助手。

以下是政采云商品发布页面的表单字段：
${fieldList}

可用的商品数据字段：
- title: 商品标题
- brand: 品牌
- model: 型号
- price: 销售价
- marketPrice: 市场价
- stock: 库存
- category: 类目
- specs: 规格参数对象
- description: 商品描述
- images: 主图数组
- detailImages: 详情图数组

请为每个表单字段匹配对应的商品数据字段。返回 JSON 数组格式：
[
  {
    "label": "表单字段名",
    "selector": "CSS选择器",
    "dataKey": "对应的商品数据字段",
    "required": true/false,
    "type": "input/select/textarea",
    "fillMethod": "input/select/click"
  }
]

注意：
1. 如果是规格参数类字段（如"打印速度"），dataKey 用 "specs.打印速度" 格式
2. 如果无法确定对应关系，dataKey 设为空字符串
3. 只返回 JSON，不要其他内容`;

        // 调用 Gemini
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    role: 'user',
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0,
                    responseMimeType: "application/json"
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Gemini API error: ${response.status} ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // 解析 JSON
        let mapping: FieldMapping[] = [];
        try {
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                mapping = JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.error('[AI分析] JSON 解析失败:', e);
            mapping = ruleBasedMapping(fields);
        }

        return NextResponse.json({
            mapping,
            method: 'ai',
            rawResponse: content.substring(0, 500)
        });

    } catch (error) {
        console.error('[AI分析] 失败:', error);
        return NextResponse.json(
            { error: 'AI 分析失败' },
            { status: 500 }
        );
    }
}

// 基于规则的映射（备选方案）
function ruleBasedMapping(fields: FormField[]): FieldMapping[] {
    const rules: Record<string, string> = {
        '商品名称': 'title',
        '货物名称': 'title',
        '标题': 'title',
        '品牌': 'brand',
        '型号': 'model',
        '规格型号': 'model',
        '单价': 'price',
        '销售价': 'price',
        '报价': 'price',
        '市场价': 'marketPrice',
        '原价': 'marketPrice',
        '库存': 'stock',
        '数量': 'stock',
    };

    return fields.map(f => {
        let dataKey = '';
        for (const [keyword, key] of Object.entries(rules)) {
            if (f.label.includes(keyword)) {
                dataKey = key;
                break;
            }
        }

        return {
            label: f.label,
            selector: f.selector,
            dataKey,
            required: f.required,
            type: f.type,
            fillMethod: f.type === 'select' ? 'select' : 'input'
        };
    });
}
