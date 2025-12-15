/**
 * ZCY Publisher - 旗舰 MAX 版
 * 
 * 🚀 唯一执行引擎：FlagshipMax
 * ❌ 不再调用任何 V5/V6/FINAL/SUPER 旧版本
 */

import type { PlasmoCSConfig } from "plasmo"
import { getStoredLicense } from "~src/utils/license"
import { getApiConfig } from "~src/utils/api"
import { apiProxy } from "~src/utils/api-proxy"

// ⭐⭐⭐ 旗舰 MAX 引擎（唯一入口）⭐⭐⭐
import { FlagshipMax, type TaskContext, type ScrapedData } from "~src/rpa/flagship-max"

  /************************************************************
   * 注入旗舰 MAX 到 window（调试用）
   ************************************************************/
  ; (window as any).FlagshipMax = FlagshipMax
console.warn("🚀 已启用 RPA 旗舰 MAX 引擎（唯一版本）")

export const config: PlasmoCSConfig = {
  matches: ["https://*.zcygov.cn/*"],
  run_at: "document_end"
}

type PluginSessionResponse = { valid: boolean; token?: string }

// ========== 页面类型检测 ==========

function getPageType(): 'category' | 'publish' | 'other' {
  const url = location.href
  if (url.includes('/goods/category/attr/select') || url.includes('/goods/select/category')) {
    return 'category'
  }
  if (url.includes('/goods/publish') || url.includes('/goods/edit')) {
    return 'publish'
  }
  return 'other'
}

// ========== UI 状态显示 ==========

function showStatus(title: string, message: string, subtext?: string) {
  console.log(`[旗舰MAX] ${title}: ${message}`, subtext || '')
}

function showError(message: string) {
  console.error(`[旗舰MAX] 错误: ${message}`)
  alert(`[旗舰MAX] ${message}`)
}

// ========== 获取草稿 ==========

async function getOrCreateDeviceId(): Promise<string> {
  const result = await chrome.storage.local.get(["deviceId"])
  if (result.deviceId) return result.deviceId as string

  const newDeviceId = `device-${Date.now()}-${Math.random()
    .toString(36)
    .substring(2)}`
  await chrome.storage.local.set({ deviceId: newDeviceId })
  return newDeviceId
}

async function refreshPluginToken(baseUrl: string): Promise<string | null> {
  const stored = await getStoredLicense()
  if (!stored) return null

  const deviceId = await getOrCreateDeviceId()

  const resp = await apiProxy<PluginSessionResponse>(`${baseUrl}/api/plugin/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: {
      licenseKey: stored.licenseKey,
      companyName: stored.companyName,
      deviceId
    }
  })

  if (!resp.ok) return null
  const token = resp.data?.token
  if (!resp.data?.valid || !token) return null

  await chrome.storage.local.set({ token })
  return token
}

async function fetchDraft(draftId: string): Promise<any> {
  try {
    const { baseUrl, token: existingToken } = await getApiConfig()
    let token = existingToken || undefined

    if (!token) {
      token = (await refreshPluginToken(baseUrl)) || undefined
    }

    if (!token) {
      console.error("[旗舰MAX] Missing plugin token, please activate license first")
      return null
    }

    // 通过 Background Script 代理请求，绕过 Mixed Content 限制
    // 因为 Content Script 运行在 HTTPS 页面，无法直接访问 HTTP localhost
    const url = `${baseUrl}/api/copy/drafts/${draftId}`
    console.log("[旗舰MAX] 获取草稿:", url)

    let response = await apiProxy<any>(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` }
    })

    if (response.status === 401) {
      const refreshed = await refreshPluginToken(baseUrl)
      if (refreshed) {
        response = await apiProxy<any>(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${refreshed}` }
        })
      }
    }

    if (!response.ok) {
      console.error("[旗舰MAX] 草稿API返回:", response.status, response.error)
      return null
    }

    return response.data
  } catch (e) {
    console.error('[旗舰MAX] 获取草稿失败:', e)
    return null
  }
}

// ========== 类目页面处理 ==========

async function handleCategoryPage(draftId: string) {
  console.log('[旗舰MAX] 处理类目选择页面, draftId:', draftId)

  showStatus('旗舰MAX', '正在获取草稿信息...')

  // 1. 获取草稿
  const draft = await fetchDraft(draftId)
  if (!draft) {
    showError('草稿获取失败')
    return
  }

  console.log('[旗舰MAX] 草稿:', draft.title)
  showStatus('旗舰MAX', '正在调用 AI 分析...', `商品: ${draft.title.substring(0, 30)}...`)

  // 2. 获取 License
  const storedLicense = await getStoredLicense()
  const licenseKey = storedLicense?.licenseKey || ''

  if (!licenseKey) {
    showError('请先在插件中激活 License')
    return
  }

  console.log('[旗舰MAX] 使用 License:', licenseKey.substring(0, 8) + '...')

  // 3. 调用 AI 分析
  let aiResult
  try {
    const { baseUrl, token } = await getApiConfig()
    const resp = await apiProxy<any>(`${baseUrl}/api/category-match`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: {
        licenseKey,
        productTitle: draft.title,
        mode: "full"
      }
    })

    aiResult = resp.data

    if (!resp.ok) {
      showError((aiResult as any)?.error || resp.error || `AI 匹配失败 (${resp.status})`)
      return
    }
  } catch (e) {
    showError('AI 服务连接失败')
    return
  }

  if (!aiResult.success) {
    showError(aiResult.error || 'AI 匹配失败')
    console.error('[旗舰MAX] AI 匹配失败:', aiResult)
    return
  }

  const { categoryPath, brand, model, bid, suggestedLevel1 } = aiResult.data

  if (!categoryPath || categoryPath.length === 0) {
    showError('类目路径不完整')
    return
  }

  console.log('[旗舰MAX] AI 返回:', {
    categoryPath: categoryPath.join(' > '),
    brand,
    model,
    bid
  })

  showStatus('旗舰MAX', '开始执行 RPA...', categoryPath.join(' > '))

  // 4. 准备采集数据
  const specs = draft.attributes || {}
  const price = draft.price ? parseFloat(draft.price) : undefined

  // ⭐ 品牌清洗：优先使用 specs 中的品牌
  let finalBrand = ''
  if (specs && specs['品牌']) {
    finalBrand = specs['品牌']
    console.log('[旗舰MAX] 📌 从 specs 获取品牌:', finalBrand)
  } else if (brand && brand.length <= 10) {
    finalBrand = brand
    console.log('[旗舰MAX] 📌 从 AI 获取品牌:', finalBrand)
  }

  // ⭐ 型号清洗：优先使用 specs 中的型号
  let finalModel = ''
  if (specs && (specs['型号'] || specs['商品型号'])) {
    finalModel = specs['型号'] || specs['商品型号']
    console.log('[旗舰MAX] 📌 从 specs 获取型号:', finalModel)
  } else if (model) {
    finalModel = model
    console.log('[旗舰MAX] 📌 从 AI 获取型号:', finalModel)
  }

  // 5. 构造 TaskContext
  const scraped: ScrapedData = {
    title: draft.title,
    brand: finalBrand,
    model: finalModel,
    stock: draft.stock || 999,
    price: price,
    specs: specs,
    categoryPath: categoryPath,
    categoryName: categoryPath[categoryPath.length - 1],
    sourceUrl: draft.originalUrl,
    images: draft.images || []
  }

  const ctx: TaskContext = {
    draftId: draftId,
    pageUrl: location.href,
    scraped: scraped,
    licenseKey: licenseKey
  }

  console.log('[旗舰MAX] 构造 TaskContext:', {
    title: scraped.title,
    brand: scraped.brand,
    model: scraped.model,
    categoryPath: scraped.categoryPath?.join(' > ')
  })

  // 6. ⭐⭐⭐ 调用旗舰 MAX 引擎 ⭐⭐⭐
  try {
    await FlagshipMax.run(ctx)
    showStatus('旗舰MAX', '执行完成', categoryPath.join(' > '))
  } catch (e) {
    console.error('[旗舰MAX] 执行异常:', e)
    showError(`执行异常: ${e}`)
  }
}

// ========== 发布页面处理 ==========

async function handlePublishPage(draftId: string) {
  console.log('[旗舰MAX] 处理发布页面, draftId:', draftId)

  showStatus('旗舰MAX', '正在获取草稿信息...')

  const draft = await fetchDraft(draftId)
  if (!draft) {
    showError('草稿获取失败')
    return
  }

  const storedLicense = await getStoredLicense()
  const licenseKey = storedLicense?.licenseKey || ''

  const specs = draft.attributes || {}

  const scraped: ScrapedData = {
    title: draft.title,
    brand: specs['品牌'] || draft.brand,
    model: specs['型号'] || draft.model,
    stock: draft.stock || 999,
    price: draft.price ? parseFloat(draft.price) : undefined,
    specs: specs,
    sourceUrl: draft.originalUrl,
    images: draft.images || []
  }

  const ctx: TaskContext = {
    draftId: draftId,
    pageUrl: location.href,
    scraped: scraped,
    licenseKey: licenseKey
  }

  try {
    await FlagshipMax.run(ctx)
    showStatus('旗舰MAX', '发布页填写完成')
  } catch (e) {
    console.error('[旗舰MAX] 执行异常:', e)
    showError(`执行异常: ${e}`)
  }
}

// ========== 主入口 ==========

async function main() {
  const url = location.href
  const pageType = getPageType()

  console.log('[旗舰MAX] 页面类型:', pageType, '| URL:', url)

  // 提取 draftId - 先从 URL 获取，再从 sessionStorage 获取
  const urlParams = new URLSearchParams(location.search)
  let draftId = urlParams.get('draftId') || urlParams.get('draft_id')

  // 如果 URL 中没有，尝试从 sessionStorage 获取（用于发布页面）
  if (!draftId && pageType === 'publish') {
    draftId = sessionStorage.getItem('flagship_draftId')
    console.log('[旗舰MAX] 从 sessionStorage 获取 draftId:', draftId)
  }

  if (!draftId) {
    console.log('[旗舰MAX] 无 draftId，跳过')
    return
  }

  // 保存 draftId 到 sessionStorage（用于后续页面）
  sessionStorage.setItem('flagship_draftId', draftId)

  console.log('[旗舰MAX] draftId:', draftId)

  // 等待页面加载
  await new Promise(r => setTimeout(r, 1500))

  if (pageType === 'category') {
    await handleCategoryPage(draftId)
  } else if (pageType === 'publish') {
    await handlePublishPage(draftId)
  } else {
    console.log('[旗舰MAX] 非支持页面，跳过')
  }
}

// 启动
main().catch(e => console.error('[旗舰MAX] 启动失败:', e))

  // 暴露到 window，方便手动调用
  ; (window as any).runPublisherMax = main
