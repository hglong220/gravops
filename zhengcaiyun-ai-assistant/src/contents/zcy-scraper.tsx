import type { PlasmoCSConfig, PlasmoGetStyle, PlasmoMountShadowHost } from "plasmo"
import { useEffect, useState } from "react"
import { fetchWithAuth } from "~src/utils/api"
import { extractRegion } from "~src/utils/zcy-dom"



export const config: PlasmoCSConfig = {
  matches: ["https://www.zcygov.cn/*", "https://*.zcygov.cn/*"],
  run_at: "document_idle"
}

export const mountShadowHost: PlasmoMountShadowHost = ({ shadowHost }) => {
  document.body.appendChild(shadowHost)
}

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = `
    .zcy-fab-container {
      position: fixed;
      bottom: 20px;
      right: 130px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
      pointer-events: none;
    }
    .zcy-fab-btn {
      width: 56px;
      height: 56px;
      padding: 0;
      background-color: var(--zcy-fab-bg, #1677FF);
      border: none;
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
    }
    .zcy-fab-btn:hover {
      transform: scale(1.06);
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);
    }
    .zcy-fab-btn:active {
      transform: scale(0.95);
    }
    @keyframes zcy-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .zcy-fab-img {
      width: 28px;
      height: 28px;
      display: block;
      object-fit: contain;
    }
  `
  return style
}

// 绾櫧绠€鍖栫増鍥炬爣锛岄伩鍏嶅唴鍦堝簳鑹?const ICON_WHITE_SVG = `data:image/svg+xml;base64,${btoa(`
<svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M100 15c7 0 12 6 15 13l13 35c3 8 12 12 20 9l35-13c7-3 13 0 16 7 3 7-1 14-7 18l-30 21c-7 5-9 14-4 21l21 30c5 6 5 13-1 18-6 5-14 4-19-1l-27-25c-6-6-16-5-21 1l-23 28c-5 6-12 7-18 2-6-5-7-12-4-19l14-34c3-8 0-17-8-20l-35-14c-7-3-11-10-8-17s10-11 17-9l36 10c8 2 16-3 18-11l9-36c2-7 8-13 15-13Z" stroke="white" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" />
</svg>
`)}`

const ZcyScraperWidget = () => {
  const COLOR_PURPLE = "#7C3AED" // 鏁村簵
  const COLOR_BLUE = "#1677FF" // 鍗曞搧/鎴愬姛
  const COLOR_FAIL = "#FF4D4F" // 澶辫触
  const [showCopyBtn, setShowCopyBtn] = useState(false)
  const [isBatch, setIsBatch] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fabColor, setFabColor] = useState(COLOR_BLUE)
  const [pushSuccess, setPushSuccess] = useState(false)
  const [successMsg, setSuccessMsg] = useState("")

  useEffect(() => {
    const checkPage = () => {
      if (!window.location.hostname.includes("zcygov.cn")) return
      const isSelfShop =
        !!document.querySelector(".my-shop, .user-center, .my-profile, .my-info, .my-shop-nav") ||
        /myshop|usercenter|mycenter|myinfo/.test(window.location.href) ||
        !!document.querySelector(".zcy-user-info, .zcy-user-avatar")

      const url = new URL(window.location.href)
      const isShopHome =
        (url.pathname === "/eevees/shop" && url.searchParams.get("shopId") && /^\d+$/.test(url.searchParams.get("shopId") || "")) ||
        (/^\/eevees\/shop$/.test(url.pathname) && url.searchParams.has("shopId")) ||
        /\/eevees\/shop\?shopId=\d+/.test(window.location.href)

      const isProduct =
        window.location.href.includes("/product/") ||
        window.location.href.includes("detail") ||
        document.querySelector(".product-intro") ||
        document.querySelector(".sku-name") ||
        document.querySelector(".meta-price") ||
        document.querySelector(".item-title")
      const isList = !!document.querySelector(".product-list, .shop-products, .item-list, .search-list")

      console.log("[ZCY Scraper] Checking page:", window.location.href)
      console.log("[ZCY Scraper] Flags:", { isSelfShop, isShopHome, isList, isProduct })

      // 强制显示策略：只要不是明确的个人中心且在政采云域名下，尽量显示
      // Temporary Recovery: Disable strict hiding to ensure user sees the button
      /* 
      if (isSelfShop) {
        console.log("[ZCY Scraper] Hidden: isSelfShop")
        setShowCopyBtn(false)
        setIsBatch(false)
        return
      }
      */

      if (isShopHome || isList) {
        console.log("[ZCY Scraper] Shown: Shop/List")
        setShowCopyBtn(true)
        setIsBatch(true)
        setFabColor(COLOR_PURPLE)
        return
      }

      // Relaxed Product Detection
      if (isProduct || window.location.href.includes('/items/') || window.location.href.includes('/product/')) {
        console.log("[ZCY Scraper] Shown: Product (or URL match)")
        setShowCopyBtn(true)
        setIsBatch(false)
        setFabColor(COLOR_BLUE)
        return
      }

      // Fallback: If we are on ZCY and not explicitly excluded, SHOW IT for now
      if (window.location.hostname.includes("zcygov.cn")) {
        console.log("[ZCY Scraper] Shown: Fallback (Recovery Mode)")
        setShowCopyBtn(true)
        setIsBatch(false) // Default to single
        setFabColor(COLOR_BLUE)

        const region = extractRegion()
        if (region && region !== "Global") {
          chrome.storage.local.set({ zcy_region: region })
        }
        return
      }

      console.log("[ZCY Scraper] Hidden: No match")
      setShowCopyBtn(false)
      setIsBatch(false)

    }

    let timer: NodeJS.Timeout | null = null
    const throttledCheck = () => {
      if (timer) return
      timer = setTimeout(() => {
        checkPage()
        timer = null
      }, 500)
    }
    const observer = new MutationObserver(throttledCheck)
    observer.observe(document.body, { subtree: false, childList: true })
    throttledCheck()
    window.addEventListener("popstate", throttledCheck)
    window.addEventListener("hashchange", throttledCheck)
    return () => {
      observer.disconnect()
      window.removeEventListener("popstate", throttledCheck)
      window.removeEventListener("hashchange", throttledCheck)
    }
  }, [])

  const pushProducts = async (items: Array<{ url: string; title?: string }>, shopUrl?: string) =>
    fetchWithAuth("/api/push-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "batch",
        links: items.map((i) => i.url),
        items,
        shopUrl: shopUrl || window.location.href
      })
    })

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  const deriveItemId = (u: string) => {
    const m = u.match(/\/items\/(\d+)/)
    return m ? m[1] : ""
  }

  // 整店采集：列表/店铺页的商品链接 + 标题
    const collectProductItems = () => {
    const items = new Map<string, string | undefined>()
    const origin = location.origin
    const normalize = (u: string) => {
      if (u.startsWith("//")) return location.protocol + u
      if (u.startsWith("/")) return origin + u
      return u
    }
    const matchers = (href: string) => {
      const h = href.split("#")[0]
      return (
        /\/items\/\d+/.test(h) ||
        /skuId=\d+/.test(h) ||
        /\/product\/\d+/.test(h) ||
        /\/eevees\/items\/\d+/.test(h) ||
        /itemId=\d+/.test(h) ||
        /productId=\d+/.test(h) ||
        /goodsId=\d+/.test(h) ||
        /detailId=\d+/.test(h) ||
        /\/item\/\d+/.test(h) ||
        /\/detail\/\d+/.test(h) ||
        (/\d{5,}/.test(h) && /(item|product|detail|goods|sku|spu)/i.test(h))
      )
    }
    const extractFromNode = (node?: Element | null) => {
      if (!node) return ""
      const selectors = [
        ".item-title",
        ".product-name",
        ".goods-name",
        ".title",
        "[class*='title']",
        "[class*='name']",
        ".card-title"
      ]
      for (const sel of selectors) {
        const el = node.querySelector(sel)
        const text = el?.textContent?.trim()
        if (text) return text
      }
      // 尝试父节点文本
      return node.textContent?.trim() || ""
    }
    const deriveFromUrl = (u: string) => {
      try {
        const parsed = new URL(u)
        const keys = ["title", "name", "itemId", "id", "skuId", "productId", "goodsId", "detailId"]
        for (const k of keys) {
          const v = parsed.searchParams.get(k)
          if (v) return v
        }
        const segments = parsed.pathname.split("/").filter(Boolean)
        if (segments.length) return segments[segments.length - 1]
        return u
      } catch {
        return u
      }
    }
    const addItem = (url: string, title?: string, el?: Element | null) => {
      if (!url) return
      let t = title?.trim()
      if (!t && el) {
        // try to get title from enclosing card
        const card = el.closest(".product-item, .goods-item, .card, .grid-item, li, div")
        t = extractFromNode(card || el)
      }
      if (!t) t = deriveFromUrl(url)
      if (!matchers(url)) return
      if (!items.has(url) || (!!t && !items.get(url))) {
        items.set(url, t)
      }
    }

    const containers = document.querySelectorAll(
      ".product-list a[href], .shop-products a[href], .item-list a[href], .goods-name a[href], .grid-product a[href], a[href*='/items/'], a[href]"
    )
    containers.forEach((a) => {
      const href = (a as HTMLAnchorElement).getAttribute("href") || ""
      if (!href) return
      const full = normalize((a as HTMLAnchorElement).href || href)
      const titleAttr =
        (a as HTMLElement).getAttribute("title") ||
        (a as HTMLElement).getAttribute("aria-label") ||
        (a as HTMLElement).getAttribute("data-title") ||
        (a as HTMLElement).getAttribute("data-name") ||
        ""
      const text = (a as HTMLAnchorElement).textContent?.trim() || titleAttr
      addItem(full, text, a)
    })

    document.querySelectorAll<HTMLElement>("[data-href], [data-url]").forEach((el) => {
      const href = el.getAttribute("data-href") || el.getAttribute("data-url") || ""
      const titleAttr =
        el.getAttribute("data-title") ||
        el.getAttribute("data-name") ||
        el.getAttribute("title") ||
        el.getAttribute("aria-label") ||
        ""
      if (href) addItem(normalize(href), titleAttr || el.textContent || "", el)
    })

    document.querySelectorAll<HTMLElement>("[data-utm-data]").forEach((el) => {
      const raw = el.getAttribute("data-utm-data")
      if (!raw || raw.length < 10) return
      try {
        const obj = JSON.parse(raw)
        const itemId = obj.itemId || obj.id
        if (itemId) {
          const shopId = obj.shopId ? `&shopId=${obj.shopId}` : ""
          addItem(`${origin}/items/${itemId}?searchType=1${shopId}`, obj.name || obj.title || obj.itemName || obj.productName || obj.goodsName, el)
        }
      } catch (e) {
        // ignore parse errors
      }
    })

    document.querySelectorAll<HTMLElement>("[onclick]").forEach((el) => {
      const onclick = el.getAttribute("onclick") || ""
      const m = onclick.match(/https?:\/\/[^\s'"]+/)
      if (m) {
        const titleAttr =
          el.getAttribute("data-title") ||
          el.getAttribute("data-name") ||
          el.getAttribute("title") ||
          el.getAttribute("aria-label") ||
          el.textContent ||
          ""
        addItem(m[0], titleAttr, el)
      }
    })

    if (!items.size) {
      document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
        const href = normalize(a.href || "")
        if (!href.startsWith(origin)) return
        const h = href.split("#")[0]
        if (/\d{5,}/.test(h)) addItem(h, a.textContent || "")
      })
    }

    return Array.from(items.entries()).map(([url, title]) => ({ url, title }))
  }

  const collectAllProductItems = async () => {
    const links = new Map<string, string | undefined>()
    const collect = () =>
      collectProductItems().forEach(({ url, title }) => {
        if (!links.has(url) || (!!title && !links.get(url))) {
          links.set(url, title)
        }
      })

    collect()
    let scrollTries = 0
    while (scrollTries < 20) {
      const before = links.size
      window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" as ScrollBehavior })
      await sleep(600)
      collect()
      if (links.size === before) {
        scrollTries += 1
      } else {
        scrollTries = 0
      }
    }

    // 尝试点击分页页码（避免只处理当前页）
    const visitedPages = new Set<string>()
    const getPageButtons = () =>
      Array.from(document.querySelectorAll<HTMLAnchorElement | HTMLButtonElement>(".ant-pagination-item a, .ant-pagination-item button"))
    const getActivePage = () =>
      (document.querySelector(".ant-pagination-item-active")?.textContent || "").trim()

    const clickAndCollectPage = async (btn: HTMLAnchorElement | HTMLButtonElement) => {
      btn.click()
      await sleep(1200)
      collect()
    }

    const active = getActivePage()
    if (active) visitedPages.add(active)

    let safety = 0
    while (safety < 300) {
      safety += 1
      const btns = getPageButtons().filter((b) => {
        const t = (b.textContent || "").trim()
        return t && !visitedPages.has(t)
      })
      if (!btns.length) break
      const btn = btns[0]
      const label = (btn.textContent || "").trim()
      visitedPages.add(label)
      await clickAndCollectPage(btn)
    }

    // 兜底：继续点“下一页”直到没有
    const findNextBtn = (): HTMLButtonElement | HTMLAnchorElement | null => {
      const antBtn = document.querySelector<HTMLButtonElement>(".ant-pagination-next button:not([disabled])")
      if (antBtn) return antBtn
      const candidates = Array.from(document.querySelectorAll<HTMLButtonElement | HTMLAnchorElement | HTMLLIElement>("button, a, li"))
      const nextEl = candidates.find((btn) => {
        const t = (btn.innerText || "").trim()
        return /下一页|下一頁|下页|下一頁|Next|»|›/i.test(t) && !btn.hasAttribute("disabled") && !btn.classList.contains("disabled")
      })
      if (nextEl && nextEl.tagName.toLowerCase() === "li") {
        const inner = nextEl.querySelector("a,button")
        if (inner) return inner as any
      }
      return (nextEl as any) || null
    }

    let pageLoop = 0
    while (pageLoop < 200) {
      const next = findNextBtn()
      if (!next) break
      next.click()
      pageLoop += 1
      await sleep(1200)
      collect()
    }

    return Array.from(links.entries()).map(([url, title]) => ({ url, title }))
  }

  const dedupeValidItems = (items: Array<{ url: string; title?: string }>) => {
    const map = new Map<string, { url: string; title?: string }>()
    for (const it of items) {
      if (!it?.url) continue
      const id = deriveItemId(it.url)
      if (!id) continue
      const title = it.title?.trim() || id
      if (!map.has(id)) {
        map.set(id, { url: it.url, title })
      }
    }
    return Array.from(map.values())
  }

  const enrichTitlesFromDetail = async (items: Array<{ url: string; title?: string }>) => {
    const needFetch = items.filter((i) => !i.title || /^\d+$/.test(i.title))
    const result = [...items]
    const concurrency = 5
    let index = 0

    const fetchOne = async (item: { url: string; title?: string }) => {
      try {
        const res = await fetch(item.url, { credentials: "include" })
        const html = await res.text()
        const matchTitle =
          html.match(/<title>\s*([^<]+)\s*<\/title>/i)?.[1] ||
          html.match(/"itemTitle"\s*:\s*"([^"]+)"/i)?.[1] ||
          html.match(/"title"\s*:\s*"([^"]+)"/i)?.[1] ||
          html.match(/class="item-name"[^>]*>([^<]+)</i)?.[1]
        if (matchTitle) {
          item.title = matchTitle.trim()
        }
      } catch (e) {
        // ignore fetch errors, keep old title
      }
    }

    const workers = Array.from({ length: concurrency }).map(async () => {
      while (index < needFetch.length) {
        const current = needFetch[index++]
        await fetchOne(current)
      }
    })
    await Promise.all(workers)
    return result
  }

  const handleCopy = async () => {
    if (loading) return
    setLoading(true)
    setPushSuccess(false)
    try {
      if (isBatch) {
        const rawItems = await collectAllProductItems()
        const items = dedupeValidItems(rawItems)
        await enrichTitlesFromDetail(items)
        if (!items.length) throw new Error("未找到商品链接")
        await pushProducts(items, window.location.href)
        setPushSuccess(true)
        setFabColor(COLOR_BLUE)
        setSuccessMsg(`批量提交成功，共${items.length}个商品`)
      } else {
        const data = await collectProductDataFromPage()
        await uploadSingleProduct(data)
        setPushSuccess(true)
        setFabColor(COLOR_BLUE)
        setSuccessMsg("采集成功")
      }
    } catch (error) {
      console.error("[ZCY Scraper] Error:", error)
      setPushSuccess(false)
      setFabColor(COLOR_FAIL)
      setSuccessMsg("提交失败" + (error as Error).message)
    } finally {
      setLoading(false)
      setTimeout(() => {
        setPushSuccess(false)
        setFabColor(isBatch ? COLOR_PURPLE : COLOR_BLUE)
        setSuccessMsg("")
      }, 2000)
    }
  }

  if (!showCopyBtn) return null

  return (
    <div className="zcy-fab-container">
      <button
        id="zcy-copy-btn"
        className="zcy-fab-btn"
        onClick={handleCopy}
        disabled={loading}
        style={{
          backgroundColor: fabColor,
          boxShadow:
            fabColor === COLOR_PURPLE
              ? "0 8px 20px rgba(124,58,237,0.35)"
              : fabColor === COLOR_FAIL
                ? "0 8px 20px rgba(255,77,79,0.3)"
                : "0 8px 20px rgba(22,119,255,0.35)"
        }}
      >
        <img
          className="zcy-fab-img"
          src={ICON_WHITE_SVG}
          style={loading ? { animation: "zcy-spin 1s linear infinite" } : {}}
          alt="ZCY"
        />
      </button>
      {successMsg && (
        <div
          style={{
            marginTop: 8,
            background: pushSuccess ? COLOR_BLUE : COLOR_FAIL,
            color: "#fff",
            borderRadius: 10,
            padding: "6px 14px",
            fontSize: 13,
            boxShadow: pushSuccess
              ? "0 2px 8px rgba(22,119,255,0.18)"
              : "0 2px 8px rgba(255,77,79,0.18)"
          }}
        >
          {successMsg}
        </div>
      )}
    </div>
  )
}

// 在商品详情页内，用已登录会话直接拉接口，失败则 DOM 兜底，最终推送到任务中心
const collectProductDataFromPage = async () => {
  const itemId = window.location.href.match(/\/items\/(\d+)/)?.[1]
  const ts = Date.now()
  const fetchJson = async (u: string) => {
    try {
      const r = await fetch(u, { credentials: "include" })
      const t = await r.text()
      return JSON.parse(t)
    } catch (e) {
      console.warn("[ZCY Scraper] fetchJson failed", u, e)
      return null
    }
  }

  const item = itemId ? await fetchJson(`/front/detail/item/${itemId}?timestamp=${ts}&zjxwcFlag=true`) : null
  const params = itemId ? await fetchJson(`/front/detail/item/param?timestamp=${ts}&itemId=${itemId}`) : null

  // 标题/图片
  const domData = scrapeProductData()
  let title = item?.data?.title || item?.data?.itemTitle || domData.title || ""
  const mainImages: string[] = item?.data?.imgs || domData.images
  const detailImages: string[] = domData.detailImages || []

  // 属性
  const specs: Record<string, any> = {}
  ;(params?.data?.specs || []).forEach((s: any) => {
    if (s?.key && s?.value) specs[s.key] = s.value
  })
  if (!Object.keys(specs).length) {
    Object.assign(specs, domData.attributes)
  }

  // 详情
  let detailHtml = item?.data?.detailInfo || ""
  if (!detailHtml) {
    const frame = document.querySelector("iframe")
    if (frame instanceof HTMLIFrameElement && frame.contentDocument?.body) {
      detailHtml = frame.contentDocument.body.innerHTML
    } else {
      detailHtml = domData.detailHtml
    }
  }

  const categoryId = item?.data?.categoryId || domData.categoryId || null
  const brand = item?.data?.brandName || null
  const model =
    specs["型号"] ||
    specs["型號"] ||
    specs["型号/规格"] ||
    domData.model ||
    extractModelFromText(domData.detailText || document.body.innerText || "")

  return {
    title: title || "Untitled",
    url: window.location.href,
    shopName: domData.shopName || "",
    model: model || "",
    specs,
    mainImages,
    detailImages,
    detailHtml,
    categoryId,
    brand
  }
}

const scrapeProductData = () => {
  const titleSelectors = [
    ".item-title",
    ".product-name",
    ".goods-name",
    ".commodity-title",
    "h1",
    ".product-title",
    ".sku-name",
    '[class*=\"title\"]',
    '[class*=\"name\"]'
  ]

  let title = ""
  for (const selector of titleSelectors) {
    const element = document.querySelector(selector)
    if (element?.textContent?.trim()) {
      title = element.textContent.trim()
      break
    }
  }

  if (!title) {
    title = document.title.replace(/[-_|].*$/, "").trim()
  }

  const collectImgs = (sel: string) =>
    Array.from(document.querySelectorAll(sel))
      .map((img) => (img as HTMLImageElement).src || (img as HTMLImageElement).getAttribute("data-src") || "")
      .filter((src) => src && /^https?:\/\//.test(src))

  const images = collectImgs(".gallery-img, .main-img, .swiper-slide img, .item-img-thumb-list img, .goods-image img").slice(0, 10)
  const detailImages = collectImgs(".detail-content img, .goods-detail img, .product-detail img, .intro-wrap img").slice(0, 30)
  const priceEl = document.querySelector(".price, .real-price, .sku-price")
  const price = priceEl?.textContent?.replace(/[^\d.]/g, "") || "0"
  const detailEl = document.querySelector(".detail-content, .product-detail, .intro-wrap")
  const detailHtml = detailEl ? detailEl.innerHTML : ""
  const detailText = detailEl?.textContent || ""

  const shopName =
    document.querySelector(".shop-name, .merchant-name, .store-info .name")?.textContent?.trim() ||
    document.querySelector("[class*='shop'] [class*='name']")?.textContent?.trim() ||
    ""

  const attributes: Record<string, string> = {}
  document.querySelectorAll(".attr-list tr, .parameter-table tr, .attributes li").forEach((row) => {
    const text = row.textContent?.trim() || ""
    const parts = text.split(/[:：]/)
    if (parts.length >= 2) attributes[parts[0].trim()] = parts[1].trim()
  })

  let categoryId = ""
  try {
    const urlParams = new URLSearchParams(window.location.search)
    categoryId = urlParams.get("categoryId") || urlParams.get("catId") || ""
    if (!categoryId && (window as any).__INITIAL_STATE__) {
      const initialState = (window as any).__INITIAL_STATE__
      categoryId = initialState?.categoryId || initialState?.category?.id || ""
    }
    if (!categoryId) {
      const breadcrumb = document.querySelector('.breadcrumb, .nav-path, [class*=\"breadcrumb\"]')
      if (breadcrumb) {
        const categoryLink = breadcrumb.querySelector('a[href*=\"category\"]') as HTMLAnchorElement
        if (categoryLink) {
          const match = categoryLink.href.match(/category[=/](\d+)/)
          if (match) categoryId = match[1]
        }
      }
    }
    console.log("[ZCY Scraper] Extracted categoryId:", categoryId)
  } catch (e) {
    console.warn("[ZCY Scraper] Failed to extract categoryId:", e)
  }

  const model =
    attributes["型号"] ||
    attributes["规格型号"] ||
    attributes["产品型号"] ||
    attributes["型号/规格"] ||
    extractModelFromText(detailText || document.body.innerText || "")

  return { title, images, detailImages, price, detailHtml, detailText, attributes, categoryId, model, shopName }
}

const extractModelFromText = (text: string) => {
  const m = text.match(/型号[:：\s]*([A-Za-z0-9\-_\/]+)/)
  return m?.[1]?.trim() || ""
}

const uploadSingleProduct = async (product: any) => {
  // 兼容：优先推送到任务中心新接口，失败则回退旧接口
  const payload = {
    source: "zcy",
    type: "single",
    product
  }
  const resp = await fetchWithAuth("/api/plugin/collect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  if (!resp.ok) {
    // fallback
    await fetchWithAuth("/api/manual-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product)
    })
  }
}

window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) return
  if (event.data.type === "TRIGGER_ZCY_PUBLISH") {
    chrome.runtime
      .sendMessage({
        type: "TRIGGER_PUBLISH",
        productData: event.data.data
      })
      .catch((err) => console.error("[ZCY Scraper] Failed to send publish trigger:", err))
  }
})

export default ZcyScraperWidget



