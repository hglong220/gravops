/**
 * Field Rules Match API
 * 
 * 批量匹配字段规则
 * - POST: 接收字段列表，返回匹配到的规则和未匹配的字段
 */

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// 规则文件路径
const RULES_FILE = path.join(process.cwd(), 'data', 'field-rules.json')

interface FieldSchema {
    id: string
    label: string
    controlType: string
    required: boolean
    optionsPreview?: string[]
}

interface FieldRule {
    id: string
    label: string
    controlType: string
    action: 'input' | 'select' | 'skip'
    value: string
    alternatives?: string[]
    priority: number
    source: 'manual' | 'ai'
    usageCount: number
}

interface RulesData {
    version: string
    updatedAt: string
    rules: FieldRule[]
}

interface MatchResult {
    fieldId: string
    fieldLabel: string
    matched: boolean
    rule?: FieldRule
}

// CORS 头
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// 读取规则文件
function readRules(): RulesData {
    try {
        const data = fs.readFileSync(RULES_FILE, 'utf-8')
        return JSON.parse(data)
    } catch (error) {
        console.error('[Field Rules Match] 读取规则文件失败:', error)
        return { version: '1.0.0', updatedAt: '', rules: [] }
    }
}

// 写入规则文件（用于更新使用次数）
function writeRules(data: RulesData): void {
    try {
        fs.writeFileSync(RULES_FILE, JSON.stringify(data, null, 2), 'utf-8')
    } catch (error) {
        console.error('[Field Rules Match] 写入规则文件失败:', error)
    }
}

// 精确匹配函数
function matchFieldToRule(field: FieldSchema, rules: FieldRule[]): FieldRule | null {
    const fieldLabel = field.label.trim()

    // 1. 精确匹配标签
    let matched = rules.find(r => r.label === fieldLabel)
    if (matched) return matched

    // 2. 移除前缀符号后匹配（如 "*市场价" → "市场价"）
    const cleanLabel = fieldLabel.replace(/^[*＊\s]+/, '').replace(/[:：\s]+$/, '').trim()
    matched = rules.find(r => r.label === cleanLabel)
    if (matched) return matched

    // 3. 检查规则的 label 是否包含在字段标签中（如规则 "库存" 匹配字段 "库存数量"）
    matched = rules.find(r => cleanLabel.includes(r.label) || r.label.includes(cleanLabel))
    if (matched) return matched

    return null
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: corsHeaders })
}

// POST: 批量匹配字段
export async function POST(request: NextRequest) {
    try {
        const { fields } = await request.json() as { fields: FieldSchema[] }

        if (!fields || !fields.length) {
            return NextResponse.json(
                { error: '缺少字段列表' },
                { status: 400, headers: corsHeaders }
            )
        }

        const rulesData = readRules()
        const rules = rulesData.rules.sort((a, b) => b.priority - a.priority) // 按优先级排序

        const results: MatchResult[] = []
        const matchedRuleIds = new Set<string>()

        for (const field of fields) {
            const rule = matchFieldToRule(field, rules)

            if (rule) {
                results.push({
                    fieldId: field.id,
                    fieldLabel: field.label,
                    matched: true,
                    rule: rule
                })
                matchedRuleIds.add(rule.id)
            } else {
                results.push({
                    fieldId: field.id,
                    fieldLabel: field.label,
                    matched: false
                })
            }
        }

        // 更新使用次数
        let updated = false
        for (const rule of rulesData.rules) {
            if (matchedRuleIds.has(rule.id)) {
                rule.usageCount = (rule.usageCount || 0) + 1
                updated = true
            }
        }
        if (updated) {
            writeRules(rulesData)
        }

        const matchedCount = results.filter(r => r.matched).length
        const unmatchedCount = results.filter(r => !r.matched).length

        console.log(`[Field Rules Match] 匹配结果: ${matchedCount} 匹配, ${unmatchedCount} 未匹配`)

        return NextResponse.json({
            total: fields.length,
            matched: matchedCount,
            unmatched: unmatchedCount,
            results: results,
            // 返回未匹配的字段列表（供 AI 处理）
            unmatchedFields: results.filter(r => !r.matched).map(r => ({
                id: r.fieldId,
                label: r.fieldLabel
            }))
        }, { headers: corsHeaders })

    } catch (error) {
        console.error('[Field Rules Match] 匹配失败:', error)
        return NextResponse.json(
            { error: '处理失败', message: String(error) },
            { status: 500, headers: corsHeaders }
        )
    }
}
