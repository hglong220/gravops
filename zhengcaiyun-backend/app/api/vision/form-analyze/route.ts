/**
 * 视觉表单分析 API
 * 
 * 让 Gemini 分析页面截图，识别所有必填项，并返回结构化的填写计划
 * RPA 根据这个计划精准执行，不需要自己"思考"
 */

import { NextRequest, NextResponse } from 'next/server';

// Gemini API 配置
const GEMINI_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-2.0-flash-exp'; // 使用最新的视觉模型

interface FormField {
    label: string;           // 字段标签名
    type: 'input' | 'select' | 'radio' | 'checkbox' | 'textarea';  // 控件类型
    value: string;           // AI 推荐填写的值
    options?: string[];      // 如果是选择类型，可选项列表
    required: boolean;       // 是否必填（星号）
    confidence: number;      // AI 置信度 0-1
}

interface FormAnalysisResult {
    success: boolean;
    fields: FormField[];
    summary: string;         // AI 对页面的整体理解
    error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<FormAnalysisResult>> {
    try {
        const body = await request.json();
        const { screenshot, productInfo } = body;

        if (!screenshot) {
            return NextResponse.json({
                success: false,
                fields: [],
                summary: '',
                error: '缺少截图参数'
            }, { status: 400 });
        }

        if (!GEMINI_API_KEY) {
            return NextResponse.json({
                success: false,
                fields: [],
                summary: '',
                error: 'Gemini API Key 未配置'
            }, { status: 500 });
        }

        // 构建强大的分析 Prompt
        const systemPrompt = `你是一个专业的表单分析 AI，专门帮助政采云电商平台自动填写商品发布表单。

你的任务：
1. 仔细观察截图中的表单页面
2. 识别所有带红色星号（*）的必填字段，包括：
   - 基本信息区域（产地、计量单位等）
   - 价格信息区域（市场价、销售价）
   - 库存区域（库存数量）
   - 其他必填项
3. 根据商品信息，推断每个字段应该填写什么值
4. 返回结构化的 JSON 填写计划

商品信息：
${JSON.stringify(productInfo, null, 2)}

⚠️ **价格和库存填写规则**（重要！）：
- 市场价：直接使用商品信息中的 price 字段值（如 ${productInfo?.price || '无'}）
- 销售价：使用市场价的 90%，即 ${productInfo?.price ? Math.round(productInfo.price * 0.9 * 100) / 100 : '无'}
- 库存：直接使用商品信息中的 stock 字段值（如 ${productInfo?.stock || '99'}）

⚠️ **单选框（Radio）填写规则**：
- 产地：如果是惠普、佳能等国际品牌在中国有工厂的，选"境内"
- 是否需要安装：打印机等小型设备选"否"或"不需要"
- 是否中小企业产品：通常选"否"

关于其他字段值的推断规则：
- 计量单位：打印机/电脑选"台"，耗材选"个/件"，纸张选"包/箱"
- 生产厂商：根据品牌推断，如"惠普"→"中国惠普有限公司"
- 制造商名称：同生产厂商
- 重量：打印机约"5-15kg"
- 上市时间：填"2024"

输出格式（必须是合法 JSON）：
{
    "summary": "对页面的整体理解，有多少个必填项等",
    "fields": [
        {
            "label": "字段标签名（要与页面上显示的完全一致，如'市场价'或'销售价'）",
            "type": "input 或 select 或 radio 或 checkbox",
            "value": "AI 推荐填写的具体值",
            "options": ["可选项1", "可选项2"],
            "required": true,
            "confidence": 0.95
        }
    ]
}

注意：
1. 只返回 JSON，不要有任何其他文字
2. label 必须与页面上的文字完全一致（如"市场价"不是"市场价（元）"）
3. 必须识别价格区域的输入框，它们通常在"价格信息"标题下
4. 对于已经填好的字段，标记 required: false
5. 重点关注未填写的星号必填项`;


        // 调用 Gemini Vision API
        const imageUrl = screenshot.startsWith('data:image')
            ? screenshot
            : `data:image/png;base64,${screenshot}`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

        console.log('[Form Analyze] 正在调用 Gemini 分析表单...');

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    role: 'user',
                    parts: [
                        { text: systemPrompt },
                        { inline_data: { mime_type: 'image/png', data: screenshot.replace(/^data:image\/\w+;base64,/, '') } }
                    ]
                }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 2000,
                    responseMimeType: 'application/json'
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Form Analyze] Gemini API 错误:', errorText);
            return NextResponse.json({
                success: false,
                fields: [],
                summary: '',
                error: `Gemini API 错误: ${response.status}`
            }, { status: 500 });
        }

        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        console.log('[Form Analyze] Gemini 原始返回:', content.substring(0, 500));

        // 解析 JSON
        try {
            const result = JSON.parse(content);

            console.log(`[Form Analyze] ✅ 成功识别 ${result.fields?.length || 0} 个字段`);

            return NextResponse.json({
                success: true,
                fields: result.fields || [],
                summary: result.summary || '分析完成'
            });
        } catch (parseError) {
            console.error('[Form Analyze] JSON 解析失败:', parseError);
            return NextResponse.json({
                success: false,
                fields: [],
                summary: '',
                error: 'AI 返回格式异常，无法解析'
            }, { status: 500 });
        }

    } catch (error) {
        console.error('[Form Analyze] 服务器错误:', error);
        return NextResponse.json({
            success: false,
            fields: [],
            summary: '',
            error: '服务器内部错误'
        }, { status: 500 });
    }
}
