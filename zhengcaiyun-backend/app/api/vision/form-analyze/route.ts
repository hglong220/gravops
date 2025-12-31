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

你收到了 ${imageList.length} 张页面截图，它们按顺序从页面顶部到底部截取，覆盖整个表单页面。

## 核心任务
**识别页面上所有带红色星号（*）的必填字段**，不管它们在什么区域（通用属性、普通属性、技术参数、主要参数、销售规格、运费信息、售后服务、上架管理等任何区域）。

## 字段判断规则
### ✅ 需要返回的字段（required: true）：
- 带红色星号（*）且**旁边有空白输入框/下拉框/单选框**的字段
- 输入框显示"请输入"、"请选择"等占位符的字段

### ❌ 不需要返回的字段：
- 虽然带星号但**已经有值**的字段（如显示"A4"而不是"请输入"）
- 图片上传类字段（商品图片、主图、详情图等）
- 纯展示性字段（只有文字，没有输入控件）

## 商品信息
${JSON.stringify(productInfo, null, 2)}

## 填写规则

### 价格和库存（必须使用采集数据）：
- 市场价 = ${productInfo?.price || '无'}
- 销售价 = ${productInfo?.salePrice || (productInfo?.price ? Math.round(productInfo.price * 0.9 * 100) / 100 : '无')}
- 库存 = ${productInfo?.stock || '99'}

### 单选框（Radio）：
- 产地：国际品牌（惠普、佳能、三星等）在中国有工厂的选"境内"
- 是否需要安装：小型设备选"否"或"不需要"
- 是否中小企业产品：选"否"
- 上架时间：选"立即上架"

### 下拉框（Select）：
- 计量单位：打印机/电脑选"台"，耗材选"个/件"，纸张选"箱"
- 运费模板：选第一个可用模板
- 是否需要安装（如果是下拉框）：选"不需要"
- 上门安装调试：选第一个选项

### 输入框：
- 电商平台链接：必须使用 ${productInfo?.platform_link || '采集的链接'}
- 生产厂商：根据品牌推断，如"惠普"→"中国惠普有限公司"
- 质保时间（个月）：电子产品填"12"
- 整机免费换货期限（天）：填"7"

### 技术参数/主要参数（重要！根据商品类型智能推断）：
- 最大分辨率(dpi)：打印机填"1200x1200"或"600x600"
- 打印速度：根据型号推断，如"20页/分钟"
- 接口类型：勾选"USB2.0"或"USB3.0"
- 其他技术参数：根据商品标题和型号合理推断，格式要符合括号中的单位要求

## 输出格式（严格 JSON）
{
    "summary": "识别了X个需要填写的必填字段，包括XX区域的XX字段",
    "fields": [
        {
            "label": "字段标签（与页面完全一致，包括括号内容如'最大分辨率(dpi)'）",
            "type": "input/select/radio/checkbox",
            "value": "推荐填写的值（格式符合要求）",
            "required": true,
            "confidence": 0.95
        }
    ]
}

## 注意事项
1. 只返回 JSON，不要有任何其他文字
2. label 必须与页面上的文字**完全一致**（包括括号、单位等）
3. 多张截图中的同一字段只返回一次
4. 已填好的字段设置 required: false
5. 对于技术参数，即使不确定也要给出合理推测值，格式必须正确`;

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
