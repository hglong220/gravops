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
        const systemPrompt = `你是政采云表单填写助手。你需要分析截图并识别所有带红色星号(*)的必填字段。

## 你收到了 ${imageList.length} 张连续截图，覆盖整个表单页面。

## 你必须做到：
1. 找到所有带红色星号(*)的必填字段
2. 为每个字段提供正确的填写值
3. 不遗漏任何必填字段

## 商品信息（必须使用这些数据）：
- 标题: ${productInfo?.title || ''}
- 品牌: ${productInfo?.brand || ''}
- 型号: ${productInfo?.model || ''}
- 价格: ${productInfo?.price || ''}
- 库存: ${productInfo?.stock || '999'}
- 电商链接: ${productInfo?.platform_link || ''}

## 每个必填字段的正确值：

| 字段名 | 类型 | 填写值 |
|-------|------|-------|
| 产地 | radio | 境内 |
| 电商平台链接 | input | ${productInfo?.platform_link || '采集的链接'} |
| 计量单位 | select | 台 |
| 生产厂商 | input | ${productInfo?.brand || '品牌'}有限公司 |
| 是否需要安装 | select | 不需要 |
| 运费模板 | select | 默认 |
| 市场价 | input | ${productInfo?.price || ''} |
| 销售价 | input | ${productInfo?.salePrice || (productInfo?.price ? Math.round(Number(productInfo.price) * 0.9 * 100) / 100 : '')} |
| 库存 | input | ${productInfo?.stock || '999'} |
| 质保时间(个月) | input | 12 |
| 换货期限(天) | input | 7 |
| 上架时间 | radio | 立即上架 |

## 技术参数（根据商品类型推断）：
- 最大打印幅面: A4
- 最大分辨率: 1200x1200
- 其他技术参数: 根据商品标题智能推断

## 重要规则：
1. **label 必须与页面上的文字完全一致**
2. **value 不能为空或 undefined**
3. **type 必须准确**：input/select/radio/checkbox
4. **多张截图中的同一字段只返回一次**
5. **图片上传类字段不返回**

## 输出格式（严格 JSON）：
{
  "summary": "识别了X个必填字段",
  "fields": [
    {"label": "产地", "type": "radio", "value": "境内", "required": true, "confidence": 0.95}
  ]
}`;

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
