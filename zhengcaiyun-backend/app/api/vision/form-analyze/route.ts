/**
 * 视觉表单分析 API
 * 
 * 让 Gemini 分析页面截图（支持多张），识别所有必填项，并返回结构化的填写计划
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
        // 支持单张截图 (screenshot) 或多张截图 (screenshots)
        const { screenshot, screenshots, productInfo } = body;

        // 构建截图数组
        let imageList: string[] = [];
        if (screenshots && Array.isArray(screenshots)) {
            imageList = screenshots;
        } else if (screenshot) {
            imageList = [screenshot];
        }

        if (imageList.length === 0) {
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

        console.log(`[Form Analyze] 收到 ${imageList.length} 张截图，开始分析...`);

        // 构建强大的分析 Prompt
        const systemPrompt = `你是一个专业的表单分析 AI，专门帮助政采云电商平台自动填写商品发布表单。

你收到了 ${imageList.length} 张页面截图，它们按顺序从页面顶部到底部截取，可能有重叠区域。

你的任务：
1. 仔细观察所有截图中的表单页面
2. 识别所有带红色星号（*）的必填字段，包括但不限于：
   - 通用属性区域（产地、计量单位、电商平台链接等）
   - 普通属性区域（生产厂商、是否需要安装等）
   - 销售规格区域（市场价、销售价、库存）
   - 运费信息（运费模板）
   - 上架管理（上架时间）
3. 去重：如果多张截图中出现同一个字段，只返回一次
4. 根据商品信息，推断每个字段应该填写什么值
5. 返回结构化的 JSON 填写计划

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
- 上架时间：选"立即上架"

⚠️ **下拉框（Select）填写规则**：
- 计量单位：打印机/电脑选"台"，耗材选"个/件"，纸张选"包/箱"
- 运费模板：选择第一个可用的模板

⚠️ **输入框填写规则**：
- 生产厂商：根据品牌推断，如"惠普"→"中国惠普有限公司"
- 电商平台链接：使用 platform_link 字段值

输出格式（必须是合法 JSON）：
{
    "summary": "对页面的整体理解，识别了多少个必填项",
    "fields": [
        {
            "label": "字段标签名（要与页面上显示的完全一致）",
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
2. label 必须与页面上的文字完全一致
3. 合并多张截图中的所有必填项，去重后返回
4. 对于已经填好的字段，标记 required: false
5. 重点关注未填写的星号必填项`;

        // 构建多图请求 parts
        const imageParts = imageList.map((img, index) => ({
            inline_data: {
                mime_type: 'image/png',
                data: img.replace(/^data:image\/\w+;base64,/, '')
            }
        }));

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

        console.log(`[Form Analyze] 正在调用 Gemini 分析 ${imageList.length} 张截图...`);

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    role: 'user',
                    parts: [
                        { text: systemPrompt },
                        ...imageParts
                    ]
                }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 4000,  // 增加 token 限制以容纳更多字段
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

            // 去重处理（按 label 去重）
            const uniqueFields: FormField[] = [];
            const seenLabels = new Set<string>();
            for (const field of (result.fields || [])) {
                if (!seenLabels.has(field.label)) {
                    seenLabels.add(field.label);
                    uniqueFields.push(field);
                }
            }

            console.log(`[Form Analyze] ✅ 成功识别 ${uniqueFields.length} 个字段（去重后）`);

            return NextResponse.json({
                success: true,
                fields: uniqueFields,
                summary: result.summary || `分析完成，识别到 ${uniqueFields.length} 个必填项`
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
