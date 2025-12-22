import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Queue } from "bullmq"
import Redis from "ioredis"
import { getActorFromRequest } from "@/lib/request-actor"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

// BullMQ v4 连接 Redis 队列
// 懒加载：避免构建期/未配置 Redis 时直接连接
// 优雅降级：Redis 不可用时返回 null，跳过队列
let queues: { publishQueue: Queue; collectQueue: Queue } | null = null
let queuesInitialized = false

function getQueues(): { publishQueue: Queue; collectQueue: Queue } | null {
  if (queuesInitialized) return queues

  try {
    const redisUrl = process.env.REDIS_URL
    const redisHost = process.env.REDIS_HOST || "localhost"
    const redisPort = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379

    const connection = redisUrl
      ? new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        retryStrategy: () => null,
        lazyConnect: true,
        connectTimeout: 3000
      })
      : new Redis({
        host: redisHost,
        port: redisPort,
        maxRetriesPerRequest: null,
        retryStrategy: () => null,
        lazyConnect: true,
        connectTimeout: 3000
      })

    queues = {
      publishQueue: new Queue("zcy-publish", { connection }),
      collectQueue: new Queue("zcy-collect", { connection })
    }
    queuesInitialized = true
    console.log("[push-tasks] Redis 队列初始化成功")
    return queues
  } catch (error) {
    console.warn("[push-tasks] Redis 不可用，队列功能已禁用:", (error as Error).message)
    queuesInitialized = true
    queues = null
    return null
  }
}

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
    const { type, link, links, shopUrl, data, items } = body

    if (type === "single") {
      const safeData = data && typeof data === "object" ? data : {};

      // 构建skuData：优先使用采集到的完整skuData，否则使用基本信息
      const skuDataPayload = safeData.skuData && safeData.skuData.specGroups
        ? {
          ...safeData.skuData,
          price: safeData.price,
          stock: 99
        }
        : {
          price: safeData.price,
          stock: 99,
          images: safeData.images,
          attributes: safeData.attributes,
          specGroups: [],
          skuPrices: []
        };

      // 单品推送：直接创建已采集草稿
      const draft = await prisma.productDraft.create({
        data: {
          userId,
          title: safeData.title || "Untitled",
          originalUrl: link,
          shopName: safeData.shopName || "Unknown",
          status: "scraped",
          images: JSON.stringify(safeData.images || []),
          attributes: JSON.stringify(safeData.attributes || {}),
          brand: safeData.brand || "",
          model: safeData.model || "",
          skuData: JSON.stringify(skuDataPayload),
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
          userId,
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
          userId,
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
              userId,
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

      // 尝试加入后台处理队列（Redis 可用时）
      const queueResult = getQueues()
      if (queueResult?.collectQueue) {
        try {
          await Promise.all(
            drafts
              .filter(Boolean)
              .map((draft) =>
                queueResult.collectQueue.add(
                  "collect",
                  { draftId: draft!.id, url: draft!.originalUrl, userId: draft!.userId },
                  { jobId: `collect-${draft!.id}`, priority: 1 }
                )
              )
          )
          console.log(`[push-tasks] ${drafts.length} 个任务已加入队列`)
        } catch (queueError) {
          console.warn("[push-tasks] 加入队列失败，跳过:", (queueError as Error).message)
        }
      } else {
        console.log(`[push-tasks] Redis 不可用，${drafts.length} 个草稿已创建（无队列处理）`)
      }

      return NextResponse.json({ success: true, taskId: task.id, count: drafts.length }, { headers: corsHeaders })
    }


    // 批量完整数据：插件已采集完整信息，直接创建草稿
    if (type === "batch-full") {
      const fullItems: Array<{
        url: string;
        title: string;
        images: string[];
        detailImages: string[];
        attributes: Record<string, string>;
        price: string;
        brand: string;
        model: string;
      }> = Array.isArray(items) ? items : []

      if (!fullItems.length) {
        return NextResponse.json({ error: "No items provided" }, { status: 400, headers: corsHeaders })
      }

      const task = await prisma.copyTask.create({
        data: {
          userId,
          shopName: "政采云整店采集",
          shopUrl: shopUrl || "",
          totalCount: fullItems.length,
          successCount: fullItems.length,
          failedCount: 0,
          status: "completed"
        }
      })

      // 批量创建草稿（包含完整数据）
      const drafts = await Promise.all(
        fullItems.map(async (item) => {
          const skuData = {
            price: item.price || "",
            stock: 99,
            images: item.images || [],
            attributes: item.attributes || {},
            specGroups: [],
            skuPrices: []
          }

          return prisma.productDraft.create({
            data: {
              userId,
              title: item.title || "未知商品",
              originalUrl: item.url,
              shopName: "政采云",
              status: "scraped",
              copyTaskId: task.id,
              images: JSON.stringify(item.images || []),
              detailImages: JSON.stringify(item.detailImages || []),
              attributes: JSON.stringify(item.attributes || {}),
              brand: item.brand || "",
              model: item.model || "",
              price: item.price ? parseFloat(item.price) : undefined,
              skuData: JSON.stringify(skuData),
              detailHtml: ""
            }
          })
        })
      )

      console.log(`[push-tasks] batch-full: 创建 ${drafts.length} 个完整草稿`)
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
