import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Queue } from "bullmq"
import Redis from "ioredis"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

// BullMQ v4 连接 Redis 队列
const connection = new Redis({
  host: "localhost",
  port: 6379,
  maxRetriesPerRequest: null,
  retryStrategy: () => null
})
const publishQueue = new Queue("zcy-publish", { connection })
const collectQueue = new Queue("zcy-collect", { connection })

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, link, links, shopUrl, data, items } = body

    if (type === "single") {
      const safeData = data && typeof data === "object" ? data : {};
      // 单品推送：直接创建已采集草稿
      const draft = await prisma.productDraft.create({
        data: {
          userId: "test-user-001",
          title: safeData.title || "Untitled",
          originalUrl: link,
          shopName: safeData.shopName || "Unknown",
          status: "scraped",
          images: JSON.stringify(safeData.images || []),
          attributes: JSON.stringify(safeData.attributes || {}),
          skuData: JSON.stringify({
            price: safeData.price,
            images: safeData.images,
            attributes: safeData.attributes
          }),
          detailHtml: safeData.detailHtml || "",
          categoryPath: safeData.category || null
        }
      })

      return NextResponse.json({ success: true, draftId: draft.id }, { headers: corsHeaders })
    }

    if (type === "batch") {
      const rawItems: Array<{ url: string; title?: string }> = Array.isArray(items)
        ? items
        : Array.isArray(links)
          ? links.map((u: string) => ({ url: u }))
          : []

      const extractItemId = (u: string): string | null => {
        const m = u.match(/\/items\/(\d+)/)
        return m ? m[1] : null
      }

      // 去重并过滤无效链接
      const linkMap = new Map<string, { url: string; title?: string }>()
      for (const i of rawItems) {
        if (!i || typeof i.url !== "string") continue
        const urlTrim = i.url.trim()
        if (!urlTrim) continue
        const itemId = extractItemId(urlTrim)
        if (!itemId) continue // 只接受 /items/ 链接，过滤店铺/其他链接
        const key = `zcy:${itemId}`
        if (!linkMap.has(key)) {
          linkMap.set(key, { url: urlTrim, title: i.title })
        }
      }
      const linkItems = Array.from(linkMap.values())

      if (!linkItems.length) {
        return NextResponse.json({ error: "No links provided" }, { status: 400, headers: corsHeaders })
      }

      const task = await prisma.copyTask.create({
        data: {
          userId: "test-user-001",
          shopName: "批量采集",
          shopUrl: shopUrl || "",
          totalCount: linkItems.length,
          successCount: 0,
          failedCount: 0,
          status: "pending"
        }
      })

      // 查找已存在的草稿，避免重复导致 500
      const existingDrafts = await prisma.productDraft.findMany({
        where: {
          userId: "test-user-001",
          originalUrl: { in: linkItems.map((i) => i.url) }
        }
      })
      const existingMap = new Map(existingDrafts.map((d) => [d.originalUrl, d]))

      const drafts = await Promise.all(
        linkItems.map(async ({ url, title }) => {
          const itemId = extractItemId(url)
          const cleanTitle = title?.trim() || itemId || url
          const isZcy = url.includes("zcygov.cn") || url.includes("/items/")
          const initialStatus = isZcy ? "scraped" : "pending"
          const initialShop = isZcy ? "政采云" : "待采集"

          if (existingMap.has(url)) {
            const updated = await prisma.productDraft.update({
              where: { id: existingMap.get(url)!.id },
              data: {
                title: cleanTitle,
                shopName: initialShop,
                status: initialStatus,
                copyTaskId: task.id
              }
            })
            return updated
          }

          return prisma.productDraft.create({
            data: {
              userId: "test-user-001",
              title: cleanTitle,
              originalUrl: url,
              shopName: initialShop,
              status: initialStatus,
              copyTaskId: task.id,
              images: "[]",
              attributes: "{}",
              skuData: "{}",
              detailHtml: ""
            }
          })
        })
      )

      await Promise.all(
        drafts
          .filter(Boolean)
          .map((draft) =>
            collectQueue.add(
              "collect",
              { draftId: draft!.id, url: draft!.originalUrl, userId: draft!.userId },
              { jobId: `collect-${draft!.id}`, priority: 1 }
            )
          )
      )

      return NextResponse.json({ success: true, taskId: task.id, count: drafts.length }, { headers: corsHeaders })
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400, headers: corsHeaders })
  } catch (error) {
    console.error("[API push-tasks] Error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: (error as Error).message },
      { status: 500, headers: corsHeaders }
    )
  }
}
