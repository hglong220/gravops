import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { getActorFromRequest } from '@/lib/request-actor'
import { detectPlatform, normalizeUrl } from '@/lib/url-detector'
import { scrapeJDProduct } from '@/lib/scrapers/jd-product-scraper'
import { scrapeSuningProduct } from '@/lib/scrapers/suning-scraper'
import { scrapeTaobaoProduct } from '@/lib/scrapers/taobao-scraper'
import { scrapeTmallProduct } from '@/lib/scrapers/tmall-scraper'
import { enforceRateLimit, getClientIp } from '@/lib/rate-limit'
import { withScrapeLock } from '@/lib/scrape-lock'
import { filterImageUrlsForUpload } from '@/lib/image-url-filter'

export const dynamic = 'force-dynamic'

/**
 * POST /api/plugin/copy
 * 插件只上传 URL，核心采集逻辑在服务端完成
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await getActorFromRequest(request)
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = actor.kind === 'user' ? actor.userId : actor.userId
    if (!userId) {
      return NextResponse.json(
        { error: 'License is not linked to a user', code: 'LICENSE_NOT_LINKED' },
        { status: 403 }
      )
    }

    const ip = getClientIp(request)
    const rlMax = process.env.RATE_LIMIT_PLUGIN_COPY_MAX
      ? parseInt(process.env.RATE_LIMIT_PLUGIN_COPY_MAX, 10)
      : 30
    const rlWindowMs = process.env.RATE_LIMIT_PLUGIN_COPY_WINDOW_MS
      ? parseInt(process.env.RATE_LIMIT_PLUGIN_COPY_WINDOW_MS, 10)
      : 60_000

    const rateLimited = await enforceRateLimit(request, {
      prefix: 'plugin_copy',
      id: `${userId}:${ip}`,
      max: Number.isFinite(rlMax) ? rlMax : 30,
      windowMs: Number.isFinite(rlWindowMs) ? rlWindowMs : 60_000
    })
    if (rateLimited) return rateLimited

    const body = (await request.json().catch(() => ({}))) as any
    const rawUrl = (typeof body?.url === 'string' && body.url) || (typeof body?.originalUrl === 'string' && body.originalUrl) || ''
    const trimmed = rawUrl.trim()
    if (!trimmed) {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 })
    }

    const hint = body?.hint && typeof body.hint === 'object' ? (body.hint as any) : null

    const url = normalizeUrl(trimmed)
    const platform = detectPlatform(url)
    if (platform === 'unknown') {
      return NextResponse.json({ error: 'Unsupported url' }, { status: 400 })
    }

    if (platform === 'zcy') {
      return NextResponse.json({ error: 'ZCY link should be collected via ZCY scraper' }, { status: 400 })
    }

    const existing = await prisma.productDraft.findFirst({
      where: { userId, originalUrl: url }
    })

    let productData: any
    try {
      productData = await withScrapeLock(async () => {
        if (platform === 'jd') {
          return scrapeJDProduct(url)
        }
        if (platform === 'tmall') {
          return scrapeTmallProduct(url)
        }
        if (platform === 'taobao') {
          return scrapeTaobaoProduct(url)
        }
        if (platform === 'suning') {
          return scrapeSuningProduct(url)
        }

        throw new Error('Unsupported platform')
      })
    } catch (err) {
      if ((err as Error)?.message === 'SCRAPE_BUSY') {
        return NextResponse.json(
          { error: 'Server busy, please retry later' },
          { status: 503 }
        )
      }
      throw err
    }

    // Merge optional client hints (minimal fields from user's browser) when server scrape is incomplete.
    const hintPriceRaw = typeof hint?.price === 'string' ? hint.price.trim() : ''
    const hintPrice = hintPriceRaw ? hintPriceRaw.replace(/[^\d.]/g, '').trim() : ''

    const hintImages = Array.isArray(hint?.images)
      ? (hint.images as any[])
          .filter((x) => typeof x === 'string')
          .map((x) => x.trim())
          .filter(Boolean)
      : []

    const hintDetailImages = Array.isArray(hint?.detailImages)
      ? (hint.detailImages as any[])
          .filter((x) => typeof x === 'string')
          .map((x) => x.trim())
          .filter(Boolean)
      : []

    const hintAttributes =
      hint?.attributes && typeof hint.attributes === 'object' && !Array.isArray(hint.attributes)
        ? (hint.attributes as Record<string, any>)
        : null

    const hintBrand = typeof hint?.brand === 'string' ? hint.brand.trim() : ''
    const hintModel = typeof hint?.model === 'string' ? hint.model.trim() : ''
    const hintSkuId = typeof hint?.skuId === 'string' ? hint.skuId.trim() : ''

    const hintSpecGroups = Array.isArray(hint?.specGroups)
      ? (hint.specGroups as any[]).filter(Boolean)
      : []

    const scrapedImages = Array.isArray(productData?.images) ? productData.images : []
    let mergedImages = Array.from(new Set([...scrapedImages, ...hintImages])).filter(Boolean).slice(0, 10)

    let mergedDetailImages = Array.from(new Set([...hintDetailImages])).filter(Boolean).slice(0, 60)

    // JD 图片里容易混入图标/表情等无用图，并且部分尺寸不足；在服务端做一次筛选与清理。
    if (platform === 'jd') {
      ;[mergedImages, mergedDetailImages] = await Promise.all([
        filterImageUrlsForUpload(mergedImages, {
          platform,
          kind: 'main',
          minSize: 900,
          maxCount: 10,
          targetSize: 900
        }),
        filterImageUrlsForUpload(mergedDetailImages, {
          platform,
          kind: 'detail',
          minSize: 900,
          maxCount: 60,
          targetSize: 900
        })
      ])
    }

    const scrapedPrice =
      (typeof productData?.price === 'string' && productData.price.trim()) ||
      (typeof productData?.skuData?.price === 'string' && productData.skuData.price.trim()) ||
      ''

    const finalPrice = scrapedPrice && scrapedPrice !== '0' ? scrapedPrice : hintPrice || scrapedPrice || '0'

    const scrapedAttrs =
      productData?.attributes && typeof productData.attributes === 'object' && !Array.isArray(productData.attributes)
        ? productData.attributes
        : {}

    const finalAttributes =
      Object.keys(scrapedAttrs).length > 0
        ? scrapedAttrs
        : hintAttributes
          ? Object.fromEntries(
              Object.entries(hintAttributes)
                .map(([k, v]) => [String(k || '').trim(), String(v ?? '').trim()])
                .filter(([k, v]) => k && v)
            )
          : scrapedAttrs

    const deriveFromAttrs = (keys: string[]) => {
      for (const k of keys) {
        const v = (finalAttributes as any)?.[k]
        if (typeof v === 'string' && v.trim()) return v.trim()
      }
      return ''
    }

    const finalBrand = hintBrand || deriveFromAttrs(['品牌', '品牌名称'])
    const finalModel = hintModel || deriveFromAttrs(['型号', '产品型号', '规格型号', '商品型号'])

    const skuData = (() => {
      const base = productData?.skuData && typeof productData.skuData === 'object' ? { ...productData.skuData } : {}
      return {
        ...base,
        skuId: (base as any).skuId ?? (hintSkuId || undefined),
        price: finalPrice || base.price || '0',
        defaultPrice: (base as any).defaultPrice ?? (finalPrice || undefined),
        stock: base.stock ?? 99,
        specs: base.specs ?? finalAttributes,
        specGroups:
          Array.isArray((base as any).specGroups) && (base as any).specGroups.length > 0
            ? (base as any).specGroups
            : hintSpecGroups
      }
    })()

    const priceNumber =
      typeof skuData.price === 'string' && skuData.price.trim() ? Number.parseFloat(skuData.price) : undefined
    const stockNumber =
      typeof skuData.stock === 'string' ? Number.parseInt(skuData.stock, 10) : Number(skuData.stock ?? 99)

    const draftData = {
      title: productData.title,
      originalId: hintSkuId || undefined,
      brand: finalBrand || null,
      model: finalModel || null,
      images: JSON.stringify(mergedImages),
      detailImages: JSON.stringify(mergedDetailImages),
      attributes: JSON.stringify(finalAttributes || {}),
      // 电商站点的 raw HTML 对政采云发布无效且可能包含脚本，避免落库造成误导
      detailHtml: '',
      skuData: JSON.stringify(skuData || {}),
      shopName: productData.shopName || platform,
      status: 'scraped',
      price: Number.isFinite(priceNumber as any) ? (priceNumber as number) : undefined,
      stock: Number.isFinite(stockNumber as any) ? (stockNumber as number) : 99
    }

    const draft = existing
      ? await prisma.productDraft.update({
          where: { id: existing.id },
          data: draftData
        })
      : await prisma.productDraft.create({
          data: {
            userId,
            originalUrl: url,
            ...draftData
          }
        })

    return NextResponse.json({ success: true, draft })
  } catch (error) {
    console.error('[API /plugin/copy] Error:', error)
    return NextResponse.json(
      { error: 'Copy failed', details: (error as Error).message },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}
