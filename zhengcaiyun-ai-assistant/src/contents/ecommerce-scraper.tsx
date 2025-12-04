import type { PlasmoCSConfig, PlasmoGetStyle, PlasmoMountShadowHost } from "plasmo"
import { useEffect, useState } from "react"

// 配置 Plasmo Content Script - 支持京东、天猫、淘宝
export const config: PlasmoCSConfig = {
    matches: [
        "https://*.jd.com/*",
        "https://*.jd.hk/*",
        "https://*.tmall.com/*",
        "https://*.tmall.hk/*",
        "https://*.taobao.com/*"
    ],
    run_at: "document_idle"
}

// Shadow Host 挂载到 body
export const mountShadowHost: PlasmoMountShadowHost = ({ shadowHost }) => {
    document.body.appendChild(shadowHost)
}

// 注入样式
export const getStyle: PlasmoGetStyle = () => {
    const style = document.createElement("style")
    style.textContent = `
        .zcy-fab-container {
            position: fixed;
            bottom: 20px;
            right: 30px;
            z-index: 2147483647;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 10px;
            pointer-events: none;
        }
        .zcy-fab-btn {
            width: 60px;
            height: 60px;
            padding: 0;
            background-color: var(--zcy-fab-bg, #0085D0);
            border: none;
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 4px 16px rgba(0, 133, 208, 0.4);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: auto;
        }
        .zcy-fab-btn:hover {
            transform: scale(1.1);
            box-shadow: 0 8px 24px rgba(0, 133, 208, 0.6);
        }
        .zcy-fab-btn:active {
            transform: scale(0.95);
        }
        .zcy-fab-img {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: block;
            background: transparent;
        }
    `
    return style
}

// 图标资源
import pngIcon from "data-base64:~assets/icon.png"
const ICON_SVG_BASE64 = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCAyMDAgMjAwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0xMDAgMzAgQzExMCAzMCwgMTE1IDQwLCAxMjAgNTUgTDEzNSA5NSBDMTQwIDEwNSwgMTU1IDEwNSwgMTYwIDk1IEwxNzUgNTUgQzE4MCA0MCwgMTk1IDQwLCAxOTUgNTUgQzE5MCA3NSwgMTc1IDkwLCAxNjAgMTAwIEwxMzAgMTIwIEMxMjAgMTI1LCAxMjAgMTQwLCAxMzAgMTQ1IEwxNjAgMTY1IEMxNzUgMTc1LCAxNzAgMTk1LCAxNTAgMTkwIEwxMTAgMTgwIEMxMDAgMTc1LCA5MCAxODUsIDk1IDE5NSBDMTAwIDIxNSwgNzUgMjE1LCA3MCAxOTUgQzc1IDE4NSwgNjUgMTc1LCA1NSAxODAgTDE1IDE5MCBDLTUgMTk1LCAtMTAgMTc1LCA1IDE2NSBMMzUgMTQ1IEM0NSAxNDAsIDQ1IDEyNSwgMzUgMTIwIEw1IDEwMCBDLTEwIDkwLCA1IDc1LCAyNSA3NSBMNDAgNzUgQzU1IDc1LCA2MCA2MCwgNjUgNDUgTDgwIDUgQzg1IC0xMCwgMTE1IC0xMCwgMTIwIDUgWiIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIxOCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9zdmc+`

// React 组件
const EcommerceScraperWidget = () => {
    const [showCopyBtn, setShowCopyBtn] = useState(false)
    const [loading, setLoading] = useState(false)
    const [fabColor, setFabColor] = useState("#0085D0")
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
            const productData = scrapePageData()
            if (!productData.title) throw new Error('无法获取商品标题，请刷新页面重试')

            // 推送到本地 dashboard/tasks
            await fetch("http://localhost:3000/api/push-tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "single",
                    link: window.location.href,
                    data: productData
                })
            })

            setPushSuccess(true)
            setFabColor("#4CAF50")
            setSuccessMsg("推送成功")
        } catch (error) {
            setPushSuccess(false)
            setSuccessMsg("推送失败: " + (error as Error).message)
        } finally {
            setLoading(false)
            setTimeout(() => {
                setPushSuccess(false)
                setFabColor("#0085D0")
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
                style={{
                    backgroundColor: fabColor,
                    boxShadow: `0 4px 16px ${fabColor === "#4CAF50" ? "rgba(76,175,80,0.4)" : "rgba(0,133,208,0.4)"}`
                }}
            >
                {loading ? (
                    <span style={{ color: 'white', fontWeight: 'bold' }}>...</span>
                ) : (
                    <img
                        className="zcy-fab-img"
                        src={pngIcon}
                        alt="政采云助手"
                        onError={e => {
                            (e.target as HTMLImageElement).src = ICON_SVG_BASE64
                        }}
                    />
                )}
            </button>
            {pushSuccess && (
                <div style={{
                    marginTop: 8,
                    background: "#4CAF50",
                    color: "#fff",
                    borderRadius: 8,
                    padding: "6px 16px",
                    fontSize: 14,
                    boxShadow: "0 2px 8px rgba(76,175,80,0.15)"
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
        category: ''
    }

    // 京东
    if (hostname.includes('jd.com')) {
        const titleEl = document.querySelector('.sku-name') || document.querySelector('h1')
        if (titleEl) data.title = titleEl.textContent?.trim() || ''
        const priceEl = document.querySelector('.price') || document.querySelector('.p-price .price')
        if (priceEl) data.price = priceEl.textContent?.replace(/[^\d.]/g, '') || ''
        const imgs = document.querySelectorAll('#spec-list img, .lh img')
        imgs.forEach((img: HTMLImageElement) => {
            let src = img.src || img.getAttribute('data-url')
            if (src) {
                src = src.replace('/n5/', '/n1/').replace('/n7/', '/n1/')
                data.images.push(src)
            }
        })
        data.shopName = '京东'
    }
    // 天猫/淘宝
    else if (hostname.includes('tmall.com') || hostname.includes('taobao.com')) {
        const titleEl = document.querySelector('.tb-main-title') || document.querySelector('h1')
        if (titleEl) data.title = titleEl.getAttribute('data-title') || titleEl.textContent?.trim() || ''
        const priceEl = document.querySelector('.tm-price') || document.querySelector('.tb-rmb-num')
        if (priceEl) data.price = priceEl.textContent?.trim() || ''
        const imgs = document.querySelectorAll('#J_UlThumb img')
        imgs.forEach((img: HTMLImageElement) => {
            let src = img.src
            if (src) {
                src = src.replace(/_\d+x\d+\.jpg.*/, '')
                data.images.push(src)
            }
        })
        data.shopName = '淘宝/天猫'
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
