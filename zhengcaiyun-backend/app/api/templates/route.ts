import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getActorFromRequest } from "@/lib/request-actor"

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
}

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders })
}

// ========== 发布模板类型定义 ==========

export interface ZcyPublishTemplateData {
    id?: string
    name: string
    market: string                              // 电子卖场名称，如 "青海网超"
    marketCode?: string                         // 卖场代码
    categoryPath: [string, string, string]      // [一级, 二级, 三级]
    bidItemName?: string                        // 标项名称，如 "办公用品"
    keyAttrs: {
        [fieldName: string]: {
            source: 'scraped' | 'manual' | 'fixed'  // scraped=从采集数据取, manual=手动填, fixed=固定值
            scrapedField?: string                   // 采集字段名，如 'brand', 'model'
            fixedValue?: string                     // 固定值
        }
    }
    isDefault?: boolean
}

// ========== GET: 获取模板列表 ==========

export async function GET(request: NextRequest) {
    try {
        const actor = await getActorFromRequest(request)
        if (!actor) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })
        }

        const userId = actor.kind === "user" ? actor.userId : actor.userId
        if (!userId) {
            return NextResponse.json(
                { error: "License is not linked to a user", code: "LICENSE_NOT_LINKED" },
                { status: 403, headers: corsHeaders }
            )
        }

        const { searchParams } = new URL(request.url)
        const market = searchParams.get('market')

        const where: any = { userId }
        if (market) {
            where.market = market
        }

        const templates = await prisma.zcyPublishTemplate.findMany({
            where,
            orderBy: [
                { isDefault: 'desc' },
                { updatedAt: 'desc' }
            ]
        })

        // 解析JSON字段
        const result = templates.map(t => ({
            ...t,
            categoryPath: JSON.parse(t.categoryPath) as string[],
            keyAttrs: JSON.parse(t.keyAttrs)
        }))

        return NextResponse.json({ templates: result }, { headers: corsHeaders })
    } catch (error) {
        console.error("[API templates] GET Error:", error)
        return NextResponse.json(
            { error: "Failed to fetch templates", details: (error as Error).message },
            { status: 500, headers: corsHeaders }
        )
    }
}

// ========== POST: 创建/更新模板 ==========

export async function POST(request: NextRequest) {
    try {
        const actor = await getActorFromRequest(request)
        if (!actor) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })
        }

        const userId = actor.kind === "user" ? actor.userId : actor.userId
        if (!userId) {
            return NextResponse.json(
                { error: "License is not linked to a user", code: "LICENSE_NOT_LINKED" },
                { status: 403, headers: corsHeaders }
            )
        }

        const body = await request.json() as ZcyPublishTemplateData

        // 验证必填字段
        if (!body.name || !body.market || !body.categoryPath) {
            return NextResponse.json(
                { error: "Missing required fields: name, market, categoryPath" },
                { status: 400, headers: corsHeaders }
            )
        }

        // 如果设为默认，先取消其他默认
        if (body.isDefault) {
            await prisma.zcyPublishTemplate.updateMany({
                where: { userId, market: body.market, isDefault: true },
                data: { isDefault: false }
            })
        }

        const data = {
            userId,
            name: body.name,
            market: body.market,
            marketCode: body.marketCode || null,
            categoryPath: JSON.stringify(body.categoryPath),
            bidItemName: body.bidItemName || null,
            keyAttrs: JSON.stringify(body.keyAttrs || {}),
            isDefault: body.isDefault || false
        }

        // 如果有id则更新，否则创建
        let template
        if (body.id) {
            const existing = await prisma.zcyPublishTemplate.findFirst({
                where: { id: body.id, userId },
                select: { id: true }
            })
            if (!existing) {
                return NextResponse.json({ error: "Template not found" }, { status: 404, headers: corsHeaders })
            }

            template = await prisma.zcyPublishTemplate.update({
                where: { id: body.id },
                data
            })
        } else {
            // 使用 upsert 避免重复
            template = await prisma.zcyPublishTemplate.upsert({
                where: {
                    userId_name: { userId, name: body.name }
                },
                create: data,
                update: data
            })
        }

        return NextResponse.json({
            success: true,
            template: {
                ...template,
                categoryPath: JSON.parse(template.categoryPath),
                keyAttrs: JSON.parse(template.keyAttrs)
            }
        }, { headers: corsHeaders })
    } catch (error) {
        console.error("[API templates] POST Error:", error)
        return NextResponse.json(
            { error: "Failed to save template", details: (error as Error).message },
            { status: 500, headers: corsHeaders }
        )
    }
}

// ========== DELETE: 删除模板 ==========

export async function DELETE(request: NextRequest) {
    try {
        const actor = await getActorFromRequest(request)
        if (!actor) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })
        }

        const userId = actor.kind === "user" ? actor.userId : actor.userId
        if (!userId) {
            return NextResponse.json(
                { error: "License is not linked to a user", code: "LICENSE_NOT_LINKED" },
                { status: 403, headers: corsHeaders }
            )
        }

        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json(
                { error: "Missing template id" },
                { status: 400, headers: corsHeaders }
            )
        }

        const existing = await prisma.zcyPublishTemplate.findFirst({
            where: { id, userId },
            select: { id: true }
        })
        if (!existing) {
            return NextResponse.json({ error: "Template not found" }, { status: 404, headers: corsHeaders })
        }

        await prisma.zcyPublishTemplate.delete({ where: { id } })

        return NextResponse.json({ success: true }, { headers: corsHeaders })
    } catch (error) {
        console.error("[API templates] DELETE Error:", error)
        return NextResponse.json(
            { error: "Failed to delete template", details: (error as Error).message },
            { status: 500, headers: corsHeaders }
        )
    }
}
