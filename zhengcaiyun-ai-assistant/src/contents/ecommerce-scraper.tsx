import type { PlasmoCSConfig, PlasmoGetStyle, PlasmoMountShadowHost } from "plasmo"
import { useEffect, useState } from "react"
import { fetchWithAuth } from "../utils/api"

// 导入Pro采集引擎（新增，不影响政采云）

// 统一解析后端地址，避免“未配置后端地址”错误
// 采集核心已迁移到服务端：插件只负责触发/展示

// 配置 Plasmo Content Script - 支持京东、天猫、淘宝、苏宁
export const config: PlasmoCSConfig = {
    matches: [
        "https://*.jd.com/*",
        "https://*.jd.hk/*",
        "https://*.tmall.com/*",
        "https://*.tmall.hk/*",
        "https://*.taobao.com/*",
        "https://*.suning.com/*"
    ],
    run_at: "document_idle"
}

// Shadow Host 挂载到 body
export const mountShadowHost: PlasmoMountShadowHost = ({ shadowHost }) => {
    document.body.appendChild(shadowHost)
}

// 注入样式（与政采云保持一致）
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
            width: 50px;
            height: 50px;
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
            width: 30px;
            height: 30px;
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

// React 组件
const EcommerceScraperWidget = () => {
    const COLOR_BLUE = "#1677FF"
    const [showCopyBtn, setShowCopyBtn] = useState(false)
    const [loading, setLoading] = useState(false)
    const [fabColor, setFabColor] = useState(COLOR_BLUE)
    const [pushSuccess, setPushSuccess] = useState(false)
    const [successMsg, setSuccessMsg] = useState("")

    useEffect(() => {
        // 页面类型判断
        const checkPage = () => {
            const url = window.location.href
            const hostname = window.location.hostname
            let isProduct = false

            // 京东商品详情页
            if (hostname.includes('jd.com') && /\/\d+\.html/.test(url)) isProduct = true
            // 天猫商品详情页
            if (hostname.includes('tmall.com') && url.includes('item.htm')) isProduct = true
            // 淘宝商品详情页
            if (hostname.includes('taobao.com') && url.includes('item.htm')) isProduct = true
            // 苏宁商品详情页
            if (hostname.includes('suning.com') && /\/\d+\.html/.test(url)) isProduct = true

            setShowCopyBtn(isProduct)
        }

        // SPA监听
        const observer = new MutationObserver(() => { checkPage() })
        observer.observe(document.body, { subtree: true, childList: true })
        checkPage()
        return () => observer.disconnect()
    }, [])

    const handleCopy = async () => {
        setLoading(true)
        try {
            const currentUrl = window.location.href
            const hint = extractEcommerceHint()

            // 调试：确认发送到后端的数据
            console.log('[EcommerceScraper] 发送到后端的 hint:', {
                title: hint?.title?.substring(0, 30),
                brand: hint?.brand,
                model: hint?.model,
                imagesCount: hint?.images?.length
            })

            const resp = await fetchWithAuth("/api/plugin/copy", {
                method: "POST",
                body: JSON.stringify({ url: currentUrl, hint })
            })

            const data = await resp.json().catch(() => ({}))
            if (!resp.ok || !data?.success) {
                throw new Error(data?.error || `采集失败 (${resp.status})`)
            }

            setPushSuccess(true)
            setSuccessMsg("采集成功！")
        } catch (error) {
            setPushSuccess(true)
            setSuccessMsg("采集失败: " + (error as Error).message)
        } finally {
            setLoading(false)
            setTimeout(() => {
                setPushSuccess(false)
                setSuccessMsg("")
            }, 2000)
        }
    }

    if (!showCopyBtn) return null

    return (
        <div className="zcy-fab-container">
            <button
                className="zcy-fab-btn"
                onClick={handleCopy}
                disabled={loading}
                style={{ backgroundColor: fabColor }}
            >
                <img
                    className="zcy-fab-img"
                    src={ICON_WHITE_SVG}
                    style={loading ? { animation: "zcy-spin 1s linear infinite" } : {}}
                    alt="政采云助手"
                />
            </button>
            {pushSuccess && (
                <div style={{
                    marginTop: 8,
                    background: COLOR_BLUE,
                    color: "#fff",
                    borderRadius: 20,
                    padding: "8px 20px",
                    fontSize: 14,
                    fontWeight: 500,
                    boxShadow: "0 4px 12px rgba(22, 119, 255, 0.3)"
                }}>
                    {successMsg}
                </div>
            )}
        </div>
    )
}

export default EcommerceScraperWidget

// ========== 数据存储 ==========

// 用于存储 main-world 传来的全局变量数据
let mainWorldData: any = null

// 用于存储网络拦截的 API 数据（优先级更高）
let networkInterceptedData: Record<string, any> = {}

// ========== 消息监听 ==========

if (typeof window !== 'undefined') {
    window.addEventListener('message', (event) => {
        // 原有的 main-world 全局变量数据
        if (event.data?.type === 'ECOMMERCE_PRODUCT_DATA') {
            mainWorldData = event.data
            // 正确统计图片数量：合并 imageAndVideoJson 和 images
            const imgCount = (mainWorldData.imageAndVideoJson?.length || 0) + (mainWorldData.images?.length || 0)
            console.log('[EcommerceScraper] 收到 main-world 全局变量数据:', {
                platform: mainWorldData.platform,
                title: mainWorldData.title?.substring(0, 30) || '(无)',
                paramCount: Object.keys(mainWorldData.params || {}).length,
                colorSizeCount: (mainWorldData.colorSize || []).length,
                imageCount: imgCount
            })
        }

        // 新增：网络拦截的 API 数据（更精准）
        if (event.data?.type === 'ECOMMERCE_NETWORK_INTERCEPTED') {
            const payload = event.data.payload
            if (payload?.type && payload?.data) {
                networkInterceptedData[payload.type] = payload.data
                console.log('[EcommerceScraper] 收到网络拦截数据:', {
                    type: payload.type,
                    platform: payload.platform,
                    dataKeys: typeof payload.data === 'object' ? Object.keys(payload.data).slice(0, 5) : typeof payload.data
                })
            }
        }

        // 天猫详情图 URL
        if (event.data?.type === 'TMALL_DESC_URL' && event.data.descUrl) {
            console.log('[EcommerceScraper] 收到天猫详情图 URL:', event.data.descUrl)
            // 存储详情图 URL，在采集时使用
            mainWorldData = mainWorldData || {}
            mainWorldData.descUrl = event.data.descUrl
        }
    })
}

// ========== 数据提取入口 ==========

function extractEcommerceHint(): Record<string, any> {
    const url = window.location.href
    const hostname = window.location.hostname

    // 合并数据源：网络拦截数据 + main-world 数据
    const mergedData = {
        mainWorld: mainWorldData,
        network: networkInterceptedData
    }

    if (hostname.includes("jd.com") || hostname.includes("jd.hk")) {
        return extractJdHint(url, mainWorldData, networkInterceptedData)
    }
    if (hostname.includes("tmall.com") || hostname.includes("tmall.hk") || hostname.includes("taobao.com")) {
        return extractTmallHint(url, mainWorldData, networkInterceptedData)
    }
    if (hostname.includes("suning.com") || hostname.includes("suning.cn")) {
        return extractSuningHint(url, mainWorldData, networkInterceptedData)
    }

    return {}
}

// ========== 通用工具函数 ==========

function getMetaContent(nameOrProp: string): string {
    const el =
        document.querySelector(`meta[property="${nameOrProp}"]`) ||
        document.querySelector(`meta[name="${nameOrProp}"]`)
    return (el as HTMLMetaElement | null)?.content?.trim() || ""
}

function deriveBrandModelFromTitle(title: string): { brand: string; model: string } {
    const t = String(title || "").replace(/\s+/g, " ").trim()
    if (!t) return { brand: "", model: "" }

    const firstDigitIdx = t.search(/\d/)
    const brandPart = (firstDigitIdx > 0 ? t.slice(0, firstDigitIdx) : t.split(" ")[0] || "").trim()
    const brand = brandPart.replace(/[【】\[\]（）()]/g, "").trim()

    const modelMatch =
        t.match(/\b[A-Za-z]{0,6}\d{2,}[A-Za-z0-9\-]{0,10}\b/) ||
        t.match(/\b\d{2,}[A-Za-z][A-Za-z0-9\-]{0,10}\b/)

    const model = modelMatch ? modelMatch[0] : ""

    return { brand, model }
}

function mergeParamsIntoAttributes(attributes: Record<string, string>, params: Record<string, string>) {
    for (const [k, v] of Object.entries(params)) {
        if (!attributes[k]) {
            attributes[k] = v
        }
    }
}

// ========== 京东采集 ==========

function extractJdHint(url: string, mw?: any, networkData?: Record<string, any>): Record<string, any> {
    const text = (el: Element | null | undefined) => (el?.textContent || "").trim()
    const cleanPrice = (raw: string) => String(raw || "").replace(/[^\d.]/g, "").trim()

    const skuId = (() => {
        const m = url.match(/\/(\d+)\.html/i)
        return m ? m[1] : ""
    })()

    // 优先级：网络拦截 > main-world > DOM
    // 从网络拦截数据获取商品信息
    const netProduct = networkData?.jd_product_extracted
    const netPrice = networkData?.jd_price_extracted

    const title =
        netProduct?.title ||
        mw?.title ||
        text(document.querySelector(".sku-name")) ||
        text(document.querySelector(".itemInfo-wrap h1")) ||
        text(document.querySelector(".p-name")) ||
        (document.title || "").split("-")[0]?.trim() ||
        ""

    // 价格：优先使用网络拦截的实时价格
    let price = ""
    if (netPrice?.prices?.[0]?.price) {
        price = cleanPrice(String(netPrice.prices[0].price))
    } else if (netProduct?.price) {
        price = cleanPrice(String(netProduct.price))
    } else {
        const priceEl =
            document.querySelector(".p-price .price") ||
            (skuId ? document.querySelector(`.price.J-p-${skuId}`) : null) ||
            document.querySelector("[class*='J-p-']")
        price = cleanPrice(text(priceEl))
    }

    const normalizeImg = (raw: string) => {
        let u = String(raw || "").trim()
        if (!u) return null
        if (u.startsWith("data:")) return null
        if (u.startsWith("//")) u = `https:${u}`
        if (u.startsWith("/jfs/")) u = `https://img10.360buyimg.com/n1${u}`
        if (u.startsWith("/")) u = `https://item.jd.com${u}`
        if (u.startsWith("jfs/")) u = `https://img10.360buyimg.com/n1/${u}`
        u = u
            .replace("/n5/", "/n1/")
            .replace("/n7/", "/n1/")
            .replace("/n9/", "/n1/")
            .replace("/s54x54_jfs/", "/n1/")
            .replace("/s60x60_jfs/", "/n1/")
        if (!u.includes("360buyimg.com")) return null
        return u
    }

    const images: string[] = []
    const seen = new Set<string>()
    const addImg = (raw: string | null | undefined) => {
        if (!raw) return
        const u = normalizeImg(raw)
        if (!u || seen.has(u)) return
        seen.add(u)
        images.push(u)
    }

    // 优先级：网络拦截 > main-world > DOM
    // 1. 网络拦截的图片
    if (netProduct?.images && Array.isArray(netProduct.images)) {
        for (const img of netProduct.images) {
            addImg(typeof img === 'string' ? img : img?.url || img?.img)
        }
    }

    // 2. main-world 的图片
    if (mw?.imageAndVideoJson && Array.isArray(mw.imageAndVideoJson)) {
        for (const item of mw.imageAndVideoJson) {
            if (item.type === 1 && item.img) {
                addImg(item.img)
            }
        }
    }

    // DOM 补充
    document
        .querySelectorAll("#spec-list img, #spec-n1 img, .spec-items img, .lh img")
        .forEach((node) => {
            const img = node as HTMLImageElement
            addImg(
                img.getAttribute("data-origin") ||
                img.getAttribute("data-url") ||
                img.getAttribute("data-src") ||
                img.getAttribute("data-lazy-img") ||
                img.getAttribute("data-lazyload") ||
                img.getAttribute("src")
            )
        })

    const attributes: Record<string, string> = {}
    document
        .querySelectorAll(
            [
                "#parameter-brand li",
                "#parameter2 li",
                ".parameter2 li",
                ".p-parameter-list li",
                ".p-parameter li",
                ".Ptable-item",
                ".Ptable-item dl",
                ".Ptable-item li"
            ].join(",")
        )
        .forEach((row) => {
            const t = text(row)
            const m = t.match(/^(.+?)[:：]\s*(.+)$/)
            if (!m) return
            const k = m[1].trim()
            const v = m[2].trim()
            if (!k || !v) return
            if (k.length > 40 || v.length > 200) return
            attributes[k] = v
        })

    // 合并 main-world 参数
    if (mw?.params) {
        mergeParamsIntoAttributes(attributes, mw.params)
    }

    const brand = attributes["品牌"] || attributes["品牌名称"] || ""
    const model = attributes["型号"] || attributes["产品型号"] || attributes["规格型号"] || ""
    const derived = deriveBrandModelFromTitle(title || "")

    const detailImages: string[] = []
    const seenDetail = new Set<string>()
    const addDetail = (raw: string | null | undefined) => {
        if (!raw) return
        const u = normalizeImg(raw)
        if (!u || seenDetail.has(u)) return
        seenDetail.add(u)
        detailImages.push(u)
    }

    document
        .querySelectorAll(
            [
                "#J-detail-content img",
                "#detail img",
                ".detail-content img",
                ".product-detail img",
                "div[id*='detail'] img"
            ].join(",")
        )
        .forEach((node) => {
            const img = node as HTMLImageElement
            addDetail(
                img.getAttribute("data-origin") ||
                img.getAttribute("data-url") ||
                img.getAttribute("data-src") ||
                img.getAttribute("data-lazy-img") ||
                img.getAttribute("data-lazyload") ||
                img.getAttribute("src")
            )
        })

    // SKU 规格组 - 优先使用网络拦截数据
    const netSku = networkData?.jd_sku_extracted
    const colorSizeSource = netSku?.colorSize || netProduct?.colorSize || mw?.colorSize
    const specGroups = extractJdSpecGroups(normalizeImg, colorSizeSource)

    return {
        title: title || undefined,
        price: price || undefined,
        images: images.slice(0, 20),
        detailImages: detailImages.slice(0, 50),
        brand: brand || derived.brand || undefined,
        model: model || derived.model || undefined,
        skuId: skuId || undefined,
        specGroups: specGroups.length ? specGroups : undefined,
        attributes: Object.keys(attributes).length ? attributes : undefined
    }
}

function extractJdSpecGroups(
    normalizeImg: (raw: string) => string | null,
    colorSize?: any[]
): Array<{ name: string; values: Array<{ name: string; image?: string }> }> {
    const text = (el: Element | null | undefined) => (el?.textContent || "").trim()
    const groups: Array<{ name: string; values: Array<{ name: string; image?: string }> }> = []

    // 优先使用 main-world 的 colorSize
    if (Array.isArray(colorSize) && colorSize.length > 0) {
        for (const group of colorSize) {
            if (!group || typeof group !== 'object') continue
            const name = group.name || ''
            const values = group.values || []
            if (name && Array.isArray(values) && values.length > 0) {
                groups.push({ name, values })
            }
        }
        if (groups.length > 0) return groups
    }

    // DOM 回退
    const containers = Array.from(document.querySelectorAll("div[id^='choose-attr-']"))
    for (const c of containers) {
        const name = text(c.querySelector(".dt"))
        if (!name) continue
        if (name.includes("数量") || name.includes("服务") || name.includes("套装")) continue

        const items = Array.from(c.querySelectorAll(".dd .item"))
        const values: Array<{ name: string; image?: string }> = []

        for (const it of items) {
            const vName = text(it.querySelector("a")) || text(it)
            if (!vName) continue

            const imgEl = it.querySelector("img") as HTMLImageElement | null
            const imgRaw =
                imgEl?.getAttribute("data-url") || imgEl?.getAttribute("data-src") || imgEl?.getAttribute("src")
            const img = imgRaw ? normalizeImg(imgRaw) : null

            values.push(img ? { name: vName, image: img } : { name: vName })
        }

        if (values.length) {
            groups.push({ name, values })
        }
    }

    return groups
}

// ========== 天猫采集 ==========

function extractTmallHint(url: string, mw?: any, networkData?: Record<string, any>): Record<string, any> {
    const text = (el: Element | null | undefined) => (el?.textContent || "").trim()

    // 改进的价格清理函数 - 提取第一个有效价格
    const cleanPrice = (raw: string): string => {
        const s = String(raw || "").trim()
        if (!s) return ""
        // 匹配第一个价格模式：数字+可选小数
        const match = s.match(/(\d+(?:\.\d{1,2})?)/)
        if (match) {
            const n = parseFloat(match[1])
            if (n > 0 && n < 1000000) return match[1]
        }
        return ""
    }

    const skuId = (() => {
        const m = url.match(/[?&]id=(\d+)/i)
        return m ? m[1] : ""
    })()

    // 标题提取 - 多选择器 + 严格验证
    const extractTitle = (): string => {
        // 无效标题关键词（包含即过滤）
        const invalidKeywords = ['登录', '登陆', '天猫', '淘宝', '首页', '购物车', '我的订单', '收藏夹', '消息']

        const isValidTitle = (t: string): boolean => {
            if (!t || t.length < 5) return false
            if (invalidKeywords.some(k => t.includes(k))) return false
            // 标题应该包含一些中文或商品相关词
            if (!/[\u4e00-\u9fa5]/.test(t) && !/[A-Za-z0-9]/.test(t)) return false
            return true
        }

        // 多个选择器按优先级尝试
        const selectors = [
            ".tb-main-title",
            "[class*='ItemHeader--mainTitle']",
            "[class*='mainTitle']",
            "[class*='itemTitle']",
            "[class*='ItemTitle']",
            "h1[class*='title']",
            "h3[class*='title']",
            "#J_Title .tb-main-title",
            ".tb-detail-hd h1",
            "[data-spm*='title']",
            // 新增选择器
            "[class*='Title'] h1",
            "[class*='productTitle']",
            "[class*='product-title']",
            "h1[itemprop='name']",
            "[class*='detailPageTitle']"
        ]

        for (const sel of selectors) {
            const el = document.querySelector(sel)
            if (el) {
                const t = text(el)
                if (isValidTitle(t)) {
                    return t
                }
            }
        }

        // meta标签
        const ogTitle = getMetaContent("og:title")
        if (isValidTitle(ogTitle)) {
            return ogTitle
        }

        // document.title 回退 - 更智能的提取
        const docTitle = document.title || ""
        // 尝试提取标题中的商品名部分（通常是第一部分）
        const titleParts = docTitle.split(/[-_|【]/)
        for (const part of titleParts) {
            const cleaned = part.trim()
            if (isValidTitle(cleaned)) {
                return cleaned
            }
        }

        // 最后尝试：提取 document.title 中包含商品品牌的部分
        const brandKeywords = ['HP', '惠普', '佳能', '爱普生', '小米', '华为', '联想']
        for (const brand of brandKeywords) {
            if (docTitle.includes(brand)) {
                // 返回包含品牌的完整标题部分
                const match = docTitle.match(new RegExp(`[^-_|]*${brand}[^-_|]*`))
                if (match && isValidTitle(match[0].trim())) {
                    return match[0].trim()
                }
            }
        }

        return ""
    }

    // 优先级：网络拦截 > main-world > DOM
    const netProduct = networkData?.tmall_product_extracted
    const netSku = networkData?.tmall_sku_extracted

    // 调试：检查各来源的标题
    console.log('[Tmall extractHint] 标题来源检查:', {
        netProduct: netProduct?.title?.substring(0, 20),
        mwTitle: mw?.title?.substring(0, 20),
        extractTitle: '延迟获取'
    })

    // 标题优先级：网络拦截 > main-world > DOM
    let title = netProduct?.title || mw?.title || ''
    if (!title || title.length < 5) {
        title = extractTitle()
    }
    console.log('[Tmall extractHint] 最终标题:', title?.substring(0, 30))

    // 价格：优先使用网络拦截的实时价格
    let price = ""
    if (netProduct?.price) {
        price = cleanPrice(String(netProduct.price))
    } else if (mw?.price) {
        price = cleanPrice(String(mw.price))
    } else {
        price = cleanPrice(getMetaContent("product:price:amount") || getMetaContent("og:product:price:amount")) ||
            cleanPrice(text(document.querySelector(".tm-price"))) ||
            cleanPrice(text(document.querySelector("[class*='Price']"))) ||
            cleanPrice(text(document.querySelector("[class*='PriceBox']"))) ||
            cleanPrice(text(document.querySelector("[class*='priceWrap']"))) ||
            cleanPrice(text(document.querySelector(".tb-rmb-num"))) ||
            ""
    }

    const normalizeImg = (raw: string): string | null => {
        let u = String(raw || "").trim()
        if (!u) return null
        if (u.startsWith("data:")) return null
        if (u.startsWith("//")) u = `https:${u}`
        if (!/(alicdn\.com|tmall\.com|taobao\.com)/i.test(u)) return null
        // 转为大图
        u = u.replace(/_\d+x\d+(?:q\d+)?\.(jpg|png|webp|avif)$/i, '.$1')
            .replace(/_\d+\.(jpg|png|webp|avif)$/i, '.$1')
            .replace(/\.(jpg|png|webp|avif)_\d+x\d+\.(jpg|png|webp|avif)$/i, '.$1')
        const lower = u.toLowerCase()
        // 过滤非商品图
        if (lower.includes('avatar') || lower.includes('icon') || lower.includes('logo') ||
            lower.includes('sprite') || lower.includes('qrcode') || lower.includes('88vip') ||
            lower.includes('shopcard') || lower.includes('banner') || lower.includes('coupon')) {
            return null
        }
        return u
    }

    const images: string[] = []
    const seen = new Set<string>()
    const addImg = (raw: string | null | undefined) => {
        if (!raw) return
        const u = normalizeImg(raw)
        if (!u || seen.has(u)) return
        seen.add(u)
        images.push(u)
    }

    // 优先级：网络拦截 > main-world > DOM
    // 1. 网络拦截的图片
    if (netProduct?.images && Array.isArray(netProduct.images)) {
        for (const img of netProduct.images) {
            addImg(typeof img === 'string' ? img : img?.url || img?.img)
        }
    }

    // 2. main-world 的图片
    if (mw?.images && Array.isArray(mw.images)) {
        for (const img of mw.images) {
            addImg(img)
        }
    }

    // DOM 图片提取 - 扩展选择器
    document.querySelectorAll([
        "#J_UlThumb img",
        ".tb-gallery img",
        ".tb-thumb img",
        "[class*='PicGallery'] img",
        "[class*='mainPic'] img",
        "[class*='thumbnails'] img",
        "[class*='Thumbnail'] img",
        "[class*='ItemHeader'] img",
        "[class*='gallery'] img",
        "[class*='sku'] img[src*='alicdn']",
        "ul[class*='thumb'] img",
        ".tb-pic img"
    ].join(",")).forEach((node) => {
        const img = node as HTMLImageElement
        addImg(
            img.getAttribute("data-src") ||
            img.getAttribute("data-ks-lazyload") ||
            img.getAttribute("data-lazyload-src") ||
            img.getAttribute("src")
        )
    })

    addImg(getMetaContent("og:image"))

    const attributes: Record<string, string> = {}

    // 参数提取黑名单 - 过滤无效的键
    const paramBlacklist = ['用户评价', '服务评价', '物流评价', '评价', '评分', '销量', '成交', '收藏', '发货', '包邮', '优惠', '券']

    // 策略0: 优先从网络拦截数据获取参数（最精准）
    const netProps = netProduct?.props || netSku?.props || []
    if (Array.isArray(netProps) && netProps.length > 0) {
        for (const prop of netProps) {
            const k = String(prop?.name || prop?.attrName || prop?.key || '').trim()
            const v = String(prop?.value || prop?.attrValue || prop?.val || '').trim()
            if (k && v && k.length <= 40 && v.length <= 200) {
                if (!paramBlacklist.some(b => k.includes(b))) {
                    attributes[k] = v
                }
            }
        }
        console.log(`[Tmall] 从网络拦截获取到 ${Object.keys(attributes).length} 个参数`)
    }

    // 策略0.5: 从 main-world 数据获取参数
    if (mw?.params && typeof mw.params === 'object') {
        for (const [k, v] of Object.entries(mw.params)) {
            if (!attributes[k] && typeof v === 'string' && v.length <= 200) {
                if (!paramBlacklist.some(b => k.includes(b))) {
                    attributes[k] = v
                }
            }
        }
    }

    // 策略1: 标准选择器（DOM 回退）
    document.querySelectorAll([
        "#J_AttrUL li",
        ".tb-property-cont li",
        ".ItemPropList--item",
        "[class*='paramsInfoArea'] li",
        "[class*='paramsWrap'] li",
        "#J_AttrList li",
        "[class*='Attrs'] li",
        "[class*='attrs'] li",
        "[class*='ProductParams'] li",
        "[class*='productParams'] li",
        "[class*='DetailProp'] li",
        ".tm-attr li",
        ".attributes-list li",
        "[data-spm*='params'] li",
        "table[class*='param'] tr",
        "[class*='Specification'] tr",
        // 新增：更多天猫新版选择器
        "[class*='BasicContent'] li",
        "[class*='basicContent'] li",
        "[class*='ItemProp'] li",
        "[class*='itemProp'] li",
        "[class*='detailAttr'] li",
        "[class*='DetailAttr'] li",
        ".tb-attributes li"
    ].join(",")).forEach((el) => {
        let k = '', v = ''

        // 尝试从 tr 获取
        if (el.tagName === 'TR') {
            const tds = el.querySelectorAll('td, th')
            if (tds.length >= 2) {
                k = (tds[0].textContent || '').trim()
                v = (tds[1].textContent || '').trim()
            }
        } else {
            // 从 li 获取
            const t = (el.textContent || "").trim()
            const m = t.match(/^(.+?)[:：]\s*(.+)$/)
            if (m) {
                k = m[1].trim()
                v = m[2].trim()
            }
        }

        if (!k || !v) return
        if (k.length > 40 || v.length > 200) return
        // 过滤无效参数
        if (paramBlacklist.some(b => k.includes(b))) return
        attributes[k] = v
    })

    // 策略2: 从页面文本直接提取常见参数
    if (Object.keys(attributes).length === 0) {
        const commonParams = ['品牌', '型号', '产地', '材质', '规格', '尺寸', '颜色', '重量', '容量']
        const pageText = document.body.innerText || ''

        for (const param of commonParams) {
            const regex = new RegExp(`${param}[:：]\\s*([^\\n\\r]+)`, 'i')
            const match = pageText.match(regex)
            if (match && match[1]) {
                const v = match[1].trim().split(/\s+/)[0] // 取第一个词
                if (v && v.length <= 50 && !attributes[param]) {
                    attributes[param] = v
                }
            }
        }
    }

    // 合并 main-world 参数
    if (mw?.params) {
        mergeParamsIntoAttributes(attributes, mw.params)
    }

    const brand = attributes["品牌"] || attributes["品牌名称"] || ""
    const model = attributes["型号"] || attributes["产品型号"] || attributes["规格型号"] || ""
    const derived = deriveBrandModelFromTitle(title)

    // 详情图
    const detailImages: string[] = []
    const seenDetail = new Set<string>()
    const addDetail = (raw: string | null | undefined) => {
        if (!raw) return
        const u = normalizeImg(raw)
        if (!u || seenDetail.has(u)) return
        seenDetail.add(u)
        detailImages.push(u)
    }

    // 详情图选择器 - 包含新版天猫页面
    const detailSelectors = [
        // 新版天猫详情
        ".desc-root img",
        "[class*='descContent'] img",
        "[class*='imageTextInfo'] img",
        "[class*='descV8-singleImage'] img",
        "[class*='ItemDescModule'] img",
        // 老版天猫/淘宝详情
        "#J_DivItemDesc img",
        ".tb-detail-content img",
        "#description img",
        ".detail-content img",
        "div[id*='desc'] img",
        "div[id*='detail'] img",
        // 懒加载容器
        ".desc-lazyload-container img",
        ".ke-post img",
        // 通用详情图
        "[class*='itemDesc'] img",
        "[class*='item-desc'] img"
    ]

    document.querySelectorAll(detailSelectors.join(",")).forEach((node) => {
        const img = node as HTMLImageElement
        // 支持多种懒加载属性
        addDetail(
            img.getAttribute("data-ks-lazyload") ||
            img.getAttribute("data-src") ||
            img.getAttribute("data-lazyload-src") ||
            img.getAttribute("src")
        )
    })

    // 如果 DOM 中没有找到详情图，尝试从 main-world 数据获取详情图 URL
    if (detailImages.length === 0 && mw) {
        // 尝试获取详情图 URL 列表（如果 main-world 有提供）
        const mwDetailImages = mw.detailImages || mw.descImages || []
        if (Array.isArray(mwDetailImages)) {
            mwDetailImages.forEach((url: string) => addDetail(url))
        }
        console.log(`[Tmall] 从 main-world 获取详情图: ${detailImages.length} 张`)
    }

    // SKU 规格组 - 优先使用网络拦截数据
    const skuPropsSource = netSku?.props || netProduct?.skuProps || mw?.colorSize
    const specGroups = extractTmallSpecGroups(skuPropsSource)

    return {
        title: title || undefined,
        price: price || undefined,
        images: images.slice(0, 20),
        detailImages: detailImages.slice(0, 50),
        brand: brand || derived.brand || undefined,
        model: model || derived.model || undefined,
        skuId: skuId || undefined,
        specGroups: specGroups.length ? specGroups : undefined,
        attributes: Object.keys(attributes).length ? attributes : undefined
    }
}

function extractTmallSpecGroups(colorSize?: any[]): Array<{ name: string; values: Array<{ name: string; image?: string }> }> {
    const groups: Array<{ name: string; values: Array<{ name: string; image?: string }> }> = []

    // 优先使用 main-world 的 colorSize
    if (Array.isArray(colorSize) && colorSize.length > 0) {
        for (const group of colorSize) {
            if (!group || typeof group !== 'object') continue
            const name = group.name || ''
            const values = group.values || []
            if (name && Array.isArray(values) && values.length > 0) {
                groups.push({ name, values })
            }
        }
        if (groups.length > 0) return groups
    }

    // DOM 回退
    const text = (el: Element | null | undefined) => (el?.textContent || "").trim()
    const normalizeLabel = (s: string) => String(s || "").replace(/[:：]$/, "").trim()
    // 规格组名称黑名单（这些不是有效的规格类型）
    const blacklistNames = ['券后', '优惠', '满减', '促销', '红包', '折扣', '立减', '包邮', '活动', '赠品', '补贴']
    // 规格值黑名单（这些不是有效的 SKU 选项，而是营销标签或状态）
    const blacklistValues = [
        '多人加购', '即将售罄', '热销', '限时', '新品', '预售', '预订',
        '仅剩', '库存', '售罄', '缺货', '补货', '下架', '暂无', '无货',
        '到货通知', '加入购物车', '立即购买', '收藏', '分享'
    ]

    document.querySelectorAll([
        ".tb-prop",
        ".J_Prop",
        ".tm-sale-prop",
        "[class*='SkuPanel']",
        "[class*='skuWrapper']",
        "[class*='GeneralSkuPanel']"
    ].join(",")).forEach((block) => {
        const name = normalizeLabel(
            text(block.querySelector(".tb-property-type, .tb-metatit, .J_Prop_Title, dt")) ||
            block.getAttribute("data-type") || ""
        )

        if (!name) return
        if (blacklistNames.some(b => name.includes(b))) return

        const values: Array<{ name: string; image?: string }> = []
        block.querySelectorAll("li, [class*='valueItem'], [class*='skuItem']").forEach((li) => {
            const label = normalizeLabel(
                text(li.querySelector("a, span, div")) ||
                li.getAttribute("title") ||
                text(li)
            )
            if (!label || label.length > 50) return
            // 使用规格值黑名单过滤营销标签
            if (blacklistValues.some(b => label.includes(b))) return
            const img = (li.querySelector("img") as HTMLImageElement)?.getAttribute("src") || undefined
            values.push({ name: label, image: img })
        })

        if (values.length > 0) {
            groups.push({ name, values: values.slice(0, 50) })
        }
    })

    return groups
}

// ========== 苏宁采集 ==========

function extractSuningHint(url: string, mw?: any, networkData?: Record<string, any>): Record<string, any> {
    const text = (el: Element | null | undefined) => (el?.textContent || "").trim()
    const cleanPrice = (raw: string) => String(raw || "").replace(/[^\d.]/g, "").trim()

    const skuId = (() => {
        const m = url.match(/\/(\d+)\/(\d+)\.html/i)
        return m ? m[2] : ""
    })()

    // 优先级：网络拦截 > main-world > DOM
    const netProduct = networkData?.suning_product_extracted

    const title =
        netProduct?.title ||
        mw?.title ||
        getMetaContent("og:title") ||
        text(document.querySelector(".proinfo-title")) ||
        text(document.querySelector("#itemDisplayName")) ||
        text(document.querySelector("[class*='pro-title']")) ||
        (document.title || "").split("-")[0]?.trim() ||
        ""

    // 价格：优先使用网络拦截的实时价格
    let price = ""
    if (netProduct?.price) {
        price = cleanPrice(String(netProduct.price))
    } else if (mw?.price) {
        price = cleanPrice(String(mw.price))
    } else {
        price = cleanPrice(getMetaContent("product:price:amount") || getMetaContent("og:product:price:amount")) ||
            cleanPrice(text(document.querySelector(".mainprice"))) ||
            cleanPrice(text(document.querySelector("[class*='priceBox'] span"))) ||
            ""
    }

    const normalizeImg = (raw: string): string | null => {
        let u = String(raw || "").trim()
        if (!u) return null
        if (u.startsWith("data:")) return null
        if (u.startsWith("//")) u = `https:${u}`
        u = u.replace(/^http:/i, "https:")

        try {
            u = new URL(u, location.href).toString()
        } catch { return null }

        if (!/(suning\.(cn|com)|cnsuningimg\.com|uimg\.(cn|com))/i.test(u)) return null
        u = u.replace(/_\d+x\d+_/g, "_800x800_")
            .replace(/_\d+w_\d+h_/g, "_800w_800h_")
        return u
    }

    const images: string[] = []
    const seen = new Set<string>()
    const addImg = (raw: string | null | undefined) => {
        if (!raw) return
        const u = normalizeImg(raw)
        if (!u || seen.has(u)) return
        seen.add(u)
        images.push(u)
    }

    // 优先级：网络拦截 > main-world > DOM
    // 1. 网络拦截的图片
    if (netProduct?.images && Array.isArray(netProduct.images)) {
        for (const img of netProduct.images) {
            addImg(typeof img === 'string' ? img : img?.url || img?.img)
        }
    }

    // 2. main-world 的图片
    if (mw?.images && Array.isArray(mw.images)) {
        for (const img of mw.images) {
            addImg(img)
        }
    }

    // DOM 补充
    document.querySelectorAll([
        "#imageZoom img",
        "#bigImg",
        "img[id*='bigImg']",
        ".imgzoom-thumb-main img",
        "ul.imgzoom-thumb li img",
        ".imgzoom-thumb img",
        "img[src*='suning']",
        "img[data-src*='suning']"
    ].join(",")).forEach((node) => {
        const img = node as HTMLImageElement
        addImg(
            img.getAttribute("src2") ||
            img.getAttribute("data-src2") ||
            img.getAttribute("src-large") ||
            img.getAttribute("data-original") ||
            img.getAttribute("data-src") ||
            img.getAttribute("src")
        )
    })

    addImg(getMetaContent("og:image"))

    const attributes: Record<string, string> = {}
    document.querySelectorAll([
        ".pro-detail-parameter li",
        ".procon-param li",
        "#kernelParmeter li",
        ".pro-parameters li",
        ".proinfo-param li",
        ".product-params li",
        ".parameter-item",
        "[class*='paramItem']"
    ].join(",")).forEach((li) => {
        const t = (li.textContent || "").trim()
        const m = t.match(/^(.+?)[:：]\s*(.+)$/)
        if (!m) return
        const k = m[1].trim()
        const v = m[2].trim()
        if (!k || !v) return
        if (k.length > 40 || v.length > 200) return
        attributes[k] = v
    })

    // 合并 main-world 参数
    if (mw?.params) {
        mergeParamsIntoAttributes(attributes, mw.params)
    }

    const brand = attributes["品牌"] || attributes["品牌名称"] || ""
    const model = attributes["型号"] || attributes["产品型号"] || attributes["规格型号"] || ""
    const derived = deriveBrandModelFromTitle(title)

    // 详情图
    const detailImages: string[] = []
    const seenDetail = new Set<string>()
    const addDetail = (raw: string | null | undefined) => {
        if (!raw) return
        const u = normalizeImg(raw)
        if (!u || seenDetail.has(u)) return
        seenDetail.add(u)
        detailImages.push(u)
    }

    document.querySelectorAll([
        "#productDetail img",
        ".product-detail img",
        ".detail-content img",
        "div[id*='detail'] img",
        "div[class*='proDetail'] img"
    ].join(",")).forEach((node) => {
        const img = node as HTMLImageElement
        addDetail(img.getAttribute("data-src") || img.getAttribute("src"))
    })

    // SKU 规格组
    const specGroups = extractSuningSpecGroups(mw?.colorSize)

    return {
        title: title || undefined,
        price: price || undefined,
        images: images.slice(0, 20),
        detailImages: detailImages.slice(0, 50),
        brand: brand || derived.brand || undefined,
        model: model || derived.model || undefined,
        skuId: skuId || undefined,
        specGroups: specGroups.length ? specGroups : undefined,
        attributes: Object.keys(attributes).length ? attributes : undefined
    }
}

function extractSuningSpecGroups(colorSize?: any[]): Array<{ name: string; values: Array<{ name: string; image?: string }> }> {
    const groups: Array<{ name: string; values: Array<{ name: string; image?: string }> }> = []

    // 优先使用 main-world 的 colorSize
    if (Array.isArray(colorSize) && colorSize.length > 0) {
        for (const group of colorSize) {
            if (!group || typeof group !== 'object') continue
            const name = group.name || ''
            const values = group.values || []
            if (name && Array.isArray(values) && values.length > 0) {
                groups.push({ name, values })
            }
        }
        if (groups.length > 0) return groups
    }

    // DOM 回退
    const text = (el: Element | null | undefined) => (el?.textContent || "").trim()
    const normalizeLabel = (s: string) => String(s || "").replace(/[:：]$/, "").trim()

    document.querySelectorAll([
        ".choose-attr-box",
        ".color-choose",
        ".size-choose",
        "[class*='proChoose']",
        "[class*='sku-choose']",
        ".prop-box",
        ".proinfo-spec",
        "#colorItemList",
        "#versionItemList",
        "[id*='ItemList']"
    ].join(",")).forEach((block) => {
        const name = normalizeLabel(
            text(block.querySelector(".dt, .title, label, [class*='title'], dt")) ||
            block.getAttribute("data-title") || ""
        )

        if (!name) return

        const values: Array<{ name: string; image?: string }> = []
        block.querySelectorAll("li, dd, a[data-value], [class*='item']").forEach((li) => {
            const label = normalizeLabel(
                li.getAttribute("title") ||
                li.getAttribute("data-value") ||
                text(li)
            )
            if (!label || label.length > 50) return
            const img = (li.querySelector("img") as HTMLImageElement)?.getAttribute("src") || undefined
            values.push({ name: label, image: img })
        })

        if (values.length > 0) {
            groups.push({ name, values: values.slice(0, 50) })
        }
    })

    return groups
}
