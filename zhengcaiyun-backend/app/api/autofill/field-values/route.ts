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

        /**
         * 权威数据：来自"编辑商品信息"页面，已由用户最终确认
         * 禁止 fallback / 禁止计算 / 原样填写
         */
        const marketPrice = String(productInfo?.price ?? '').trim();
        const salePrice = String(productInfo?.salePrice ?? '').trim();
        const stockValue = String(productInfo?.stock ?? '999').trim();

        console.log(`[Field Values] 权威价格数据: market=${marketPrice}, sale=${salePrice}, stock=${stockValue}`);

        // 构建 Prompt
        const systemPrompt = `你是政采云表单填写助手。用户会给你一个字段列表，请为每个字段提供正确的填写值。

## ⚠️ 重要声明
以下商品信息来自"编辑商品信息"页面，已由用户最终确认。
严禁对价格、库存字段进行任何计算、推理、替换或补全。
只允许原样填写。

## 商品信息（权威数据，必须原样使用）：
- 标题: ${productInfo?.title || ''}
- 品牌: ${productInfo?.brand || ''}
- 型号: ${productInfo?.model || ''}
- 市场价: ${marketPrice}
- 销售价: ${salePrice}
- 库存: ${stockValue}
- 电商链接: ${productInfo?.platform_link || ''}

## 字段列表：
${labels.map((l: string, i: number) => `${i + 1}. ${l}`).join('\n')}

## 强制填写规则（不可违背）：
1. 当字段为「市场价」「市场价(元)」「市场价（元）」等同义字段时：
   => 原样填写: ${marketPrice}
2. 当字段为「销售价」「销售价(元)」「销售价（元）」等同义字段时：
   => 原样填写: ${salePrice}
3. 当字段为「库存」时：
   => 必须填写 ${stockValue}，严禁输出"未提供/未知/空"
4. 产地 → "境内"
5. 电商平台链接 → 使用商品信息中的电商链接
6. 计量单位 → "台" 或 "个"
7. 生产厂商 → 根据品牌推断：惠普/HP→中国惠普有限公司，佳能→佳能（中国）有限公司，联想→联想（北京）有限公司，戴尔→戴尔（中国）有限公司，其他→品牌名+有限公司
8. 是否需要安装 → "不需要"
9. 运费模板 → "默认"
10. 上架时间 → "立即上架"
11. 质保时间 → "12"
12. 换货期限 → "7"
13. 最大分辨率 (dpi) → "600x600" 或根据产品类型推断
14. 最大打印幅面 → "A4"
15. 供纸盒容量 → "150" 或根据产品推断
16. 其他字段 → 根据商品信息合理推断

⚠️ 价格字段禁止自行计算、禁止猜测、禁止留空、禁止输出"未提供"！

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
