/**
 * Field Rule Detail API
 * 
 * 单个规则的管理
 * - GET: 获取单个规则
 * - PUT: 更新规则
 * - DELETE: 删除规则
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
        console.error('[Field Rule] 读取规则文件失败:', error)
        return { version: '1.0.0', updatedAt: '', rules: [] }
    }
}

// 写入规则文件
function writeRules(data: RulesData): boolean {
    try {
        data.updatedAt = new Date().toISOString().split('T')[0]
        fs.writeFileSync(RULES_FILE, JSON.stringify(data, null, 2), 'utf-8')
        return true
    } catch (error) {
        console.error('[Field Rule] 写入规则文件失败:', error)
        return false
    }
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: corsHeaders })
}

// GET: 获取单个规则
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const { id } = params
    const data = readRules()
    const rule = data.rules.find(r => r.id === id)

    if (!rule) {
        return NextResponse.json(
            { error: '规则不存在' },
            { status: 404, headers: corsHeaders }
        )
    }

    return NextResponse.json(rule, { headers: corsHeaders })
}

// PUT: 更新规则
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params
        const updates = await request.json() as Partial<FieldRule>

        const data = readRules()
        const index = data.rules.findIndex(r => r.id === id)

        if (index < 0) {
            return NextResponse.json(
                { error: '规则不存在' },
                { status: 404, headers: corsHeaders }
            )
        }

        // 更新规则
        const existingRule = data.rules[index]
        const updatedRule: FieldRule = {
            ...existingRule,
            ...updates,
            id: existingRule.id, // ID 不可修改
            createdAt: existingRule.createdAt, // 创建时间不可修改
        }

        data.rules[index] = updatedRule

        const success = writeRules(data)
        if (!success) {
            return NextResponse.json(
                { error: '保存规则失败' },
                { status: 500, headers: corsHeaders }
            )
        }

        console.log('[Field Rule] 更新规则:', updatedRule.label)

        return NextResponse.json(
            { success: true, rule: updatedRule },
            { headers: corsHeaders }
        )

    } catch (error) {
        console.error('[Field Rule] 更新失败:', error)
        return NextResponse.json(
            { error: '处理失败', message: String(error) },
            { status: 500, headers: corsHeaders }
        )
    }
}

// DELETE: 删除规则
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params

        const data = readRules()
        const index = data.rules.findIndex(r => r.id === id)

        if (index < 0) {
            return NextResponse.json(
                { error: '规则不存在' },
                { status: 404, headers: corsHeaders }
            )
        }

        const deletedRule = data.rules[index]
        data.rules.splice(index, 1)

        const success = writeRules(data)
        if (!success) {
            return NextResponse.json(
                { error: '删除规则失败' },
                { status: 500, headers: corsHeaders }
            )
        }

        console.log('[Field Rule] 删除规则:', deletedRule.label)

        return NextResponse.json(
            { success: true, deleted: deletedRule },
            { headers: corsHeaders }
        )

    } catch (error) {
        console.error('[Field Rule] 删除失败:', error)
        return NextResponse.json(
            { error: '处理失败', message: String(error) },
            { status: 500, headers: corsHeaders }
        )
    }
}
