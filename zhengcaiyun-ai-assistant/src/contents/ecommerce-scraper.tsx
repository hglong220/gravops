import type { PlasmoCSConfig, PlasmoGetStyle, PlasmoMountShadowHost } from "plasmo"
import { useEffect, useState } from "react"

// 导入Pro采集引擎（新增，不影响政采云）
import { scrapeJDPro } from "../utils/scraper.jd.pro"
import { scrapeTmallPro } from "../utils/scraper.tmall.pro"
import { scrapeSuningPro } from "../utils/scraper.suning.pro"

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

// 白色星形图标（与政采云一致）
const ICON_WHITE_SVG = `data:image/svg+xml;base64,${btoa(`
<svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M100 15c7 0 12 6 15 13l13 35c3 8 12 12 20 9l35-13c7-3 13 0 16 7 3 7-1 14-7 18l-30 21c-7 5-9 14-4 21l21 30c5 6 5 13-1 18-6 5-14 4-19-1l-27-25c-6-6-16-5-21 1l-23 28c-5 6-12 7-18 2-6-5-7-12-4-19l14-34c3-8 0-17-8-20l-35-14c-7-3-11-10-8-17s10-11 17-9l36 10c8 2 16-3 18-11l9-36c2-7 8-13 15-13Z" stroke="white" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" />
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
            const hostname = window.location.hostname
            let productData: any

            // 根据平台选择Pro采集引擎（新增逻辑，不影响政采云）
            if (hostname.includes('jd.com')) {
                productData = await scrapeJDPro()
            } else if (hostname.includes('tmall.com') || hostname.includes('taobao.com')) {
                productData = await scrapeTmallPro()
            } else if (hostname.includes('suning.com')) {
                productData = await scrapeSuningPro()
            } else {
                productData = scrapePageData() // 兜底使用原逻辑
            }

            if (!productData.title) throw new Error('无法获取商品标题，请刷新页面重试')

            // 转换Pro引擎输出格式
            const pushData = {
                originalUrl: productData.url || window.location.href,
                title: productData.title,
                price: String(productData.price || '0'),
                images: productData.images || [],
                attributes: productData.specs || {},
                shopName: productData.platform || '电商平台',
                brand: productData.specs?.['品牌'] || '',
                model: productData.specs?.['型号'] || '',
                // 新增：SKU多规格数据（政采云兼容格式）
                skuData: productData.skuData || null
            }

            // 推送到本地 dashboard/tasks
            await fetch("http://localhost:3000/api/push-tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "single",
                    link: window.location.href,
                    data: pushData
                })
            })

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
                {loading ? (
                    <span style={{
                        width: 24,
                        height: 24,
                        border: '3px solid rgba(255,255,255,0.3)',
                        borderTop: '3px solid white',
                        borderRadius: '50%',
                        animation: 'zcy-spin 1s linear infinite'
                    }} />
                ) : (
                    <img
                        className="zcy-fab-img"
                        src={ICON_WHITE_SVG}
                        alt="政采云助手"
                    />
                )}
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

// 采集数据逻辑
function scrapePageData() {
    const url = window.location.href
    const hostname = window.location.hostname
    let data = {
        originalUrl: url,
        title: '',
        price: '0',
        images: [] as string[],
        attributes: {} as Record<string, string>,
        detailHtml: '',
        shopName: '',
        category: '',
        brand: '',
        model: ''
    }

    // 通用图片采集函数 - 收集页面上所有大尺寸商品图
    const collectImages = () => {
        const imgs: string[] = []
        document.querySelectorAll('img').forEach((img: HTMLImageElement) => {
            let src = img.src || img.getAttribute('data-src') || img.getAttribute('data-url') || img.getAttribute('data-lazy-img')
            if (!src) return
            // 过滤掉小图标、视频、base64
            if (src.includes('data:image')) return
            if (src.includes('video') || src.includes('.mp4') || src.includes('play')) return
            if (img.width < 100 && img.height < 100 && img.naturalWidth < 100) return
            // 转换为高清
            src = src.replace(/\/n\d+\//, '/n1/')
            src = src.replace(/_\d+x\d+[^.]*\.(jpg|png|webp)/i, '.$1')
            src = src.replace(/_60x60\.jpg/i, '')
            // 去重
            if (!imgs.includes(src)) imgs.push(src)
        })
        return imgs.slice(0, 15)  // 最多15张
    }

    // 通用标题采集 - 从页面title提取
    const getTitle = () => {
        // 页面标题通常是：商品名 - 平台名
        let title = document.title.split(/[-–—|_]/)[0].trim()
        // 去掉平台后缀
        title = title.replace(/京东|天猫|淘宝|苏宁|tmall|taobao|jd|suning/gi, '').trim()
        return title
    }

    // 京东
    if (hostname.includes('jd.com')) {
        // 标题 - 优先尝试选择器，失败则用页面title
        let title = ''
        const titleEl = document.querySelector('.sku-name, .itemInfo-wrap .sku-name, h1')
        if (titleEl?.textContent?.trim()?.length > 5) {
            title = titleEl.textContent.trim()
        }
        if (!title) title = getTitle()
        data.title = title

        // 价格
        const priceText = document.body.innerText.match(/[¥￥]\s*(\d+\.?\d*)/)?.[1] || ''
        data.price = priceText

        // 主图
        data.images = collectImages()

        // 尝试从页面文本提取品牌
        const brandMatch = document.body.innerText.match(/品牌[：:]\s*([^\s\n]+)/)
        if (brandMatch) data.brand = brandMatch[1]

        data.shopName = '京东'
        console.log('[JD采集] 标题:', data.title?.substring(0, 30), '图片:', data.images.length)
    }
    // 天猫/淘宝
    else if (hostname.includes('tmall.com') || hostname.includes('taobao.com')) {
        // 标题
        let title = ''
        const titleEl = document.querySelector('[class*="mainTitle"], .tb-main-title, h1')
        if (titleEl?.textContent?.trim()?.length > 5) {
            title = titleEl.textContent.trim()
        }
        if (!title) title = getTitle()
        data.title = title

        // 价格
        const priceText = document.body.innerText.match(/[¥￥]\s*(\d+\.?\d*)/)?.[1] || ''
        data.price = priceText

        // 主图
        data.images = collectImages()

        // 品牌
        const brandMatch = document.body.innerText.match(/品牌[：:]\s*([^\s\n]+)/)
        if (brandMatch) data.brand = brandMatch[1]

        data.shopName = '淘宝/天猫'
        console.log('[天猫采集] 标题:', data.title?.substring(0, 30), '图片:', data.images.length)
    }
    // 苏宁
    else if (hostname.includes('suning.com')) {
        // 标题
        let title = ''
        const titleEl = document.querySelector('.proinfo-title, #itemDisplayName, h1')
        if (titleEl?.textContent?.trim()?.length > 5) {
            title = titleEl.textContent.trim()
        }
        if (!title) title = getTitle()
        data.title = title

        // 价格
        const priceEl = document.querySelector('.mainprice, #promotionPrice')
        if (priceEl) data.price = priceEl.textContent?.replace(/[^\d.]/g, '') || ''

        // 主图
        data.images = collectImages()

        // 品牌
        const brandEl = document.querySelector('.proinfo-brand a')
        if (brandEl) data.brand = brandEl.textContent?.trim() || ''

        data.shopName = '苏宁'
        console.log('[苏宁采集] 标题:', data.title?.substring(0, 30), '图片:', data.images.length)
    }

    if (!data.title) data.title = document.title
    data.title = data.title.trim()
    data.images = [...new Set(data.images)].slice(0, 10)

    // Category Extraction
    let categoryParts: string[] = []

    // 1. Try Breadcrumbs (DOM)
    if (hostname.includes('jd.com')) {
        const crumbs = document.querySelectorAll('#crumb-wrap .crumb a, .breadcrumb a, .w .breadcrumb a, .mbreadcrumb a, #ur-here a')
        crumbs.forEach(el => categoryParts.push(el.textContent?.trim() || ''))
    } else if (hostname.includes('tmall.com') || hostname.includes('taobao.com')) {
        const crumbs = document.querySelectorAll('.tm-breadcrumbs a, #J_Crumb a, .tb-breadcrumb a, .ui-breadcrumb a')
        crumbs.forEach(el => categoryParts.push(el.textContent?.trim() || ''))
    }

    // 2. Fallback: Meta Tags (Keywords often contain category structure)
    if (categoryParts.length === 0) {
        const keywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content');
        if (keywords) {
            // JD/Tmall keywords often look like "Brand, Model, Category, Subcategory"
            // We can try to use it as a rough category path
            categoryParts.push(keywords.split(',')[0]);
        }
    }

    // 3. Fallback: Script Data (JSON-LD or internal vars)
    if (categoryParts.length === 0) {
        // Try to find specific JS variables if possible (advanced)
        // For now, let's stick to DOM and Meta
    }

    // Filter and Join
    // Remove common non-category words like "首页", "Home", "全部商品"
    const ignoreWords = ['首页', 'Home', '全部商品', '全部结果'];
    data.category = categoryParts
        .map(s => s.trim())
        .filter(s => s && !ignoreWords.includes(s))
        .join('/');

    if (!data.category) {
        console.warn('Category extraction failed');
        data.category = '未分类'; // Mark as unclassified so user knows
    }

    return data
}

export default EcommerceScraperWidget
