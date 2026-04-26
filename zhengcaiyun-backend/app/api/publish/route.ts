import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getActorFromRequest } from "@/lib/request-actor"

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
}

function isLikelyJdSku(value: string | null | undefined): boolean {
    return /^\d{8,}$/.test(String(value || '').trim())
}

function extractModelToken(text: string | null | undefined): string {
    const value = String(text || '').trim()
    if (!value) return ''
    const tokens = value.match(/[A-Za-z]{1,}[A-Za-z0-9-]{2,}\d[A-Za-z0-9-]*/g) || []
    return tokens.find(token => !isLikelyJdSku(token)) || ''
}

function resolvePublishModel(
    title: string,
    storedModel: string | null | undefined,
    attributes: Record<string, any>,
    skuData: any
): string {
    const candidates = [
        attributes?.['认证型号'],
        attributes?.['型号'],
        attributes?.['商品型号'],
        attributes?.['货号'],
        extractModelToken(attributes?.['国补备案型号']),
        extractModelToken(skuData?.selectedSaleSpecs?.[0]?.value),
        extractModelToken(skuData?.specGroups?.[0]?.selected),
        !isLikelyJdSku(storedModel) ? storedModel : '',
        !isLikelyJdSku(skuData?.model) ? skuData?.model : '',
        extractModelToken(title)
    ]

    return String(candidates.find(value => value && !isLikelyJdSku(String(value))) || '').trim()
}

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders })
}

// ========== POST: 触发发布 ==========
// 前端任务中心点击"发布"按钮时调用
// 返回完整的发布数据：模板 + 商品信息，供插件使用

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

        const body = await request.json()
        const { draftId, templateId } = body

        if (!draftId) {
            return NextResponse.json(
                { error: "Missing draftId" },
                { status: 400, headers: corsHeaders }
            )
        }

        // 1. 获取草稿信息
        const draft = await prisma.productDraft.findFirst({
            where: { id: draftId, userId }
        })

        if (!draft) {
            return NextResponse.json(
                { error: "Draft not found" },
                { status: 404, headers: corsHeaders }
            )
        }

        // 2. 获取模板（优先使用传入的templateId，其次使用draft关联的，最后使用默认模板）
        let template = null

        if (templateId) {
            template = await prisma.zcyPublishTemplate.findFirst({
                where: { id: templateId, userId }
            })
        } else if (draft.templateId) {
            template = await prisma.zcyPublishTemplate.findFirst({
                where: { id: draft.templateId, userId }
            })
        } else {
            // 查找默认模板
            template = await prisma.zcyPublishTemplate.findFirst({
                where: {
                    userId,
                    isDefault: true
                }
            })
        }

        // 3. 解析草稿中的JSON字段
        const images = safeJsonParse(draft.images, [])
        const attributes = safeJsonParse(draft.attributes, {})
        const skuData = safeJsonParse(draft.skuData, {})
        const draftCategoryPath = parseCategoryPath(draft.categoryPath)
        const publishModel = resolvePublishModel(draft.title, draft.model, attributes, skuData)

        // 4. 构造发布数据
        const publishData = {
            type: "ZCY_PUBLISH",
            draftId: draft.id,
            // 政采云发布页URL（类目选择页）
            zcyUrl: `https://www.zcygov.cn/goods-center/goods/category/attr/select?draft_id=${draft.id}`,
            // 模板信息
            template: template ? {
                id: template.id,
                name: template.name,
                market: template.market,
                marketCode: template.marketCode,
                categoryPath: safeJsonParse(template.categoryPath, []),
                bidItemName: template.bidItemName,
                keyAttrs: safeJsonParse(template.keyAttrs, {})
            } : null,
            // 商品信息
            product: {
                title: draft.title,
                brand: draft.brand || '',
                model: publishModel || '',
                price: draft.price || 0,
                stock: draft.stock || 99,
                images,
                attributes,
                skuData,
                detailHtml: draft.detailHtml || '',
                detailImages: safeJsonParse(draft.detailImages, []),
                categoryPath: draftCategoryPath,
                originalUrl: draft.originalUrl,
                shopName: draft.shopName
            }
        }

        // 5. 更新草稿状态为"发布中"
        await prisma.productDraft.update({
            where: { id: draftId },
            data: { status: 'publishing' }
        })

        return NextResponse.json({
            success: true,
            publishData,
            message: template
                ? `使用模板"${template.name}"发布`
                : "未找到模板，请手动选择类目"
        }, { headers: corsHeaders })

    } catch (error) {
        console.error("[API publish] POST Error:", error)
        return NextResponse.json(
            { error: "Failed to prepare publish data", details: (error as Error).message },
            { status: 500, headers: corsHeaders }
        )
    }
}

// 安全的JSON解析
function safeJsonParse(str: string | null | undefined, defaultValue: any): any {
    if (!str) return defaultValue
    try {
        return JSON.parse(str)
    } catch {
        return defaultValue
    }
}

function parseCategoryPath(value: string | null | undefined): string[] {
    if (!value) return []
    try {
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
        if (typeof parsed === "string") {
            return splitCategoryPath(parsed)
        }
    } catch {
        return splitCategoryPath(value)
    }
    return []
}

function splitCategoryPath(value: string): string[] {
    const normalized = value.trim()
    if (!normalized) return []
    if (normalized.includes(">")) {
        return normalized.split(">").map(s => s.trim()).filter(Boolean)
    }

    const level1WithSlash = [
        "办公设备/耗材",
        "五金/工具"
    ]
    for (const level1 of level1WithSlash) {
        if (normalized === level1) return [level1]
        if (normalized.startsWith(`${level1}/`)) {
            return [
                level1,
                ...normalized.slice(level1.length + 1).split("/").map(s => s.trim()).filter(Boolean)
            ]
        }
    }

    return normalized.split(",").map(s => s.trim()).filter(Boolean)
}
