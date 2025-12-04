import type { PlasmoCSConfig } from "plasmo"
import { PermissionExtractor, type PermissionData } from "~src/utils/permission-extractor"

// 发布页 selector（模板 37136616 / 类目 6835，如有新模板请扩展）
const SEL = {
  nameInput: "textarea#itemBrief",
  keywordInputs: [] as string[],
  brandInput: "input#brand",
  domesticRadio: "input.doraemon-radio-input[type='radio']:nth-of-type(1)",
  importRadio: "input.doraemon-radio-input[type='radio']:nth-of-type(2)",
  unitDropdown: "input#82544",
  unitOptionTemplate: "li[title='${UNIT}']",
  unitOptionByText: true,
  techParamSelectorMap: {
    规格: "input#specification",
    产地国: "input#country81973",
    详细产地: "input#address81973",
    型号: "input#1400007"
  },
  mainImageInput: "input#1500307[type='file']",
  detailImageInput: "input[type='file'][accept*='jpg']",
  descriptionFrameUrlPattern: /ueditor_0/,
  descriptionEditor: "body.view",
  needInstallYes: "input[type='radio'][value='1']",
  needInstallNo: "input[type='radio'][value='0']",
  saveButton: "button:has-text(\"保存草稿\")",
  publishButton: "button:has-text(\"提交\")"
}

const DEFAULT_API_BASE = "http://localhost:3000"
const DEFAULT_CATEGORY_ID = "6835"
const DEFAULT_TEMPLATE_ID = "37136616"

export const config: PlasmoCSConfig = {
  matches: ["https://*.zcygov.cn/*"],
  run_at: "document_end"
}

console.log("🚀 [ZCY Publisher] loaded")

let currentPermissions: PermissionData[] = []

// ===== 权限提示保留 =====
window.addEventListener("message", (event) => {
  if (event.source !== window) return
  if (event.data.type === "ZCY_PERMISSION_DATA_INTERCEPTED") {
    try {
      const response = JSON.parse(event.data.response)
      const permissions = PermissionExtractor.parseApiResponse(response)
      if (permissions.length) {
        currentPermissions = permissions
        chrome.storage.local.set({ zcy_permissions: permissions })
        checkPermissions()
      }
    } catch (e) {
      console.error("[ZCY Publisher] permission parse failed", e)
    }
  }
})

const checkPermissions = () => {
  const categoryElement = document.querySelector(".ant-breadcrumb span:last-child, .breadcrumb span:last-child")
  const currentCategory = categoryElement?.textContent?.trim() || ""
  if (!currentCategory || currentPermissions.length === 0) return
  const hasPermission = currentPermissions.some((p) => p.bidName.includes(currentCategory) || currentCategory.includes(p.bidName))
  if (!hasPermission) showPermissionWarning(currentCategory, currentPermissions)
}

const showPermissionWarning = (category: string, permissions: PermissionData[]) => {
  let overlay = document.getElementById("zcy-permission-warning")
  if (!overlay) {
    overlay = document.createElement("div")
    overlay.id = "zcy-permission-warning"
    overlay.style.cssText = `
      position: fixed; top: 100px; left: 50%; transform: translateX(-50%); z-index: 10001;
      background: rgba(255, 77, 79, 0.95); color: white; padding: 20px;
      border-radius: 8px; font-size: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      display: flex; flex-direction: column; gap: 10px; min-width: 400px; text-align: center;
    `
    document.body.appendChild(overlay)
  }
  const allowedNames = permissions.map((p) => p.bidName).join(", ")
  overlay.innerHTML = `
    <div style="font-size: 20px; font-weight: bold;">⚠️ 权限警告</div>
    <div>当前商品类目: <strong>${category}</strong></div>
    <div>您的可用权限: <strong>${allowedNames}</strong></div>
    <div style="margin-top: 10px; font-size: 14px; opacity: 0.9;">请检查协议/卖场是否正确，否则无法提交</div>
    <button id="zcy-close-warning" style="margin-top: 10px; padding: 5px 15px; background: white; color: #ff4d4f; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">我知道了</button>
  `
  document.getElementById("zcy-close-warning")?.addEventListener("click", () => overlay?.remove())
}

// ===== 发布逻辑 =====
type Draft = {
  id: string
  title?: string
  brand?: string
  model?: string
  categoryId?: string
  templateId?: string
  images?: string
  attributes?: string
  detailHtml?: string
  unit?: string
  isDomestic?: boolean
  needInstall?: boolean
}

const textFill = (selector: string, value: string) => {
  const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)
  if (el) {
    el.value = value
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
  }
}

const clickSel = (selector: string) => document.querySelector<HTMLElement>(selector)?.click()

const setInputFilesFromUrls = async (selector: string, urls: string[]) => {
  const input = document.querySelector<HTMLInputElement>(selector)
  if (!input || !urls?.length) return
  const dt = new DataTransfer()
  for (const url of urls) {
    try {
      const resp = await fetch(url)
      const blob = await resp.blob()
      const name = url.split("/").pop() || `img-${Date.now()}.jpg`
      dt.items.add(new File([blob], name, { type: blob.type || "image/jpeg" }))
    } catch (e) {
      console.warn("下载图片失败", url, e)
    }
  }
  if (dt.files.length) {
    input.files = dt.files
    input.dispatchEvent(new Event("change", { bubbles: true }))
  }
}

const fillDraftToForm = async (draft: Draft) => {
  // 填基本信息
  textFill(SEL.nameInput, draft.title || "")
  textFill(SEL.brandInput, draft.brand || "其他")

  // 关键词
  // 如果模板有关键词，按顺序填
  // SEL.keywordInputs 为空则跳过

  // 国产/进口
  if (draft.isDomestic === false) {
    clickSel(SEL.importRadio)
  } else {
    clickSel(SEL.domesticRadio)
  }

  // 计量单位
  clickSel(SEL.unitDropdown)
  setTimeout(() => {
    if (SEL.unitOptionByText) {
      const target = Array.from(document.querySelectorAll<HTMLElement>("li, span, div")).find(
        (n) => n.textContent?.trim() === (draft.unit || "个")
      )
      target?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    } else if (SEL.unitOptionTemplate) {
      const s = SEL.unitOptionTemplate.replace("${UNIT}", draft.unit || "个")
      clickSel(s)
    }
  }, 300)

  // 技术参数
  const attrs = draft.attributes ? (JSON.parse(draft.attributes) as Record<string, string>) : {}
  Object.entries(attrs).forEach(([k, v]) => {
    const selector = (SEL.techParamSelectorMap as Record<string, string>)[k]
    if (selector) textFill(selector, v)
  })

  // 富文本
  const frames = Array.from(document.querySelectorAll("iframe"))
  const frame = frames.find((f) => SEL.descriptionFrameUrlPattern.test(f.src || ""))
  if (frame?.contentDocument) {
    const editor = frame.contentDocument.querySelector(SEL.descriptionEditor)
    if (editor) editor.innerHTML = draft.detailHtml || ""
  }

  // 安装
  if (draft.needInstall) clickSel(SEL.needInstallYes)
  else clickSel(SEL.needInstallNo)

  // 图片
  const images = draft.images ? (JSON.parse(draft.images) as string[]) : []
  const main = images[0] ? [images[0]] : []
  const detail = images.slice(1)
  await setInputFilesFromUrls(SEL.mainImageInput, main)
  await setInputFilesFromUrls(SEL.detailImageInput, detail)
}

const fetchDraft = async (apiBase: string, draftId: string): Promise<Draft | null> => {
  const resp = await fetch(`${apiBase}/api/copy/get?id=${draftId}`)
  if (!resp.ok) {
    console.error("拉取草稿失败", resp.status)
    return null
  }
  const data = await resp.json()
  return data.draft as Draft
}

const initPublisher = async () => {
  const params = new URLSearchParams(window.location.search)
  const draftId = params.get("draft_id")
  if (!draftId) {
    console.log("[ZCY Publisher] no draft_id, skip")
    return
  }

  // 权限兜底
  const domPermissions = PermissionExtractor.extractFromDOM()
  if (domPermissions.length) {
    currentPermissions = domPermissions
    checkPermissions()
  }

  const overlay = document.createElement("div")
  overlay.id = "zcy-auto-publish-overlay"
  overlay.style.cssText = `
    position: fixed; top: 20px; right: 20px; z-index: 2147483647;
    background: rgba(0,0,0,0.85); color: white; padding: 15px;
    border-radius: 8px; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    display: flex; flex-direction: column; gap: 8px; min-width: 260px;
  `
  overlay.innerHTML = `
    <div style="font-weight: bold;">ZCY 自动填表</div>
    <div id="zcy-status-text">拉取草稿中...</div>
    <button id="zcy-save-submit" style="padding:6px;border:none;border-radius:6px;background:#1677ff;color:#fff;cursor:pointer;">保存并提交</button>
    <small>验证码/滑块请手动处理。</small>
  `
  document.body.appendChild(overlay)
  const setStatus = (t: string) => {
    const el = document.getElementById("zcy-status-text")
    if (el) el.textContent = t
  }

  const apiBase = DEFAULT_API_BASE
  const draft = await fetchDraft(apiBase, draftId)
  if (!draft) {
    setStatus("草稿获取失败")
    return
  }

  setStatus("正在填充表单...")
  await fillDraftToForm(draft)
  setStatus("填充完成，点击保存并提交")

  document.getElementById("zcy-save-submit")?.addEventListener("click", async () => {
    try {
      setStatus("保存草稿...")
      clickSel(SEL.saveButton)
      await new Promise((r) => setTimeout(r, 1500))
      setStatus("提交发布...")
      clickSel(SEL.publishButton)
      setStatus("已提交，若有验证码请人工完成")
    } catch (e) {
      setStatus("提交失败，请检查日志")
      console.error(e)
    }
  })
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPublisher)
} else {
  initPublisher()
}
