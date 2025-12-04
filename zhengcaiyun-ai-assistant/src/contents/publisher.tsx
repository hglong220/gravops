/**
 * ZCY Publisher V2 - 全自动发布插件
 * 
 * 功能：
 * 1. 检测页面类型（类目选择页/发布页）
 * 2. 从DOM解析商家开通的一级类目
 * 3. 调用后端API自动匹配类目
 * 4. 自动点选类目树、填写属性、提交
 */

import type { PlasmoCSConfig } from "plasmo"
import { parseAllowedRootCategories, parseCategoryListFromPage } from "~src/utils/permission-parser"
import { executeAutoPublish, autoSelectCategoryTree, autoFillAttributes, autoSubmit } from "~src/utils/auto-publish-rpa"

export const config: PlasmoCSConfig = {
  matches: ["https://*.zcygov.cn/*"],
  run_at: "document_end"
}

const BACKEND_URL = process.env.PLASMO_PUBLIC_BACKEND_URL || 'http://localhost:3000'

console.log("🚀 [ZCY Publisher V2] loaded")

// ========== 页面类型检测 ==========

function getPageType(): 'category' | 'publish' | 'other' {
  const path = window.location.pathname
  if (path.includes('/category/attr/select')) return 'category'
  if (path.includes('/goods/publish')) return 'publish'
  return 'other'
}

// ========== 草稿获取 ==========

interface Draft {
  id: string
  title: string
  brand?: string
  model?: string
  categoryId?: string
  images?: string
  attributes?: string
  detailHtml?: string
}

async function fetchDraft(draftId: string): Promise<Draft | null> {
  try {
    const resp = await fetch(`${BACKEND_URL}/api/copy/get?id=${draftId}`)
    if (!resp.ok) return null
    const data = await resp.json()
    return data.draft as Draft
  } catch (e) {
    console.error('[Publisher] 获取草稿失败:', e)
    return null
  }
}

// ========== UI组件 ==========

function createOverlay(): HTMLDivElement {
  let overlay = document.getElementById('zcy-auto-publish-overlay') as HTMLDivElement
  if (overlay) return overlay

  overlay = document.createElement('div')
  overlay.id = 'zcy-auto-publish-overlay'
  overlay.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 2147483647;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px 20px;
    border-radius: 12px;
    font-size: 14px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    min-width: 280px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `
  document.body.appendChild(overlay)
  return overlay
}

function updateOverlay(content: string) {
  const overlay = createOverlay()
  overlay.innerHTML = content
}

function showStatus(title: string, status: string, details?: string) {
  updateOverlay(`
    <div style="font-weight: 600; font-size: 15px; margin-bottom: 8px;">🤖 ${title}</div>
    <div style="opacity: 0.95;">${status}</div>
    ${details ? `<div style="font-size: 12px; opacity: 0.7; margin-top: 6px;">${details}</div>` : ''}
  `)
}

function showSuccess(message: string, category?: string) {
  updateOverlay(`
    <div style="font-weight: 600; font-size: 15px; margin-bottom: 8px;">✅ 操作成功</div>
    <div>${message}</div>
    ${category ? `<div style="font-size: 12px; opacity: 0.7; margin-top: 6px;">类目: ${category}</div>` : ''}
  `)
}

function showError(message: string) {
  updateOverlay(`
    <div style="font-weight: 600; font-size: 15px; margin-bottom: 8px;">❌ 操作失败</div>
    <div>${message}</div>
    <div style="font-size: 12px; opacity: 0.7; margin-top: 8px;">请尝试手动操作或刷新重试</div>
  `)
}

// ========== 类目页面处理 ==========

async function handleCategoryPage(draftId: string) {
  console.log('[Publisher] 处理类目选择页面, draftId:', draftId)

  showStatus('自动发布', '正在获取草稿信息...')

  // 1. 获取草稿
  const draft = await fetchDraft(draftId)
  if (!draft) {
    showError('草稿获取失败')
    return
  }

  console.log('[Publisher] 草稿:', draft.title)
  showStatus('自动发布', '正在解析可用类目...', `商品: ${draft.title.substring(0, 30)}...`)

  // 2. 解析页面中的一级类目
  await new Promise(r => setTimeout(r, 1000)) // 等待页面加载

  let allowedRoots = parseCategoryListFromPage()
  if (allowedRoots.length === 0) {
    allowedRoots = parseAllowedRootCategories()
  }

  // 如果仍然没有，使用常见类目作为兜底
  if (allowedRoots.length === 0) {
    allowedRoots = ['办公用品', '日用百货', '办公设备', '计算机设备', '家具', '灯具商品', '五金工具']
    console.log('[Publisher] 使用默认类目列表')
  }

  console.log('[Publisher] 可用类目:', allowedRoots)
  showStatus('自动发布', '正在智能匹配类目...', `候选: ${allowedRoots.slice(0, 3).join(', ')}...`)

  // 3. 执行自动发布流程
  const result = await executeAutoPublish({
    title: draft.title,
    brand: draft.brand,
    model: draft.model,
    allowedRoots
  })

  if (result.success) {
    showSuccess('类目选择完成，正在跳转...', result.categoryUsed)
  } else {
    showError(result.error || '自动选择失败')
  }
}

// ========== 发布页面处理 ==========

async function handlePublishPage(draftId: string) {
  console.log('[Publisher] 处理发布页面, draftId:', draftId)

  showStatus('自动填表', '正在获取草稿信息...')

  // 1. 获取草稿
  const draft = await fetchDraft(draftId)
  if (!draft) {
    showError('草稿获取失败')
    return
  }

  showStatus('自动填表', '正在填写表单...', `商品: ${draft.title.substring(0, 30)}...`)

  // 2. 等待表单加载
  await new Promise(r => setTimeout(r, 1500))

  // 3. 填写基本信息
  const fillBasicInfo = () => {
    // 商品名称
    const nameInput = document.querySelector<HTMLTextAreaElement>('textarea#itemBrief, textarea[name="name"], textarea[placeholder*="名称"]')
    if (nameInput) {
      nameInput.value = draft.title
      nameInput.dispatchEvent(new Event('input', { bubbles: true }))
      nameInput.dispatchEvent(new Event('change', { bubbles: true }))
    }

    // 品牌
    if (draft.brand) {
      const brandInput = document.querySelector<HTMLInputElement>('input#brand, input[name="brand"], input[placeholder*="品牌"]')
      if (brandInput) {
        brandInput.value = draft.brand
        brandInput.dispatchEvent(new Event('input', { bubbles: true }))
        brandInput.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }
  }

  fillBasicInfo()

  // 4. 填写型号和属性
  await autoFillAttributes(draft.brand || '', draft.model || '')

  // 5. 填写规格参数
  if (draft.attributes) {
    try {
      const attrs = JSON.parse(draft.attributes) as Record<string, string>
      for (const [key, value] of Object.entries(attrs)) {
        const input = document.querySelector<HTMLInputElement>(`input[name="${key}"], input[placeholder*="${key}"]`)
        if (input) {
          input.value = value
          input.dispatchEvent(new Event('input', { bubbles: true }))
        }
      }
    } catch (e) {
      console.warn('[Publisher] 解析属性失败:', e)
    }
  }

  showSuccess('表单填写完成', '请检查后点击提交')

  // 添加自动提交按钮
  const overlay = createOverlay()
  overlay.innerHTML += `
    <button id="zcy-auto-submit" style="
      margin-top: 12px;
      padding: 8px 16px;
      background: white;
      color: #667eea;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      width: 100%;
    ">一键提交</button>
  `

  document.getElementById('zcy-auto-submit')?.addEventListener('click', async () => {
    showStatus('自动发布', '正在提交...')
    const submitted = await autoSubmit()
    if (submitted) {
      showSuccess('已提交，请等待审核')
    } else {
      showError('提交失败，请手动点击提交按钮')
    }
  })
}

// ========== 主入口 ==========

async function init() {
  // 获取draft_id参数
  const params = new URLSearchParams(window.location.search)
  const draftId = params.get('draft_id')

  if (!draftId) {
    console.log('[Publisher] 无draft_id，跳过')
    return
  }

  const pageType = getPageType()
  console.log('[Publisher] 页面类型:', pageType, ', draftId:', draftId)

  // 等待页面加载
  await new Promise(r => setTimeout(r, 500))

  switch (pageType) {
    case 'category':
      await handleCategoryPage(draftId)
      break
    case 'publish':
      await handlePublishPage(draftId)
      break
    default:
      console.log('[Publisher] 非发布相关页面')
  }
}

// 启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
