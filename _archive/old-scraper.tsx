import type { PlasmoCSConfig, PlasmoGetStyle, PlasmoMountShadowHost } from "plasmo"
import { useEffect, useState } from "react"

// 瀵煎叆Pro閲囬泦寮曟搸锛堟柊澧烇紝涓嶅奖鍝嶆斂閲囦簯锛?import { scrapeJDPro } from "../utils/scraper.jd.pro"
import { scrapeTmallPro } from "../utils/scraper.tmall.pro"
import { scrapeSuningPro } from "../utils/scraper.suning.pro"

// 閰嶇疆 Plasmo Content Script - 鏀寔浜笢銆佸ぉ鐚€佹窐瀹濄€佽嫃瀹?export const config: PlasmoCSConfig = {
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

// Shadow Host 鎸傝浇鍒?body
export const mountShadowHost: PlasmoMountShadowHost = ({ shadowHost }) => {
    document.body.appendChild(shadowHost)
}

// 娉ㄥ叆鏍峰紡锛堜笌鏀块噰浜戜繚鎸佷竴鑷达級
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

// 鐧借壊鏄熷舰鍥炬爣锛堜笌鏀块噰浜戜竴鑷达級
const ICON_WHITE_SVG = `data:image/svg+xml;base64,${btoa(`
<svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M100 15c7 0 12 6 15 13l13 35c3 8 12 12 20 9l35-13c7-3 13 0 16 7 3 7-1 14-7 18l-30 21c-7 5-9 14-4 21l21 30c5 6 5 13-1 18-6 5-14 4-19-1l-27-25c-6-6-16-5-21 1l-23 28c-5 6-12 7-18 2-6-5-7-12-4-19l14-34c3-8 0-17-8-20l-35-14c-7-3-11-10-8-17s10-11 17-9l36 10c8 2 16-3 18-11l9-36c2-7 8-13 15-13Z" stroke="white" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" />
</svg>
`)}`

// React 缁勪欢
const EcommerceScraperWidget = () => {
    const COLOR_BLUE = "#1677FF"
    const [showCopyBtn, setShowCopyBtn] = useState(false)
    const [loading, setLoading] = useState(false)
    const [fabColor, setFabColor] = useState(COLOR_BLUE)
    const [pushSuccess, setPushSuccess] = useState(false)
    const [successMsg, setSuccessMsg] = useState("")

    useEffect(() => {
        // 椤甸潰绫诲瀷鍒ゆ柇
        const checkPage = () => {
            const url = window.location.href
            const hostname = window.location.hostname
            let isProduct = false

            // 浜笢鍟嗗搧璇︽儏椤?            if (hostname.includes('jd.com') && /\/\d+\.html/.test(url)) isProduct = true
            // 澶╃尗鍟嗗搧璇︽儏椤?            if (hostname.includes('tmall.com') && url.includes('item.htm')) isProduct = true
            // 娣樺疂鍟嗗搧璇︽儏椤?            if (hostname.includes('taobao.com') && url.includes('item.htm')) isProduct = true
            // 鑻忓畞鍟嗗搧璇︽儏椤?            if (hostname.includes('suning.com') && /\/\d+\.html/.test(url)) isProduct = true

            setShowCopyBtn(isProduct)
        }

        // SPA鐩戝惉
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

            // 鏍规嵁骞冲彴閫夋嫨Pro閲囬泦寮曟搸锛堟柊澧為€昏緫锛屼笉褰卞搷鏀块噰浜戯級
            if (hostname.includes('jd.com')) {
                productData = await scrapeJDPro()
            } else if (hostname.includes('tmall.com') || hostname.includes('taobao.com')) {
                productData = await scrapeTmallPro()
            } else if (hostname.includes('suning.com')) {
                productData = await scrapeSuningPro()
            } else {
                productData = scrapePageData() // 鍏滃簳浣跨敤鍘熼€昏緫
            }

            if (!productData.title) throw new Error('鏃犳硶鑾峰彇鍟嗗搧鏍囬锛岃鍒锋柊椤甸潰閲嶈瘯')

            // 杞崲Pro寮曟搸杈撳嚭鏍煎紡
            const pushData = {
                originalUrl: productData.url || window.location.href,
                title: productData.title,
                price: String(productData.price || '0'),
                images: productData.images || [],
                attributes: productData.specs || {},
                shopName: productData.platform || '鐢靛晢骞冲彴',
                brand: productData.specs?.['鍝佺墝'] || '',
                model: productData.specs?.['鍨嬪彿'] || '',
                // 鏂板锛歋KU澶氳鏍兼暟鎹紙鏀块噰浜戝吋瀹规牸寮忥級
                skuData: productData.skuData || null
            }

            // 鎺ㄩ€佸埌鏈湴 dashboard/tasks
            const BACKEND_URL = process.env.PLASMO_PUBLIC_BACKEND_URL || '';
            if (!BACKEND_URL) throw new Error('鏈厤缃悗绔湴鍧€');
            await fetch(`${BACKEND_URL}/api/push-tasks`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "single",
                    link: window.location.href,
                    data: pushData
                })
            })

            setPushSuccess(true)
            setSuccessMsg("閲囬泦鎴愬姛锛?)
        } catch (error) {
            setPushSuccess(true)
            setSuccessMsg("閲囬泦澶辫触: " + (error as Error).message)
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
                        alt="鏀块噰浜戝姪鎵?
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

// 閲囬泦鏁版嵁閫昏緫
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

    // 閫氱敤鍥剧墖閲囬泦鍑芥暟 - 鏀堕泦椤甸潰涓婃墍鏈夊ぇ灏哄鍟嗗搧鍥?    const collectImages = () => {
        const imgs: string[] = []
        document.querySelectorAll('img').forEach((img: HTMLImageElement) => {
            let src = img.src || img.getAttribute('data-src') || img.getAttribute('data-url') || img.getAttribute('data-lazy-img')
            if (!src) return
            // 杩囨护鎺夊皬鍥炬爣銆佽棰戙€乥ase64
            if (src.includes('data:image')) return
            if (src.includes('video') || src.includes('.mp4') || src.includes('play')) return
            if (img.width < 100 && img.height < 100 && img.naturalWidth < 100) return
            // 杞崲涓洪珮娓?            src = src.replace(/\/n\d+\//, '/n1/')
            src = src.replace(/_\d+x\d+[^.]*\.(jpg|png|webp)/i, '.$1')
            src = src.replace(/_60x60\.jpg/i, '')
            // 鍘婚噸
            if (!imgs.includes(src)) imgs.push(src)
        })
        return imgs.slice(0, 15)  // 鏈€澶?5寮?    }

    // 閫氱敤鏍囬閲囬泦 - 浠庨〉闈itle鎻愬彇
    const getTitle = () => {
        // 椤甸潰鏍囬閫氬父鏄細鍟嗗搧鍚?- 骞冲彴鍚?        let title = document.title.split(/[-鈥撯€攟_]/)[0].trim()
        // 鍘绘帀骞冲彴鍚庣紑
        title = title.replace(/浜笢|澶╃尗|娣樺疂|鑻忓畞|tmall|taobao|jd|suning/gi, '').trim()
        return title
    }

    // 浜笢
    if (hostname.includes('jd.com')) {
        // 鏍囬 - 浼樺厛灏濊瘯閫夋嫨鍣紝澶辫触鍒欑敤椤甸潰title
        let title = ''
        const titleEl = document.querySelector('.sku-name, .itemInfo-wrap .sku-name, h1')
        if (titleEl?.textContent?.trim()?.length > 5) {
            title = titleEl.textContent.trim()
        }
        if (!title) title = getTitle()
        data.title = title

        // 浠锋牸
        const priceText = document.body.innerText.match(/[楼锟\s*(\d+\.?\d*)/)?.[1] || ''
        data.price = priceText

        // 涓诲浘
        data.images = collectImages()

        // 灏濊瘯浠庨〉闈㈡枃鏈彁鍙栧搧鐗?        const brandMatch = document.body.innerText.match(/鍝佺墝[锛?]\s*([^\s\n]+)/)
        if (brandMatch) data.brand = brandMatch[1]

        data.shopName = '浜笢'
        console.log('[JD閲囬泦] 鏍囬:', data.title?.substring(0, 30), '鍥剧墖:', data.images.length)
    }
    // 澶╃尗/娣樺疂
    else if (hostname.includes('tmall.com') || hostname.includes('taobao.com')) {
        // 鏍囬
        let title = ''
        const titleEl = document.querySelector('[class*="mainTitle"], .tb-main-title, h1')
        if (titleEl?.textContent?.trim()?.length > 5) {
            title = titleEl.textContent.trim()
        }
        if (!title) title = getTitle()
        data.title = title

        // 浠锋牸
        const priceText = document.body.innerText.match(/[楼锟\s*(\d+\.?\d*)/)?.[1] || ''
        data.price = priceText

        // 涓诲浘
        data.images = collectImages()

        // 鍝佺墝
        const brandMatch = document.body.innerText.match(/鍝佺墝[锛?]\s*([^\s\n]+)/)
        if (brandMatch) data.brand = brandMatch[1]

        data.shopName = '娣樺疂/澶╃尗'
        console.log('[澶╃尗閲囬泦] 鏍囬:', data.title?.substring(0, 30), '鍥剧墖:', data.images.length)
    }
    // 鑻忓畞
    else if (hostname.includes('suning.com')) {
        // 鏍囬
        let title = ''
        const titleEl = document.querySelector('.proinfo-title, #itemDisplayName, h1')
        if (titleEl?.textContent?.trim()?.length > 5) {
            title = titleEl.textContent.trim()
        }
        if (!title) title = getTitle()
        data.title = title

        // 浠锋牸
        const priceEl = document.querySelector('.mainprice, #promotionPrice')
        if (priceEl) data.price = priceEl.textContent?.replace(/[^\d.]/g, '') || ''

        // 涓诲浘
        data.images = collectImages()

        // 鍝佺墝
        const brandEl = document.querySelector('.proinfo-brand a')
        if (brandEl) data.brand = brandEl.textContent?.trim() || ''

        data.shopName = '鑻忓畞'
        console.log('[鑻忓畞閲囬泦] 鏍囬:', data.title?.substring(0, 30), '鍥剧墖:', data.images.length)
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
    // Remove common non-category words like "棣栭〉", "Home", "鍏ㄩ儴鍟嗗搧"
    const ignoreWords = ['棣栭〉', 'Home', '鍏ㄩ儴鍟嗗搧', '鍏ㄩ儴缁撴灉'];
    data.category = categoryParts
        .map(s => s.trim())
        .filter(s => s && !ignoreWords.includes(s))
        .join('/');

    if (!data.category) {
        console.warn('Category extraction failed');
        data.category = '鏈垎绫?; // Mark as unclassified so user knows
    }

    return data
}

export default EcommerceScraperWidget
