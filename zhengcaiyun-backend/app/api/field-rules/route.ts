/**
 * Field Rules API
 * 
 * 字段填写规则管理 API
 * - GET: 获取所有规则
 * - POST: 新增规则
 */

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// 规则文件路径
const RULES_FILE = path.join(process.cwd(), 'data', 'field-rules.json')

interface FieldRule {
    id: string
    label: string
    controlType: string
    action: 'input' | 'select' | 'skip'
    value: string
    alternatives?: string[]
    priority: number
    source: 'manual' | 'ai'
    category?: string
    note?: string
    createdAt: string
    usageCount: number
}

interface RulesData {
    version: string
    updatedAt: string
    rules: FieldRule[]
}

// CORS 头
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// 读取规则文件
function readRules(): RulesData {
    try {
        const data = fs.readFileSync(RULES_FILE, 'utf-8')
        return JSON.parse(data)
    } catch (error) {
        console.error('[Field Rules] 读取规则文件失败:', error)
        return { version: '1.0.0', updatedAt: new Date().toISOString().split('T')[0], rules: [] }
    }
}

// 写入规则文件
function writeRules(data: RulesData): boolean {
    try {
        data.updatedAt = new Date().toISOString().split('T')[0]
        fs.writeFileSync(RULES_FILE, JSON.stringify(data, null, 2), 'utf-8')
        return true
    } catch (error) {
        console.error('[Field Rules] 写入规则文件失败:', error)
        return false
    }
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: corsHeaders })
}

// GET: 获取所有规则
export async function GET() {
    const data = readRules()
    return NextResponse.json(data, { headers: corsHeaders })
}

// POST: 新增规则
export async function POST(request: NextRequest) {
    try {
        const newRule = await request.json() as Partial<FieldRule>

        if (!newRule.label) {
            return NextResponse.json(
                { error: '缺少字段标签 (label)' },
                { status: 400, headers: corsHeaders }
            )
        }

        const data = readRules()

        // 检查是否已存在相同标签的规则
        const existingIndex = data.rules.findIndex(r => r.label === newRule.label)

        const rule: FieldRule = {
            id: existingIndex >= 0 ? data.rules[existingIndex].id : `rule_${Date.now()}`,
            label: newRule.label,
            controlType: newRule.controlType || 'input',
            action: newRule.action || 'input',
            value: newRule.value || '',
            alternatives: newRule.alternatives || [],
            priority: newRule.priority || 50,
            source: newRule.source || 'ai',
            category: newRule.category || '未分类',
            note: newRule.note,
            createdAt: existingIndex >= 0 ? data.rules[existingIndex].createdAt : new Date().toISOString().split('T')[0],
            usageCount: existingIndex >= 0 ? data.rules[existingIndex].usageCount : 0
        }

        if (existingIndex >= 0) {
            // 更新现有规则
            data.rules[existingIndex] = rule
            console.log('[Field Rules] 更新规则:', rule.label)
        } else {
            // 新增规则
            data.rules.push(rule)
            console.log('[Field Rules] 新增规则:', rule.label)
        }

        const success = writeRules(data)
        if (!success) {
            return NextResponse.json(
                { error: '保存规则失败' },
                { status: 500, headers: corsHeaders }
            )
        }

        return NextResponse.json(
            { success: true, rule, isNew: existingIndex < 0 },
            { headers: corsHeaders }
        )

    } catch (error) {
        console.error('[Field Rules] 新增规则失败:', error)
        return NextResponse.json(
            { error: '处理失败', message: String(error) },
            { status: 500, headers: corsHeaders }
        )
    }
}
