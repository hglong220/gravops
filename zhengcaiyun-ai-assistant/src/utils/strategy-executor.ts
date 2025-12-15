/**
 * 策略执行器 - 从服务端获取策略并执行
 *
 * 注意：客户端无法真正“加密隐藏”策略（需要执行就一定可见）。
 * 这里的核心是：鉴权 + 可控下发 + 可快速迭代更新。
 */

import { fetchWithAuth } from "~src/utils/api"

// 缓存
let cachedStrategies: any = null
let cacheExpiry = 0

export async function fetchStrategy(platform?: string): Promise<any> {
  if (cachedStrategies && Date.now() < cacheExpiry) {
    return platform ? cachedStrategies[platform] || null : cachedStrategies
  }

  const response = await fetchWithAuth("/api/plugin/strategy", {
    method: "POST",
    body: JSON.stringify({ platform, action: platform ? undefined : "all" })
  })

  if (!response.ok) {
    console.error("[Executor] Failed to fetch strategy:", response.status)
    return null
  }

  const data = await response.json().catch(() => null)
  const payload = data?.data
  if (!payload?.strategy) return null

  cachedStrategies = payload.strategy
  cacheExpiry = Date.now() + (payload.expiresIn || 3600000)

  return platform ? cachedStrategies[platform] || null : cachedStrategies
}

export function detectPlatform(url: string): string | null {
  if (url.includes("item.jd.com") || url.includes("item.m.jd.com")) return "jd"
  if (url.includes("detail.tmall.com") || url.includes("chaoshi.detail.tmall.com"))
    return "tmall"
  if (url.includes("product.suning.com") || url.includes("item.suning.com"))
    return "suning"
  if (url.includes("zcygov.cn")) return "zcy"
  return null
}

export async function executeScript(scriptCode: string): Promise<any> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(
        { action: "executeStrategy", scriptCode: `(function() { ${scriptCode} })()` },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("[Executor] Message error:", chrome.runtime.lastError)
            resolve(null)
          } else if (response?.success) {
            resolve(response.data)
          } else {
            console.error("[Executor] Execution error:", response?.error)
            resolve(null)
          }
        }
      )
    } catch (error) {
      console.error("[Executor] Script execution failed:", error)
      resolve(null)
    }
  })
}

export async function scrapeWithStrategy(strategy: any): Promise<any> {
  const result: any = {
    platform: strategy.platform,
    timestamp: Date.now()
  }

  try {
    if (strategy.scripts) {
      if (strategy.scripts.getTitle) result.title = await executeScript(strategy.scripts.getTitle)
      if (strategy.scripts.getPrice) result.price = await executeScript(strategy.scripts.getPrice)
      if (strategy.scripts.getImages) result.images = await executeScript(strategy.scripts.getImages)
      if (strategy.scripts.getParams) result.params = await executeScript(strategy.scripts.getParams)
      if (strategy.scripts.getDetailImages)
        result.detailImages = await executeScript(strategy.scripts.getDetailImages)
    }

    return result
  } catch (error) {
    console.error("[Executor] Scrape failed:", error)
    return null
  }
}

export async function autoScrape(): Promise<any> {
  const url = window.location.href
  const platform = detectPlatform(url)
  if (!platform) return null

  const strategy = await fetchStrategy(platform)
  if (!strategy) return null

  return await scrapeWithStrategy(strategy)
}

export function clearCache() {
  cachedStrategies = null
  cacheExpiry = 0
}

