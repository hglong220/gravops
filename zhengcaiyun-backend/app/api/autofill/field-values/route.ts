/**
 * 字段值解析 API（无需视觉，只根据 label 列表返回值）
 * 
 * 输入：字段 label 列表 + 商品信息
 * 输出：每个字段的填写值
 */

import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-2.0-flash-exp';

interface FieldValue {
    label: string;
    value: string;
    type: 'input' | 'select' | 'radio' | 'checkbox';
    required: boolean;
}

interface FieldValuesResult {
    success: boolean;
    fields: FieldValue[];
    error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<FieldValuesResult>> {
    try {
        const body = await request.json();
        const { labels, productInfo } = body;

        if (!labels || !Array.isArray(labels) || labels.length === 0) {
            return NextResponse.json({
                success: false,
                fields: [],
                error: '缺少 labels 参数'
            }, { status: 400 });
        }

        console.log(`[Field Values] 收到 ${labels.length} 个字段，开始解析...`);
        console.log(`[Field Values] 字段列表:`, labels.slice(0, 10).join(', '));

        // 构建 Prompt
        const systemPrompt = `你是政采云表单填写助手。用户会给你一个字段列表，请为每个字段提供正确的填写值。

## 商品信息：
- 标题: ${productInfo?.title || ''}
- 品牌: ${productInfo?.brand || ''}
- 型号: ${productInfo?.model || ''}
- 价格: ${productInfo?.price || ''}
- 库存: ${productInfo?.stock || '999'}
- 电商链接: ${productInfo?.platform_link || ''}

## 字段列表：
${labels.map((l: string, i: number) => `${i + 1}. ${l}`).join('\n')}

## 填写规则：
1. 产地 → "境内"
2. 电商平台链接 → 使用商品信息中的电商链接
3. 计量单位 → "台" 或 "个"
4. 生产厂商 → 根据品牌推断：惠普/HP→中国惠普有限公司，佳能→佳能（中国）有限公司，联想→联想（北京）有限公司，戴尔→戴尔（中国）有限公司，其他→品牌名+有限公司
5. 是否需要安装 → "不需要"
6. 运费模板 → "默认"
7. 上架时间 → "立即上架"
8. 质保时间 → "12"
9. 换货期限 → "7"
10. 最大分辨率 (dpi) → "600x600" 或根据产品类型推断
11. 最大打印幅面 → "A4"
12. 供纸盒容量 → "150" 或根据产品推断
13. 其他字段 → 根据商品信息合理推断

## 输出格式（必须是 JSON）：
{
  "fields": [
    { "label": "字段名", "value": "填写值", "type": "input/select/radio", "required": true }
  ]
}

请为每个字段提供值，不要遗漏任何字段。`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    role: 'user',
                    parts: [{ text: systemPrompt }]
                }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 4000,
                    responseMimeType: 'application/json'
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Field Values] Gemini API 错误:', errorText);
            return NextResponse.json({
                success: false,
                fields: [],
                error: `Gemini API 错误: ${response.status}`
            }, { status: 500 });
        }

        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        console.log('[Field Values] Gemini 返回:', content.substring(0, 300));

        // 解析 JSON
        try {
            const result = JSON.parse(content);
            const fields: FieldValue[] = result.fields || [];

            console.log(`[Field Values] 成功解析 ${fields.length} 个字段`);

            return NextResponse.json({
                success: true,
                fields
            });

        } catch (parseError) {
            console.error('[Field Values] JSON 解析失败:', parseError);
            return NextResponse.json({
                success: false,
                fields: [],
                error: 'Gemini 返回格式错误'
            }, { status: 500 });
        }

    } catch (error) {
        console.error('[Field Values] 错误:', error);
        return NextResponse.json({
            success: false,
            fields: [],
            error: String(error)
        }, { status: 500 });
    }
}
