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
  // 🔍 调试：打印后端返回的原始价格数据
  console.log('[DRAFT_RAW]', draft.id, 'price:', draft.price, 'marketPrice:', draft.marketPrice)
  showStatus('旗舰MAX', '正在调用 AI 分析...', `商品: ${draft.title.substring(0, 30)}...`)

  // 2. 获取 License
  const storedLicense = await getStoredLicense()
  const licenseKey = storedLicense?.licenseKey || ''

  if (!licenseKey) {
    showError('请先在插件中激活 License')
    return
  }

  console.log('[旗舰MAX] 使用 License:', licenseKey.substring(0, 8) + '...')

  // 3. 决定是否调用 AI 分析
  let aiResultData: any = null;

  // 检查草稿中是否已有类目路径
  if (draft.categoryPath && Array.isArray(draft.categoryPath) && draft.categoryPath.length > 0) {
    console.log('%c[旗舰MAX] 🚀 发现已缓存的类目路径，跳过 AI 分析', 'background: #673ab7; color: white; padding: 2px 4px; border-radius: 4px;', draft.categoryPath.join(' > '))
    aiResultData = {
      categoryPath: draft.categoryPath,
      brand: draft.brand || '未知',
      model: draft.model || '',
      bid: draft.bid || draft.categoryPath[0]?.split('/')[0] || '办公设备',
      usedAI: false
    }
  } else {
    // 只有在没有缓存时才请求后端分析
    try {
      const { baseUrl, token } = await getApiConfig()
      console.log('%c[旗舰MAX] 🛰️ 正在请求后端分析 (mode: full)...', 'background: #2196f3; color: white; padding: 2px 4px; border-radius: 4px;')
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

      if (!resp.ok) {
        showError(resp.data?.error || resp.error || `AI 匹配失败 (${resp.status})`)
        return
      }
      aiResultData = resp.data.data
    } catch (e) {
      showError('AI 服务连接失败')
      return
    }
  }

  if (!aiResultData) {
    showError('类目分析数据获取失败')
    return
  }

  const { categoryPath, brand, model, bid, usedAI } = aiResultData

  console.log(`%c[旗舰MAX] 📥 最终执行方案 (由${usedAI ? 'AI产生' : '缓存提取'})`, 'background: #4caf50; color: white; padding: 2px 4px; border-radius: 4px;')
  console.log('[旗舰MAX] 详情:', {
    categoryPath: categoryPath.join(' > '),
    brand,
    model: model || '(未提取)',
    bid
  })

  showStatus('旗舰MAX', '开始执行 RPA...', categoryPath.join(' > '))

  // 4. 准备采集数据
  const specs = draft.attributes || {}
  const marketPrice = draft.marketPrice ? parseFloat(draft.marketPrice) : undefined
  const salePrice = draft.price ? parseFloat(draft.price) : undefined  // 用户编辑的销售价

  // ⭐ 品牌清洗：优先使用 AI 提取的品牌（Gemini Pro 更智能），specs 作为兜底
  let finalBrand = ''
  if (brand && brand !== '未知' && brand.length <= 15) {
    finalBrand = brand
    console.log('%c[旗舰MAX] 🤖 采用 Gemini 3 Pro 深度分析品牌:', 'color: #4caf50; font-weight: bold; font-size: 12px;', finalBrand)
  } else if (specs && specs['品牌']) {
    finalBrand = specs['品牌']
    console.log('%c[旗舰MAX] ⚠️ AI 品牌未识别，回退至原始抓取品牌:', 'color: #ff9800;', finalBrand)
  }

  // ⭐ 型号清洗：极其重要！防止描述性文本或列表被识别为型号
  const validateModel = (m: string | null | undefined): string | null => {
    if (!m || m === '未知') return null;
    const norm = m.trim();
    // 包含太多分隔符或是包含“适用于”字样的，通通毙掉
    const sepCount = (norm.match(/[\s\/\\\+,，]/g) || []).length;
    if (sepCount >= 2 || (sepCount >= 1 && norm.length > 15) || norm.includes('适用')) {
      console.log(`[旗舰MAX] 🚫 拒绝不合规型号: "${norm}"`);
      return null;
    }
    return norm;
  };

  let finalModel = validateModel(model);
  if (finalModel) {
    console.log('%c[旗舰MAX] 🤖 采用 Gemini 深度清洗型号:', 'color: #4caf50; font-weight: bold; font-size: 12px;', finalModel)
  } else {
    // 回退到 specs，但同样需要清洗
    const rawModel = specs['型号'] || specs['商品型号'];
    finalModel = validateModel(rawModel);
    if (finalModel) {
      console.log('%c[旗舰MAX] ⚠️ AI 无效，但成功清洗原始型号:', 'color: #ff9800;', finalModel)
    } else {
      // 如果都洗不出来，先置空，让引擎尝试 title 提取或留给用户
      finalModel = '';
      console.warn('[旗舰MAX] ❌ 型号提取彻底失败（全是干扰信息），已置空待手动确认');
    }
  }

  // 5. 构造 TaskContext
  const scraped: ScrapedData = {
    title: draft.title,
    brand: finalBrand,
    model: finalModel,
    stock: draft.stock || 999,
    price: marketPrice || salePrice,  // 市场价（优先使用 marketPrice）
    salePrice: salePrice,              // 销售价（用户编辑的）
    specs: specs,
    categoryPath: categoryPath,
    categoryName: categoryPath[categoryPath.length - 1],
    bid: bid, // ⭐ 这里的 bid 是 AI 分析得到的标项名称，非常关键
    sourceUrl: draft.originalUrl,
    images: draft.images || [],
    detailImages: draft.detailImages || [], // ⭐ 详情图
    skuImages: draft.skuImages || {},        // ⭐ SKU图片
    skuSpecs: draft.skuSpecs || [],          // ⭐ SKU规格
    skuData: draft.skuData || []             // ⭐ SKU数据
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

  // 🔍 调试：打印后端返回的原始价格数据
  console.log('[DRAFT_RAW]', draft.id, 'price:', draft.price, 'marketPrice:', draft.marketPrice)

  const storedLicense = await getStoredLicense()
  const licenseKey = storedLicense?.licenseKey || ''

  const specs = draft.attributes || {}

  const scraped: ScrapedData = {
    title: draft.title,
    brand: specs['品牌'] || draft.brand,
    model: specs['型号'] || draft.model,
    stock: draft.stock || 999,
    price: draft.marketPrice ? parseFloat(draft.marketPrice) : (draft.price ? parseFloat(draft.price) : undefined),  // 市场价
    salePrice: draft.price ? parseFloat(draft.price) : undefined,  // 销售价（用户编辑的）
    specs: specs,
    sourceUrl: draft.originalUrl,
    images: draft.images || [],
    detailImages: draft.detailImages || [],
    skuImages: draft.skuImages || {},
    skuSpecs: draft.skuSpecs || [],
    skuData: draft.skuData || []
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
