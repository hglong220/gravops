import type { PlasmoCSConfig, PlasmoGetStyle, PlasmoMountShadowHost } from "plasmo"
import { useEffect, useState } from "react"

// 导入Pro采集引擎（新增，不影响政采云）
import { scrapeJDPro } from "../utils/scraper.jd.pro"
import { scrapeTmallPro } from "../utils/scraper.tmall.pro"
import { scrapeSuningPro } from "../utils/scraper.suning.pro"

// 统一解析后端地址，避免“未配置后端地址”错误
const resolveBackendUrl = () =>
    process.env.PLASMO_PUBLIC_BACKEND_URL ||
    (window as any).PLASMO_PUBLIC_BACKEND_URL ||
    localStorage.getItem("BACKEND_URL") ||
    "http://localhost:3000"

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
            const BACKEND_URL = resolveBackendUrl();
            if (!BACKEND_URL) throw new Error('未配置后端地址');
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
