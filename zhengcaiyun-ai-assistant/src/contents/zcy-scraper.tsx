import type { PlasmoCSConfig, PlasmoGetStyle, PlasmoMountShadowHost } from "plasmo"
import { useEffect, useState } from "react"
import { fetchWithAuth } from "~src/utils/api"
import { extractRegion } from "~src/utils/zcy-dom"
import { startCollection } from "~src/utils/zcy-pro-scraper"



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
            width: 54px;
            height: 54px;
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
            width: 34px;
            height: 34px;
            display: block;
            object-fit: contain;
        }
    `
  return style
}

// 白色星形图标（与政采云一致）
const ICON_WHITE_SVG = `data:image/svg+xml;base64,${btoa(`
<svg width="200" height="200" viewBox="130 80 950 1000" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M 608.00 1058.50 L 582.00 1057.50 L 561.00 1052.50 L 528.00 1034.50 L 511.50 1018.00 L 499.50 1002.00 L 493.50 990.00 L 487.50 964.00 L 469.50 914.00 L 461.50 883.00 L 451.50 855.00 L 446.00 845.50 L 433.00 845.50 L 415.00 853.50 L 366.00 865.50 L 334.00 877.50 L 329.00 877.50 L 319.00 882.50 L 293.00 885.50 L 264.00 884.50 L 255.00 881.50 L 229.00 867.50 L 198.50 844.00 L 173.50 798.00 L 169.50 764.00 L 171.50 742.00 L 175.50 733.00 L 176.50 724.00 L 179.50 716.00 L 187.50 704.00 L 236.00 654.50 L 277.00 620.50 L 297.00 598.50 L 328.00 574.50 L 351.00 549.50 L 373.50 530.00 L 381.50 520.00 L 388.50 507.00 L 393.50 490.00 L 403.50 469.00 L 412.50 433.00 L 415.50 427.00 L 415.50 412.00 L 413.50 409.00 L 396.00 401.50 L 370.00 393.50 L 359.00 392.50 L 308.00 372.50 L 280.00 371.50 L 270.00 375.50 L 260.50 385.00 L 256.50 394.00 L 249.50 403.00 L 246.50 414.00 L 248.50 428.00 L 251.50 434.00 L 268.50 452.00 L 303.00 486.50 L 316.00 495.50 L 330.50 511.00 L 326.50 520.00 L 317.00 530.50 L 297.00 546.50 L 283.00 561.50 L 274.00 563.50 L 265.00 557.50 L 251.50 541.00 L 201.50 493.00 L 182.50 469.00 L 173.50 449.00 L 168.50 427.00 L 170.50 394.00 L 174.50 381.00 L 177.50 378.00 L 194.50 341.00 L 210.00 325.50 L 227.00 312.50 L 247.00 301.50 L 272.00 294.50 L 305.00 294.50 L 334.00 302.50 L 358.00 312.50 L 371.00 314.50 L 376.00 317.50 L 386.00 318.50 L 411.00 327.50 L 419.00 328.50 L 436.00 335.50 L 445.00 334.50 L 452.50 322.00 L 470.50 259.00 L 474.50 252.00 L 476.50 241.00 L 482.50 230.00 L 488.50 202.00 L 502.50 171.00 L 526.00 145.50 L 553.00 126.50 L 568.00 121.50 L 595.00 117.50 L 634.00 121.50 L 656.00 130.50 L 684.00 151.50 L 696.50 168.00 L 701.50 172.00 L 708.50 188.00 L 712.50 206.00 L 730.50 257.00 L 743.50 305.00 L 753.50 330.00 L 759.00 335.50 L 766.00 335.50 L 787.00 327.50 L 795.00 326.50 L 819.00 318.50 L 824.00 315.50 L 852.00 309.50 L 868.00 302.50 L 890.00 296.50 L 918.00 293.50 L 941.00 295.50 L 957.00 301.50 L 977.00 313.50 L 992.00 324.50 L 1007.50 340.00 L 1027.50 381.00 L 1032.50 397.00 L 1031.50 436.00 L 1018.50 471.00 L 1009.50 483.00 L 948.00 544.50 L 924.00 563.50 L 904.00 585.50 L 869.00 614.50 L 855.50 628.00 L 847.50 639.00 L 823.50 660.00 L 804.50 693.00 L 803.50 701.00 L 793.50 721.00 L 782.50 762.00 L 784.00 770.50 L 802.00 778.50 L 854.00 791.50 L 872.00 800.50 L 876.00 800.50 L 897.00 808.50 L 921.00 808.50 L 935.00 801.50 L 945.50 789.00 L 952.50 777.00 L 954.50 770.00 L 952.50 751.00 L 949.50 745.00 L 937.00 734.50 L 894.00 690.50 L 876.00 676.50 L 871.50 670.00 L 871.50 666.00 L 899.00 641.50 L 911.00 627.50 L 923.00 619.50 L 928.00 619.50 L 933.00 621.50 L 949.50 638.00 L 958.00 649.50 L 984.00 670.50 L 1005.50 693.00 L 1017.50 709.00 L 1024.50 722.00 L 1033.50 751.00 L 1030.50 789.00 L 1026.50 802.00 L 1011.50 827.00 L 1008.50 836.00 L 993.00 853.50 L 973.00 868.50 L 950.00 880.50 L 934.00 885.50 L 900.00 885.50 L 880.00 881.50 L 851.00 870.50 L 816.00 861.50 L 804.00 856.50 L 790.00 854.50 L 781.00 849.50 L 765.00 844.50 L 757.00 845.50 L 750.50 856.00 L 741.50 882.00 L 734.50 912.00 L 728.50 924.00 L 724.50 941.00 L 719.50 951.00 L 708.50 992.00 L 701.50 1005.00 L 684.00 1026.50 L 657.00 1045.50 L 640.00 1052.50 L 608.00 1058.50 Z M 607.50 978.00 L 626.00 971.50 L 633.50 964.00 L 638.50 955.00 L 640.50 943.00 L 644.50 934.00 L 644.50 928.00 L 647.50 924.00 L 647.50 920.00 L 660.50 889.00 L 667.50 865.00 L 671.50 843.00 L 678.50 832.00 L 683.50 818.00 L 716.50 712.00 L 739.50 654.00 L 750.50 634.00 L 778.50 597.00 L 806.00 569.50 L 810.00 567.50 L 840.00 536.50 L 877.00 504.50 L 902.00 478.50 L 937.50 448.00 L 951.50 428.00 L 953.50 408.00 L 946.50 393.00 L 931.00 376.50 L 918.00 372.50 L 903.00 372.50 L 878.00 378.50 L 847.00 391.50 L 828.00 395.50 L 786.00 409.50 L 783.50 413.00 L 784.50 420.00 L 792.50 447.00 L 801.50 469.00 L 801.50 474.00 L 806.50 485.00 L 809.50 506.00 L 799.00 514.50 L 784.00 518.50 L 752.00 531.50 L 743.00 530.50 L 737.50 526.00 L 727.50 491.00 L 712.50 454.00 L 710.50 442.00 L 705.00 435.50 L 688.00 436.50 L 675.00 439.50 L 638.00 441.50 L 559.00 438.50 L 555.50 435.00 L 554.50 426.00 L 564.50 396.00 L 567.50 376.00 L 575.00 365.50 L 656.00 366.50 L 677.00 364.50 L 680.00 363.50 L 681.50 360.00 L 679.50 350.00 L 664.50 308.00 L 660.50 288.00 L 652.50 263.00 L 648.50 258.00 L 636.50 217.00 L 632.50 211.00 L 621.00 201.50 L 596.00 199.50 L 589.00 201.50 L 586.00 200.50 L 577.00 204.50 L 565.50 218.00 L 558.50 245.00 L 549.50 266.00 L 536.50 305.00 L 529.50 336.00 L 523.50 347.00 L 511.50 380.00 L 502.50 412.00 L 489.50 445.00 L 481.50 475.00 L 466.50 516.00 L 447.50 556.00 L 415.50 597.00 L 399.00 613.50 L 390.00 618.50 L 372.50 635.00 L 364.00 646.50 L 330.00 674.50 L 313.00 691.50 L 309.00 693.50 L 299.00 705.50 L 259.50 740.00 L 250.50 754.00 L 249.50 773.00 L 257.50 788.00 L 271.00 802.50 L 282.00 807.50 L 297.00 808.50 L 309.00 806.50 L 349.00 790.50 L 396.00 779.50 L 415.00 771.50 L 417.50 769.00 L 417.50 758.00 L 405.50 715.00 L 399.50 701.00 L 396.50 683.00 L 399.50 676.00 L 409.00 667.50 L 434.00 651.50 L 449.00 646.50 L 457.00 646.50 L 462.50 651.00 L 492.50 739.00 L 498.00 744.50 L 518.00 744.50 L 550.00 738.50 L 628.00 738.50 L 642.00 741.50 L 648.50 748.00 L 648.50 758.00 L 638.50 788.00 L 635.50 804.00 L 628.00 816.50 L 623.00 818.50 L 541.00 817.50 L 529.00 819.50 L 522.50 824.00 L 523.50 831.00 L 539.50 875.00 L 545.50 901.00 L 560.50 936.00 L 567.50 963.00 L 574.00 970.50 L 582.00 975.50 L 597.00 978.50 L 607.50 978.00 Z" fill="white" fill-rule="evenodd"/>
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
        // 使用新的Pro采集引擎
        console.log('[ZCY Scraper] 使用Pro采集引擎...')
        const result = await startCollection()
        console.log('[ZCY Scraper] Pro引擎结果:', result)
        if (result.success) {
          setPushSuccess(true)
          setFabColor(COLOR_BLUE)
          setSuccessMsg("采集成功！")
        } else {
          throw new Error(result.message || '采集失败')
        }
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
    ; (params?.data?.specs || []).forEach((s: any) => {
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



