/**
 * E-commerce Main World Script
 * 运行在页面主世界(MAIN)，可以直接访问 window 全局变量
 * 
 * 负责从京东、天猫、苏宁等电商页面提取全局JS变量中的商品数据
 * 并通过 postMessage 发送给内容脚本
 */

import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
    matches: [
        "https://item.jd.com/*",
        "https://item.m.jd.com/*",
        "https://detail.tmall.com/*",
        "https://detail.tmall.hk/*",
        "https://chaoshi.detail.tmall.com/*",
        "https://product.suning.com/*"
    ],
    world: "MAIN",
    run_at: "document_idle"
}

// ========== 通用工具函数 ==========

function getMetaContent(nameOrProp: string): string {
    const el =
        document.querySelector(`meta[property="${nameOrProp}"]`) ||
        document.querySelector(`meta[name="${nameOrProp}"]`)
    return (el as HTMLMetaElement | null)?.content?.trim() || ""
}

function cleanNumericPrice(raw: any): string {
    const s = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw : ''
    const cleaned = s.replace(/[^\d.]/g, '').trim()
    if (!cleaned) return ''
    const n = Number.parseFloat(cleaned)
    if (!Number.isFinite(n) || n <= 0) return ''
    if (n > 1_000_000) return ''
    return cleaned
}

// ========== 京东全局变量提取 ==========

function extractJDGlobalData(): any {
    const win = window as any

    const sources = [
        { key: '___data', path: null },
        { key: 'skuInfo', path: null },
        { key: 'product', path: null },
        { key: 'pageConfig', path: 'product' },
        { key: '__NUXT__', path: 'data' },
        { key: '__GLOBAL_MAIN__', path: null },
        { key: 'itemData', path: null }
    ]

    for (const source of sources) {
        try {
            let data = win[source.key]
            if (data && source.path) {
                data = data[source.path]
            }
            if (data) {
                console.log(`[JD MainWorld] 找到变量: ${source.key}`, Object.keys(data).slice(0, 5))
                return { source: source.key, data }
            }
        } catch { }
    }

    return null
}

/**
 * 提取京东colorSize数据（包含所有SKU规格）
 */
function extractJDColorSize(): any[] {
    const win = window as any

    const paths = [
        () => win.colorSize,
        () => win.pageConfig?.product?.colorSize,
        () => win.itemConfig?.colorSize,
        () => win.itemData?.sku?.colorSize,
        () => win.skuInfo?.colorSize,
        () => {
            for (const key of Object.keys(win)) {
                try {
                    const val = win[key]
                    if (val && typeof val === 'object') {
                        if (Array.isArray(val.colorSize) && val.colorSize.length > 0) {
                            console.log(`[JD MainWorld] 发现colorSize在window.${key}`)
                            return val.colorSize
                        }
                        if (val.product?.colorSize?.length > 0) {
                            console.log(`[JD MainWorld] 发现colorSize在window.${key}.product`)
                            return val.product.colorSize
                        }
                    }
                } catch { }
            }
            return null
        }
    ]

    for (const getter of paths) {
        try {
            const colorSize = getter()
            if (Array.isArray(colorSize) && colorSize.length > 0) {
                console.log(`[JD MainWorld] 成功获取colorSize: ${colorSize.length}个SKU`)
                return processJDColorSize(colorSize)
            }
        } catch { }
    }

    console.log('[JD MainWorld] 未找到colorSize')
    return []
}

/**
 * 处理京东colorSize数据，提取规格组
 */
function processJDColorSize(colorSize: any[]): any[] {
    const specGroups: any[] = []
    const specMap: Record<string, Set<string>> = {}

    // 需要排除的键
    const excludeKeys = new Set([
        'skuId', 'stock', 'jdPrice', 'price', 'originalPrice',
        'costPrice', 'marketPrice', 'venderId', 'shopId', 'status',
        'presale', 'yushouId', 'skuStateId', 'saleState', 'img'
    ])

    for (const sku of colorSize) {
        if (!sku || typeof sku !== 'object') continue

        for (const [key, value] of Object.entries(sku)) {
            if (excludeKeys.has(key)) continue
            if (typeof value !== 'string') continue
            const v = String(value).trim()
            if (!v || v.length > 50) continue

            // 检查是否是规格属性（通常是中文名称）
            if (!/[\u4e00-\u9fa5]/.test(key) && !/颜色|版本|尺寸|容量|规格|套装|配置/.test(key)) {
                continue
            }

            if (!specMap[key]) specMap[key] = new Set()
            specMap[key].add(v)
        }
    }

    for (const [name, values] of Object.entries(specMap)) {
        specGroups.push({
            name,
            values: Array.from(values).map(v => ({ name: v }))
        })
    }

    console.log(`[JD MainWorld] 从colorSize解析出${specGroups.length}个规格组`)
    return specGroups
}

/**
 * 提取京东 imageAndVideoJson（主图/视频列表）
 */
function extractJDImageAndVideoJson(): any[] {
    const win = window as any

    const getters: Array<{ desc: string, getter: () => any }> = [
        { desc: 'pageConfig.product', getter: () => win.pageConfig?.product?.imageAndVideoJson },
        { desc: 'pageConfig', getter: () => win.pageConfig?.imageAndVideoJson },
        { desc: 'itemData', getter: () => win.itemData?.imageAndVideoJson },
        { desc: 'itemConfig', getter: () => win.itemConfig?.imageAndVideoJson },
        { desc: 'PCDetailClient.resJs', getter: () => win.PCDetailClient?.product?.resJs?.['product.detail']?.data?.product?.imageAndVideoJson },
        { desc: 'PCDetailClient.resCore', getter: () => win.PCDetailClient?.product?.resCore?.['product.detail']?.data?.product?.imageAndVideoJson },
        { desc: '___data.product', getter: () => win.___data?.product?.imageAndVideoJson },
        { desc: '__INIT_DATA__.product', getter: () => win.__INIT_DATA__?.product?.imageAndVideoJson },
        { desc: 'product', getter: () => win.product?.imageAndVideoJson },
    ]

    for (const { desc, getter } of getters) {
        try {
            const val = getter()
            if (Array.isArray(val) && val.length > 0) {
                console.log(`[JD MainWorld] 使用${desc}.imageAndVideoJson:`, val.length, '项')
                return val
            }
        } catch { }
    }

    // DOM兜底
    console.log('[JD MainWorld] 未找到imageAndVideoJson变量，使用DOM提取...')
    const domImages: any[] = []
    const seen = new Set<string>()

    const normalizeToBase = (rawUrl: string): string => {
        if (!rawUrl) return ''
        let u = rawUrl.trim()
        if (u.startsWith('//')) u = 'https:' + u
        u = u.replace(/^http:/, 'https:')
        u = u.replace(/s\d+x\d+_jfs/gi, 'jfs')
        u = u.replace(/\/s\d+x\d+_/g, '/')
        u = u.replace(/s\d+x\d+_/g, '')
        u = u.replace(/\/n[579]\//g, '/n1/')
        return u
    }

    const selectors = [
        '#spec-list li img',
        '#spec-n1 img',
        '.preview-list li img',
        '.spec-items li img',
        '.lh li:not(.video-item) img',
        '.plist li img'
    ]

    for (const sel of selectors) {
        document.querySelectorAll(sel).forEach((img: Element) => {
            const imgEl = img as HTMLImageElement
            const li = imgEl.closest('li')
            if (li?.classList.contains('video-item') || li?.className.includes('video')) {
                return
            }

            let rawUrl = imgEl.getAttribute('data-url') ||
                imgEl.getAttribute('data-src') ||
                imgEl.getAttribute('data-lazy') ||
                imgEl.getAttribute('src') || ''

            if (!rawUrl || !rawUrl.includes('360buyimg.com')) {
                return
            }

            const baseUrl = normalizeToBase(rawUrl)
            if (!baseUrl) return
            if (seen.has(baseUrl)) return

            seen.add(baseUrl)
            domImages.push({ type: 1, img: baseUrl })
        })
    }

    if (domImages.length > 0) {
        console.log('[JD MainWorld] 从DOM提取到图片:', domImages.length, '张')
        return domImages
    }

    console.log('[JD MainWorld] 未找到任何图片')
    return []
}

function extractJDParams(globalData: any): Record<string, string> {
    const params: Record<string, string> = {}
    if (!globalData?.data) return params

    const data = globalData.data

    try {
        const paramPaths = [
            data.product?.detail?.parameterList,
            data.detail?.parameterList,
            data.parameterList,
            data.productDetail?.parameterList,
            data.skuBase?.parameterList
        ]

        for (const paramList of paramPaths) {
            if (Array.isArray(paramList)) {
                for (const group of paramList) {
                    const infos = group?.parameterInfos || group?.attrs || []
                    if (Array.isArray(infos)) {
                        for (const p of infos) {
                            const k = String(p?.name || p?.key || '').trim()
                            const v = String(p?.value || p?.val || '').trim()
                            if (k && v && !params[k]) params[k] = v
                        }
                    }
                }
                if (Object.keys(params).length > 0) break
            }
        }
    } catch (e) {
        console.warn('[JD MainWorld] 参数提取错误:', e)
    }

    return params
}

// ========== 天猫全局变量提取 ==========

function extractTmallGlobalData(): any {
    const win = window as any

    const sources = [
        { key: '__UNIVERSAL_DATA_FOR_REHYDRATION__', path: null },
        { key: '__APOLLO_STATE__', path: null },
        { key: '__INITIAL_STATE__', path: null },
        { key: '__NUXT__', path: null },
        { key: '__NEXT_DATA__', path: null },
        { key: '__GLOBAL_DATA__', path: null },
        { key: '__INIT_DATA__', path: null },
        { key: '__AUI_STAGE_DATA__', path: null },
        { key: 'g_config', path: null },
        { key: 'g_page_config', path: null },
        { key: 'Hub', path: 'config.itemDO' }
    ]

    for (const source of sources) {
        try {
            let data = win[source.key]
            if (data && source.path) {
                const paths = source.path.split('.')
                for (const p of paths) {
                    data = data?.[p]
                }
            }
            if (data) {
                console.log(`[Tmall MainWorld] 找到变量: ${source.key}`,
                    typeof data === 'object' ? Object.keys(data).slice(0, 5) : typeof data)
                return { source: source.key, data }
            }
        } catch { }
    }

    return null
}

/**
 * 提取天猫colorSize数据
 */
function extractTmallColorSize(): any[] {
    const win = window as any
    const result: any[] = []

    console.log('[Tmall MainWorld] 开始提取colorSize...')

    // 尝试从全局变量获取
    const skuPaths = [
        () => win.__INIT_DATA__?.skuBase?.props,
        () => win.__INIT_DATA__?.data?.skuBase?.props,
        () => win.__INIT_DATA__?.data?.componentsVO?.skuBase?.props,
        () => win.__GLOBAL_DATA__?.skuBase?.props,
        () => win.g_config?.skuProps,
        () => win.g_page_config?.skuData?.skuProps,
        () => win.Hub?.config?.skuBase?.props,
        () => {
            for (const key of Object.keys(win)) {
                try {
                    const val = win[key]
                    if (val && typeof val === 'object') {
                        if (Array.isArray(val.skuProps) && val.skuProps.length > 0) {
                            console.log(`[Tmall MainWorld] 发现skuProps在window.${key}`)
                            return val.skuProps
                        }
                        if (val.skuBase?.props?.length > 0) {
                            console.log(`[Tmall MainWorld] 发现skuBase.props在window.${key}`)
                            return val.skuBase.props
                        }
                    }
                } catch { }
            }
            return null
        }
    ]

    for (const getter of skuPaths) {
        try {
            const props = getter()
            if (Array.isArray(props) && props.length > 0) {
                console.log(`[Tmall MainWorld] 找到SKU props: ${props.length}个规格组`)
                for (const prop of props) {
                    if (!prop || typeof prop !== 'object') continue
                    const name = prop.name || prop.propName || ''
                    const values = prop.values || prop.propValues || []
                    if (name && Array.isArray(values) && values.length > 0) {
                        const group = {
                            name,
                            values: values.map((v: any) => ({
                                name: v.name || v.valueName || v.text || '',
                                image: v.image || v.img || undefined
                            })).filter((v: any) => v.name)
                        }
                        if (group.values.length > 0) {
                            result.push(group)
                        }
                    }
                }
                if (result.length > 0) {
                    return result
                }
            }
        } catch { }
    }

    // DOM回退
    console.log('[Tmall MainWorld] 尝试从DOM提取SKU...')
    return extractTmallColorSizeFromDOM()
}

function extractTmallColorSizeFromDOM(): any[] {
    const domGroups: any[] = []
    const normalizeLabel = (s: string) => String(s || '').replace(/[:：]$/, '').trim()

    // SKU 名称黑名单
    const nameBlacklist = ['券后', '优惠', '满减', '促销', '红包', '折扣', '立减', '包邮', '活动', '赠品', '补贴', '领取', '已售', '数量', '服务', '保障']

    // SKU 值黑名单 - 过滤功能按钮文字
    const valueBlacklist = [
        '切换大图', '大图模式', '查看功能', '查看商品', '知道了', '店长主推', '套餐类型',
        '有货', '选购更多', '加入购物车', '立即购买', '收藏', '分享', '客服', '举报',
        '新增功能', '可切换', '了解更多', '查看详情', '点击查看', '展开', '收起'
    ]

    // 新版天猫 skuWrapper 结构
    document.querySelectorAll("[class*='skuWrapper']").forEach((wrapper) => {
        const fullText = (wrapper as HTMLElement).innerText || ''
        const lines = fullText.split('\n').map(l => l.trim()).filter(l => l && l.length < 50)

        let name = ''
        const values: any[] = []

        for (const line of lines) {
            // 跳过黑名单名称
            if (nameBlacklist.some(b => line.includes(b))) continue
            // 跳过价格
            if (/^[¥￥]?\d/.test(line)) continue
            // 跳过黑名单值
            if (valueBlacklist.some(b => line.includes(b))) continue

            if (!name) {
                name = line
            } else {
                values.push({ name: line })
            }
        }

        if (name && values.length > 0) {
            domGroups.push({ name, values: values.slice(0, 50) })
            console.log(`[Tmall MainWorld] DOM SKU: ${name} = ${values.length}个值`)
        }
    })

    // 传统天猫结构
    if (domGroups.length === 0) {
        document.querySelectorAll([
            ".tb-prop",
            ".J_Prop",
            ".tm-sale-prop",
            "[class*='SkuPanel']",
            "[class*='GeneralSkuPanel']"
        ].join(",")).forEach((block) => {
            const name = normalizeLabel(
                (block.querySelector('.tb-property-type, .tb-metatit, .J_Prop_Title, dt') as HTMLElement)?.innerText || ''
            ) || block.getAttribute('data-type') || ''

            if (!name) return
            if (nameBlacklist.some(b => name.includes(b))) return

            const values: any[] = []
            block.querySelectorAll("li, [class*='valueItem'], [class*='skuItem']").forEach((li) => {
                const label = normalizeLabel(
                    (li.querySelector('a, span, div') as HTMLElement)?.innerText ||
                    li.getAttribute('title') ||
                    (li as HTMLElement).innerText || ''
                )
                if (!label || label.length > 50) return
                if (nameBlacklist.some(b => label.includes(b))) return
                if (valueBlacklist.some(b => label.includes(b))) return
                const img = (li.querySelector('img') as HTMLImageElement)?.getAttribute('src') || undefined
                values.push({ name: label, image: img })
            })

            if (values.length > 0) {
                domGroups.push({ name, values: values.slice(0, 50) })
                console.log(`[Tmall MainWorld] DOM SKU: ${name} = ${values.length}个值`)
            }
        })
    }

    return domGroups
}

function extractTmallParams(globalData: any): Record<string, string> {
    const params: Record<string, string> = {}
    const data = globalData?.data ?? globalData
    if (!data) return params

    const put = (kRaw: any, vRaw: any) => {
        const k = String(kRaw ?? '').trim()
        const v = String(vRaw ?? '').trim()
        if (!k || !v) return
        if (k.length > 40 || v.length > 200) return
        if (!params[k]) params[k] = v
    }

    const harvestArray = (arr: any[]) => {
        for (const p of arr) {
            if (!p || typeof p !== 'object') continue
            const name = p.name || p.attrName || p.key || p.label || p.title || ''
            const value = p.value || p.attrValue || p.val || p.text || ''
            if (name && value) put(name, value)
        }
    }

    // 多路径提取
    const paramPaths = [
        data?.moduleData?.itemProps?.props,
        data?.itemProps?.props,
        data?.props?.props,
        data?.data?.property?.props,
        data?.property?.props,
        data?.itemDO?.attributes,
        data?.attributes
    ]

    for (const path of paramPaths) {
        if (Array.isArray(path)) {
            harvestArray(path)
            if (Object.keys(params).length >= 5) break
        }
    }

    // DOM回退
    if (Object.keys(params).length === 0) {
        document.querySelectorAll([
            '#J_AttrUL li',
            '.tb-property-cont li',
            '.ItemPropList--item',
            "[class*='paramsInfoArea'] li",
            "[class*='paramsWrap'] li",
            "[class*='BasicContent'] li",
            "[class*='ItemProp'] li",
            "[class*='detailAttr'] li",
            ".tb-attributes li",
            "[class*='Attrs'] li"
        ].join(',')).forEach((li) => {
            const t = (li.textContent || '').trim()
            const m = t.match(/^(.+?)[:：]\s*(.+)$/)
            if (m) put(m[1], m[2])
        })
    }

    console.log(`[Tmall MainWorld] 提取到${Object.keys(params).length}个参数`)
    return params
}

function extractTmallImages(): string[] {
    const images: string[] = []
    const seen = new Set<string>()

    const normalizeImg = (raw: string): string | null => {
        let u = String(raw || '').trim()
        if (!u) return null
        if (u.startsWith('data:')) return null
        if (u.startsWith('//')) u = `https:${u}`
        if (!/(alicdn\.com|tmall\.com|taobao\.com)/i.test(u)) return null
        u = u.replace(/_\d+x\d+(?:q\d+)?\.(jpg|png|webp|avif)$/i, '.$1')
            .replace(/_\d+\.(jpg|png|webp|avif)$/i, '.$1')
        // 过滤非商品图
        const lower = u.toLowerCase()
        if (lower.includes('avatar') || lower.includes('icon') || lower.includes('logo') ||
            lower.includes('sprite') || lower.includes('qrcode') || lower.includes('88vip')) {
            return null
        }
        return u
    }

    const addImg = (raw: string | null | undefined) => {
        if (!raw) return
        const u = normalizeImg(raw)
        if (!u || seen.has(u)) return
        seen.add(u)
        images.push(u)
    }

    // 主图 - 扩展选择器
    document.querySelectorAll([
        '#J_UlThumb img',
        '.tb-gallery img',
        '.tb-thumb img',
        "[class*='PicGallery'] img",
        "[class*='mainPic'] img",
        "[class*='thumbnails'] img",
        "[class*='Thumbnail'] img",
        "[class*='ItemHeader'] img",
        "[class*='gallery'] img",
        "[class*='sku'] img[src*='alicdn']",
        "ul[class*='thumb'] img",
        ".tb-pic img",
        "[class*='skuItem'] img"
    ].join(',')).forEach((node) => {
        const img = node as HTMLImageElement
        addImg(
            img.getAttribute('data-src') ||
            img.getAttribute('data-ks-lazyload') ||
            img.getAttribute('data-lazyload-src') ||
            img.getAttribute('src')
        )
    })

    // og:image
    addImg(getMetaContent('og:image'))

    console.log(`[Tmall MainWorld] 提取到${images.length}张图片`)
    return images.slice(0, 30)
}

// ========== 苏宁全局变量提取 ==========

function extractSuningGlobalData(): any {
    const win = window as any
    const keys = [
        '__INITIAL_STATE__',
        '__NUXT__',
        '__NEXT_DATA__',
        '__STORE__',
        'SN',
        'pageData',
        'productData',
        'itemData',
        'detailData'
    ]

    for (const k of keys) {
        try {
            const v = win[k]
            if (v && typeof v === 'object') return { source: k, data: v }
        } catch { }
    }

    return null
}

/**
 * 提取苏宁colorSize数据
 */
function extractSuningColorSize(): any[] {
    const win = window as any
    const result: any[] = []

    console.log('[Suning MainWorld] 开始提取SKU...')

    // 尝试从全局变量获取
    const skuPaths = [
        () => win.SN?.skuData,
        () => win.pageData?.skuData,
        () => win.productData?.skuData,
        () => win.itemData?.skuData,
        () => win.__INITIAL_STATE__?.skuData,
        () => {
            for (const key of Object.keys(win)) {
                try {
                    const val = win[key]
                    if (val && typeof val === 'object') {
                        if (Array.isArray(val.skuList) && val.skuList.length > 0) {
                            return val.skuList
                        }
                        if (val.colorSize?.length > 0) {
                            return val.colorSize
                        }
                    }
                } catch { }
            }
            return null
        }
    ]

    for (const getter of skuPaths) {
        try {
            const skuData = getter()
            if (Array.isArray(skuData) && skuData.length > 0) {
                console.log(`[Suning MainWorld] 找到SKU data: ${skuData.length}项`)
                return skuData
            }
        } catch { }
    }

    // DOM回退
    console.log('[Suning MainWorld] 尝试从DOM提取SKU...')
    return extractSuningColorSizeFromDOM()
}

function extractSuningColorSizeFromDOM(): any[] {
    const domGroups: any[] = []
    const normalizeLabel = (s: string) => String(s || '').replace(/[:：]$/, '').trim()

    const skuSelectors = [
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
    ]

    document.querySelectorAll(skuSelectors.join(",")).forEach((block) => {
        const name = normalizeLabel(
            (block.querySelector('.dt, .title, label, [class*="title"], dt') as HTMLElement)?.innerText ||
            block.getAttribute('data-title') || ''
        )

        if (!name) return

        const values: any[] = []
        block.querySelectorAll("li, dd, a[data-value], [class*='item']").forEach((li) => {
            const label = normalizeLabel(
                li.getAttribute('title') ||
                li.getAttribute('data-value') ||
                (li as HTMLElement).innerText || ''
            )
            if (!label || label.length > 50) return
            const img = (li.querySelector('img') as HTMLImageElement)?.getAttribute('src') || undefined
            values.push({ name: label, image: img })
        })

        if (values.length > 0) {
            domGroups.push({ name, values: values.slice(0, 50) })
            console.log(`[Suning MainWorld] DOM SKU: ${name} = ${values.length}个值`)
        }
    })

    return domGroups
}

function extractSuningParams(globalData: any): Record<string, string> {
    const params: Record<string, string> = {}
    const data = globalData?.data ?? globalData
    if (!data) return params

    const put = (kRaw: any, vRaw: any) => {
        const k = String(kRaw ?? '').trim()
        const v = String(vRaw ?? '').trim()
        if (!k || !v) return
        if (k.length > 40 || v.length > 200) return
        if (!params[k]) params[k] = v
    }

    // 多路径尝试
    const paramPaths = [
        data?.parameterList,
        data?.params,
        data?.props,
        data?.attributes,
        data?.productDetail?.parameterList
    ]

    for (const list of paramPaths) {
        if (Array.isArray(list)) {
            for (const p of list) {
                if (!p || typeof p !== 'object') continue
                const name = p.name || p.attrName || p.key || ''
                const value = p.value || p.attrValue || p.val || ''
                if (name && value) put(name, value)
            }
            if (Object.keys(params).length >= 5) break
        }
    }

    // DOM回退
    if (Object.keys(params).length === 0) {
        document.querySelectorAll([
            '.pro-detail-parameter li',
            '.procon-param li',
            '#kernelParmeter li',
            '.pro-parameters li',
            '.proinfo-param li',
            '.product-params li',
            '.parameter-item',
            '[class*="paramItem"]'
        ].join(',')).forEach((li) => {
            const t = (li.textContent || '').trim()
            const m = t.match(/^(.+?)[:：]\s*(.+)$/)
            if (m) put(m[1], m[2])
        })
    }

    return params
}

function extractSuningImages(): string[] {
    const images: string[] = []
    const seen = new Set<string>()

    const normalizeImg = (raw: string): string | null => {
        let u = String(raw || '').trim()
        if (!u) return null
        if (u.startsWith('data:')) return null
        if (u.startsWith('//')) u = `https:${u}`
        u = u.replace(/^http:/i, 'https:')

        try {
            u = new URL(u, location.href).toString()
        } catch {
            return null
        }

        if (!/(suning\.(cn|com)|cnsuningimg\.com|uimg\.(cn|com))/i.test(u)) return null
        u = u.replace(/_\d+x\d+_/g, '_800x800_')
            .replace(/_\d+w_\d+h_/g, '_800w_800h_')
        return u
    }

    const addImg = (raw: string | null | undefined) => {
        if (!raw) return
        const u = normalizeImg(raw)
        if (!u || seen.has(u)) return
        seen.add(u)
        images.push(u)
    }

    // 主图
    document.querySelectorAll([
        '#imageZoom img',
        '#bigImg',
        'img[id*="bigImg"]',
        '.imgzoom-thumb-main img',
        'ul.imgzoom-thumb li img',
        '.imgzoom-thumb img',
        'img[src*="suning"]',
        'img[data-src*="suning"]'
    ].join(',')).forEach((node) => {
        const img = node as HTMLImageElement
        addImg(
            img.getAttribute('src2') ||
            img.getAttribute('data-src2') ||
            img.getAttribute('src-large') ||
            img.getAttribute('data-original') ||
            img.getAttribute('data-src') ||
            img.getAttribute('src')
        )
    })

    addImg(getMetaContent('og:image'))

    return images.slice(0, 30)
}

// ========== Script标签JSON解析 ==========

function extractJSONFromScripts(): any {
    const scripts = document.querySelectorAll('script:not([src])')

    for (const script of scripts) {
        const text = script.textContent || ''

        if (text.includes('itemDO') || text.includes('skuId') ||
            text.includes('parameterList') || text.includes('props')) {

            if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
                try {
                    const json = JSON.parse(text.trim())
                    console.log('[MainWorld] 从Script标签解析到纯JSON')
                    return { source: 'script', data: json }
                } catch { }
            }

            const patterns = [
                /window\.__INIT_DATA__\s*=\s*(\{[\s\S]*?\});/,
                /window\.__GLOBAL_DATA__\s*=\s*(\{[\s\S]*?\});/,
                /var\s+pageConfig\s*=\s*(\{[\s\S]*?\});/,
                /\bdata\s*:\s*(\{[\s\S]*?"sku"[\s\S]*?\})/
            ]

            for (const pattern of patterns) {
                const match = text.match(pattern)
                if (match) {
                    try {
                        const json = JSON.parse(match[1])
                        console.log('[MainWorld] 从Script标签提取到JSON')
                        return { source: 'script', data: json }
                    } catch { }
                }
            }
        }
    }

    return null
}

// ========== 主函数 ==========

function detectPlatform(): 'JD' | 'Tmall' | 'Suning' | null {
    const host = location.hostname
    if (host.includes('jd.com') || host.includes('jd.hk')) return 'JD'
    if (host.includes('tmall.com') || host.includes('tmall.hk') || host.includes('taobao.com')) return 'Tmall'
    if (host.includes('suning.com') || host.includes('suning.cn')) return 'Suning'
    return null
}

function extractProductData() {
    const platform = detectPlatform()
    console.log(`[MainWorld] 检测平台: ${platform}`)

    let globalData: any = null
    let params: Record<string, string> = {}
    let colorSize: any[] = []
    let imageAndVideoJson: any[] = []
    let images: string[] = []
    let title: string = ''
    let price: string = ''

    // 根据平台提取数据
    if (platform === 'JD') {
        globalData = extractJDGlobalData()
        if (globalData) {
            params = extractJDParams(globalData)
        }
        colorSize = extractJDColorSize()
        imageAndVideoJson = extractJDImageAndVideoJson()
        console.log('[JD MainWorld] 最终imageAndVideoJson:', imageAndVideoJson.length, '项')
    } else if (platform === 'Tmall') {
        globalData = extractTmallGlobalData()
        if (globalData) {
            params = extractTmallParams(globalData)
        }
        colorSize = extractTmallColorSize()
        images = extractTmallImages()
        title = getMetaContent('og:title')
        price = cleanNumericPrice(getMetaContent('product:price:amount') || getMetaContent('og:product:price:amount'))
        console.log('[Tmall MainWorld] colorSize:', colorSize.length, '组')
    } else if (platform === 'Suning') {
        globalData = extractSuningGlobalData()
        if (globalData) {
            params = extractSuningParams(globalData)
        }
        colorSize = extractSuningColorSize()
        images = extractSuningImages()
        title = getMetaContent('og:title')
        price = cleanNumericPrice(getMetaContent('product:price:amount') || getMetaContent('og:product:price:amount'))
        console.log('[Suning MainWorld] colorSize:', colorSize.length, '组')
    }

    // Fallback: 从Script标签解析
    if (Object.keys(params).length === 0) {
        console.log('[MainWorld] 尝试从Script标签解析...')
        const scriptData = extractJSONFromScripts()
        if (scriptData) {
            if (platform === 'JD') {
                params = extractJDParams(scriptData)
            } else if (platform === 'Tmall') {
                params = extractTmallParams(scriptData)
            } else if (platform === 'Suning') {
                params = extractSuningParams(scriptData)
            }
        }
    }

    console.log(`[MainWorld] 提取到参数: ${Object.keys(params).length} 项, colorSize: ${colorSize.length} 项, 图片: ${imageAndVideoJson.length + images.length} 张`)
    if (Object.keys(params).length > 0) {
        console.log('[MainWorld] 参数样例:', Object.entries(params).slice(0, 5))
    }

    // 发送给内容脚本
    window.postMessage({
        type: 'ECOMMERCE_PRODUCT_DATA',
        platform,
        params,
        colorSize,
        imageAndVideoJson,
        images,
        title,
        price,
        source: globalData?.source || 'unknown',
        timestamp: Date.now()
    }, '*')
}

// 监听采集请求
window.addEventListener('message', (event) => {
    if (event.data?.type === 'REQUEST_PRODUCT_DATA') {
        console.log('[MainWorld] 收到采集请求')
        extractProductData()
    }
})

// 页面加载后自动提取一次
setTimeout(() => {
    console.log('[MainWorld] 自动执行首次提取')
    extractProductData()
}, 2000)

console.log(`[MainWorld] E-commerce script loaded on ${location.hostname}`)
