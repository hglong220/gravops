import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/field-ai-decide
 * 单字段 AI 决策接口
 * 当规则引擎无法确定值时，调用 AI 推理
 */

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { field, productInfo } = body;

        if (!field || !productInfo) {
            return NextResponse.json(
                { error: '缺少 field 或 productInfo 参数' },
                { status: 400, headers: corsHeaders() }
            );
        }

        console.log(`[Field AI] 推理字段: ${field.label}`);

        // 构建 prompt
        const prompt = buildPrompt(field, productInfo);

        // 调用 DeepSeek API
        const value = await callDeepSeek(prompt, field);

        console.log(`[Field AI] 推理结果: ${field.label} -> ${value}`);

        return NextResponse.json(
            { success: true, value },
            { headers: corsHeaders() }
        );

    } catch (error) {
        console.error('[Field AI] 推理失败:', error);
        return NextResponse.json(
            { error: '推理失败', value: null },
            { status: 500, headers: corsHeaders() }
        );
    }
}

function buildPrompt(field: any, productInfo: any): string {
    const optionsText = field.options?.length > 0
        ? `可选值: ${field.options.join(', ')}`
        : '无固定选项，需要填写文本';

    return `你是政采云商品发布助手。请根据以下信息，推理出这个字段应该填写的值。

商品信息:
- 标题: ${productInfo.title || '无'}
- 品牌: ${productInfo.brand || '无'}
- 型号: ${productInfo.model || '无'}
- 规格参数: ${JSON.stringify(productInfo.specs || {}).substring(0, 500)}

字段信息:
- 字段名: ${field.label}
- 控件类型: ${field.controlType}
- ${optionsText}
- 是否必填: ${field.required ? '是' : '否'}

要求:
1. 根据商品信息智能推理该字段应填的值
2. 如果有可选值，必须从可选值中选择
3. 只返回值本身，不要解释
4. 如果实在无法推理，返回最合理的默认值

请直接返回应填的值:`;
}

async function callDeepSeek(prompt: string, field: any): Promise<string> {
    if (!DEEPSEEK_API_KEY) {
        console.warn('[Field AI] 无 DeepSeek API Key，使用智能默认值');
        return getSmartDefault(field);
    }

    try {
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 50,
                temperature: 0.3
            })
        });

        if (response.ok) {
            const data = await response.json();
            const content = data.choices?.[0]?.message?.content?.trim();
            if (content) {
                // 如果有选项，验证返回值是否在选项中
                if (field.options?.length > 0) {
                    const matched = field.options.find((o: string) =>
                        o === content || o.includes(content) || content.includes(o)
                    );
                    return matched || field.options[0];
                }
                return content;
            }
        }
    } catch (e) {
        console.error('[Field AI] DeepSeek 调用失败:', e);
    }

    return getSmartDefault(field);
}

function getSmartDefault(field: any): string {
    // 如果有选项，返回第一个
    if (field.options?.length > 0) {
        // 优先选择一些常见的默认值
        const preferredOptions = ['否', '不需要', '境内', '是', '中型企业'];
        for (const pref of preferredOptions) {
            if (field.options.includes(pref)) {
                return pref;
            }
        }
        return field.options[0];
    }

    // 根据字段名猜测默认值
    const label = field.label || '';
    if (label.includes('单位')) return '件';
    if (label.includes('库存')) return '999';
    if (label.includes('质保')) return '12';
    if (label.includes('重量')) return '1';

    return '';
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: corsHeaders()
    });
}

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };
}
