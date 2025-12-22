/**
 * AutoFill AI Plan API
 * 
 * 接收字段 schema + 产品信息，调用 DeepSeek 返回填写计划
 */

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// DeepSeek 客户端
const deepseek = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com/v1'
})

// GPT 客户端（作为 DeepSeek 的后备）
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
})

interface FieldSchema {
    id: string
    label: string
    required: boolean
    controlType: string
    optionsPreview?: string[]
}

interface ProductInfo {
    title?: string
    brand?: string
    model?: string
    sku?: string
    sourceUrl?: string
    unit?: string
    stock?: number
    specs?: Record<string, string>
}

interface FillPlan {
    id: string
    action: 'input' | 'select' | 'skip'
    value: string
}

// CORS 头
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: corsHeaders })
}

export async function POST(request: NextRequest) {
    try {
        const { productInfo, fields } = await request.json() as {
            productInfo: ProductInfo
            fields: FieldSchema[]
        }

        if (!fields || !fields.length) {
            return NextResponse.json(
                { error: '缺少字段信息' },
                { status: 400, headers: corsHeaders }
            )
        }

        console.log('[AutoFill AI] 收到请求:', {
            title: productInfo?.title,
            fieldsCount: fields.length
        })

        // 构建 prompt
        const prompt = buildPrompt(productInfo, fields)

        // 调用 DeepSeek
        const plans = await callDeepSeek(prompt, fields)

        console.log('[AutoFill AI] 生成计划:', plans.filter(p => p.action !== 'skip').length, '个')

        return NextResponse.json(
            { plans },
            { headers: corsHeaders }
        )

    } catch (error) {
        console.error('[AutoFill AI] 错误:', error)
        return NextResponse.json(
            { error: '处理失败', message: String(error) },
            { status: 500, headers: corsHeaders }
        )
    }
}

function buildPrompt(productInfo: ProductInfo, fields: FieldSchema[]): string {
    return `你是"政采云商品发布"专家，需要根据"字段列表（fields）"和"商品信息（productInfo）"生成填写方案。

⚠️ 填写规则（非常重要）：
1. 根据字段语义判断是否需要填写（required 标记可能不准确）
2. 以下类型字段必须填写：
   - 产地、计量单位、库存、是否需要安装
   - 品牌、型号、商品编码、SKU
   - 电商链接、商品链接（使用 sourceUrl）
   - 质保/售后服务
   - 市场价、销售价（使用 productInfo 中的价格）
3. 以下类型字段可以跳过：
   - 商品图片、详情图、视频（这些是上传类型）
   - 运费模板（需要手动选择）
   - 与商品无关的字段
4. 必须基于语义理解字段含义，不能用规则匹配
5. select/radio 从 optionsPreview 选最合理的值
6. input/textarea 从 productInfo 推理填写
7. 若无法确定值，使用行业常识默认值

⭐⭐⭐ 品牌和型号特殊处理（非常重要）⭐⭐⭐
品牌和型号是「带搜索的下拉框」，填写逻辑：
1. 品牌：使用 action="searchAndClick"，value 填写品牌名（如 "惠普/HP" 或 "HP"）
2. 型号：使用 action="searchAndClick"，value 填写型号名（如 "P1106" 或 "LaserJet Pro P1106"）
   - 优先使用短型号名（如 P1106），更容易匹配下拉选项
   - 如果 productInfo.model 是 "HP LaserJet Pro P1106"，提取核心型号 "P1106"
系统会自动：输入值 → 等待下拉列表 → 点击匹配的选项

⚠️⚠️⚠️ 最重要：返回的 id 必须使用 fields 中传入的原始 id（如 "afield_1"），不能自己编造！

常用默认值：
- 产地：境内（优先）或 中国
- 计量单位：件/台/个
- 是否需要安装：不需要/否
- 是否中小企业制造产品：否（选"是"需要上传证明）
- 库存：${productInfo.stock || 999}
- 售后服务：本产品执行国家三包政策

【商品信息 productInfo】
${JSON.stringify(productInfo, null, 2)}

【页面字段 fields】
${JSON.stringify(fields, null, 2)}

------------------------------------
请基于字段语义 + 商品信息，为每个 field 生成填写方案。
返回的 id 必须与 fields 中的 id 完全一致！

输出格式（只输出JSON数组，不要其他文字）：
[
  {"id":"${fields[0]?.id || 'afield_1'}","action":"input","value":"xxx"},
  {"id":"${fields[1]?.id || 'afield_2'}","action":"select","value":"xxx"},
  {"id":"品牌字段id","action":"searchAndClick","value":"品牌名"},
  {"id":"型号字段id","action":"searchAndClick","value":"型号名"},
  ...
]`
}

async function callDeepSeek(prompt: string, fields: FieldSchema[]): Promise<FillPlan[]> {
    if (!process.env.DEEPSEEK_API_KEY) {
        console.warn('[AutoFill AI] 未配置 DEEPSEEK_API_KEY，使用规则引擎')
        return fallbackRules(fields)
    }

    let plans: FillPlan[] = []

    try {
        const response = await deepseek.chat.completions.create({
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: '你是一个智能表单填写助手，只输出JSON格式的填写方案。' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.1,
            max_tokens: 2000
        })

        const content = response.choices[0]?.message?.content || ''
        console.log('[AutoFill AI] DeepSeek 返回:', content.substring(0, 200))

        // 解析 JSON
        const jsonMatch = content.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
            plans = JSON.parse(jsonMatch[0]) as FillPlan[]
        } else {
            console.warn('[AutoFill AI] 无法解析DeepSeek返回，使用规则引擎')
            return fallbackRules(fields)
        }

    } catch (error) {
        console.error('[AutoFill AI] DeepSeek 调用失败:', error)
        return fallbackRules(fields)
    }

    // ⭐ GPT 后备：对于 DeepSeek 返回 skip 的必填字段，用 GPT 重试
    const skippedRequiredFields = fields.filter(f =>
        f.required && plans.find(p => p.id === f.id)?.action === 'skip'
    )

    if (skippedRequiredFields.length > 0 && process.env.OPENAI_API_KEY) {
        console.log(`[AutoFill AI] GPT 后备：${skippedRequiredFields.length} 个必填字段未填写，调用 GPT...`)

        const gptPlans = await callGPT(skippedRequiredFields)

        // 合并 GPT 返回的计划
        for (const gptPlan of gptPlans) {
            const idx = plans.findIndex(p => p.id === gptPlan.id)
            if (idx >= 0 && gptPlan.action !== 'skip') {
                plans[idx] = gptPlan
                console.log(`[AutoFill AI] GPT 填充: ${skippedRequiredFields.find(f => f.id === gptPlan.id)?.label} => ${gptPlan.value}`)
            }
        }
    }

    return plans
}

// GPT 后备调用（处理 DeepSeek 无法解决的字段）
async function callGPT(fields: FieldSchema[]): Promise<FillPlan[]> {
    if (!process.env.OPENAI_API_KEY) return []

    const prompt = `你是政采云商品发布专家。以下字段是必填项，但 DeepSeek 无法确定如何填写。
请根据字段名称和选项，给出最合理的填写方案。

字段列表：
${JSON.stringify(fields, null, 2)}

填写原则：
1. 有选项的字段（select/radio），从 optionsPreview 中选择最常见/合理的值
2. 没有选项的字段（input），使用行业通用默认值
3. 不确定的情况，宁可填写一个合理默认值，也不要 skip

返回格式（只输出 JSON 数组）：
[{"id":"xxx","action":"select","value":"xxx"},...]`

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',  // 使用更便宜的 mini 版本
            messages: [
                { role: 'system', content: '你是一个智能表单填写专家，只输出JSON。' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.1,
            max_tokens: 1000
        })

        const content = response.choices[0]?.message?.content || ''
        console.log('[AutoFill AI] GPT 返回:', content.substring(0, 200))

        const jsonMatch = content.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]) as FillPlan[]
        }
    } catch (error) {
        console.error('[AutoFill AI] GPT 调用失败:', error)
    }

    return []
}

// 规则引擎兜底（只处理必填项）
function fallbackRules(fields: FieldSchema[]): FillPlan[] {
    return fields.map(f => {
        // 非必填项全部跳过
        if (!f.required) {
            return { id: f.id, action: 'skip' as const, value: '' }
        }

        const l = f.label

        if (/产地/.test(l)) {
            return { id: f.id, action: 'select' as const, value: '中国' }
        }
        if (/计量单位/.test(l)) {
            return { id: f.id, action: 'select' as const, value: '件' }
        }
        if (/是否需要安装|是否安装/.test(l)) {
            return { id: f.id, action: 'select' as const, value: '不需要' }
        }
        if (/库存/.test(l)) {
            return { id: f.id, action: 'input' as const, value: '999' }
        }
        if (/售后服务|质保/.test(l)) {
            return { id: f.id, action: 'input' as const, value: '本产品执行国家三包政策' }
        }
        if (/电商链接|商品链接/.test(l)) {
            return { id: f.id, action: 'input' as const, value: '' } // 前端会补充
        }
        if (/SKU|商品编码|货号/.test(l)) {
            return { id: f.id, action: 'input' as const, value: '' } // 前端会补充
        }

        // 必填但未知的字段，尝试填空（让系统自动校验）
        return { id: f.id, action: 'skip' as const, value: '' }
    })
}
