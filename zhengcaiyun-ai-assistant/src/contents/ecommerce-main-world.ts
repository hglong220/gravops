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
        "https://item.taobao.com/*",
        "https://product.suning.com/*"
    ],
    world: "MAIN",
    run_at: "document_start" // 改为 document_start 以便拦截网络请求
}

// ========== 网络拦截器（在 document_start 时立即执行） ==========

// 存储拦截到的数据
const interceptedNetworkData: Record<string, any> = {}

// 检测平台（网络拦截器专用）
function detectNetworkPlatform(): 'jd' | 'tmall' | 'taobao' | 'suning' | null {
    const hostname = window.location.hostname
    if (hostname.includes('jd.com')) return 'jd'
    if (hostname.includes('tmall.com')) return 'tmall'
    if (hostname.includes('taobao.com')) return 'taobao'
    if (hostname.includes('suning.com')) return 'suning'
    return null
}

// 安全解析 JSON（包括 JSONP）
function safeJsonParse(text: string): any {
    try {
        const jsonpMatch = text.match(/^\s*\w+\s*\(\s*(\{[\s\S]*\})\s*\)\s*;?\s*$/)
        if (jsonpMatch) return JSON.parse(jsonpMatch[1])
        return JSON.parse(text)
    } catch { return null }
}

// API 匹配规则
const API_PATTERNS = {
    jd: {
        productDetail: [/api\.m\.jd\.com.*wareBusiness/i, /cd\.jd\.com.*getDetailData/i],
        price: [/p\.3\.cn.*skuIds/i, /c0\.3\.cn.*skuIds/i],
        sku: [/cd\.jd\.com.*getColorSize/i]
    },
    tmall: {
        productDetail: [/mtop\.taobao\.detail/i, /mtop\.tmall\.detail/i, /h5api.*getDetail/i],
        sku: [/mtop\.taobao\.pcdetail/i, /skuInfo/i]
    },
    suning: {
        productDetail: [/getItemInfo/i, /getProductDetail/i],
        price: [/getprice/i]
    }
}

// 处理拦截到的响应
function processInterceptedResponse(url: string, responseText: string) {
    if (!url || !responseText) return
    const platform = detectNetworkPlatform()
    if (!platform) return

    const patterns = API_PATTERNS[platform as keyof typeof API_PATTERNS]
    if (!patterns) return

    for (const [type, regexList] of Object.entries(patterns)) {
        for (const regex of regexList) {
            if (regex.test(url)) {
                const data = safeJsonParse(responseText)
                if (data) {
                    interceptedNetworkData[`${platform}_${type}`] = data
                    console.log(`[Network Interceptor] 捕获 ${platform} ${type}:`,
                        typeof data === 'object' ? Object.keys(data).slice(0, 3) : typeof data)

                    // 发送给 content script
                    window.postMessage({
                        type: 'ECOMMERCE_NETWORK_INTERCEPTED',
                        payload: { platform, type: `${platform}_${type}`, data, timestamp: Date.now() }
                    }, '*')
                }
                return
            }
        }
    }
}

// 拦截 XMLHttpRequest
const _originalXhrOpen = XMLHttpRequest.prototype.open
const _originalXhrSend = XMLHttpRequest.prototype.send

XMLHttpRequest.prototype.open = function (method: string, url: string | URL) {
    (this as any)._interceptor_url = typeof url === 'string' ? url : url.toString()
    return _originalXhrOpen.apply(this, arguments as any)
}

XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
    this.addEventListener('load', function () {
        try {
            const url = (this as any)._interceptor_url || ''
            if (url && this.responseText) {
                processInterceptedResponse(url, this.responseText)
            }
        } catch { }
    })
    return _originalXhrSend.apply(this, arguments as any)
}

// 拦截 fetch
const _originalFetch = window.fetch
window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const response = await _originalFetch.apply(this, [input, init])
    try {
        const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : input.toString())
        const clone = response.clone()
        clone.text().then(text => {
            if (text) processInterceptedResponse(url, text)
        }).catch(() => { })
    } catch { }
    return response
}

    // 暴露拦截数据供后续使用
    ; (window as any).__INTERCEPTED_NETWORK_DATA__ = interceptedNetworkData

console.log(`[Network Interceptor] 已启动 (${detectNetworkPlatform() || 'unknown'})`)

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

    // 首选：ICE 框架数据（阿里新版前端框架）
    try {
        const iceData = win.__ICE_APP_CONTEXT__?.loaderData?.home?.data?.res
        if (iceData) {
            console.log('[Tmall MainWorld] 找到 ICE 框架数据')
            return { source: '__ICE_APP_CONTEXT__', data: iceData }
        }
    } catch { }

    const sources = [
        { key: '__ICE_APP_CONTEXT__', path: 'loaderData.home.data.res' },
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

    // SKU 值黑名单 - 过滤功能按钮文字和营销标签
    const valueBlacklist = [
        '切换大图', '大图模式', '查看功能', '查看商品', '知道了', '店长主推', '套餐类型',
        '有货', '选购更多', '加入购物车', '立即购买', '收藏', '分享', '客服', '举报',
        '新增功能', '可切换', '了解更多', '查看详情', '点击查看', '展开', '收起',
        // 营销标签和状态标签
        '多人加购', '即将售罄', '热销', '限时', '新品', '预售', '预订',
        '仅剩', '库存', '售罄', '缺货', '补货', '下架', '暂无', '无货', '到货通知'
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

    // 处理数组格式的参数
    const harvestArray = (arr: any[]) => {
        for (const p of arr) {
            if (!p || typeof p !== 'object') continue
            // 支持 ICE 框架的 {propertyName, valueName} 格式
            const name = p.propertyName || p.name || p.attrName || p.key || p.label || p.title || ''
            const value = p.valueName || p.value || p.attrValue || p.val || p.text || ''
            if (name && value) put(name, value)
        }
    }

    // 1. 首选：ICE 框架的 plusViewVO.industryParamVO（天猫新版）
    try {
        const industryParams = data?.plusViewVO?.industryParamVO
        if (industryParams) {
            // basicParamList - 基础参数（品牌、型号等）
            if (Array.isArray(industryParams.basicParamList)) {
                harvestArray(industryParams.basicParamList)
                console.log(`[Tmall] 从 basicParamList 获取到 ${industryParams.basicParamList.length} 个参数`)
            }
            // enhanceParamList - 增强参数（技术规格等）
            if (Array.isArray(industryParams.enhanceParamList)) {
                harvestArray(industryParams.enhanceParamList)
                console.log(`[Tmall] 从 enhanceParamList 获取到 ${industryParams.enhanceParamList.length} 个参数`)
            }
            // groupParamList - 分组参数
            if (Array.isArray(industryParams.groupParamList)) {
                for (const group of industryParams.groupParamList) {
                    if (Array.isArray(group?.paramList)) {
                        harvestArray(group.paramList)
                    }
                }
            }
        }
    } catch { }

    // 2. 其他路径提取
    const paramPaths = [
        data?.item?.props,           // ICE 框架路径
        data?.props,                 // ICE 框架路径
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
            if (Object.keys(params).length >= 10) break
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

/**
 * 提取天猫商品标题 - 多来源 + 严格过滤
 */
function extractTmallTitle(globalData: any): string {
    const invalidKeywords = ['登录', '登陆', '天猫', '淘宝', '首页', '购物车', '我的订单', '收藏夹', '消息', '查看']

    const isValidTitle = (t: string): boolean => {
        if (!t || t.length < 5) return false
        if (invalidKeywords.some(k => t.includes(k))) return false
        // 标题应该包含一些中文或英文字符
        if (!/[\u4e00-\u9fa5]/.test(t) && !/[A-Za-z0-9]/.test(t)) return false
        return true
    }

    // 来源1: ICE 框架数据（最可靠）
    const data = globalData?.data ?? globalData
    const globalTitles = [
        data?.item?.title,           // ICE 框架路径
        data?.itemDO?.title,
        data?.title,
        data?.itemTitle,
        data?.productTitle,
        data?.name
    ]
    for (const t of globalTitles) {
        if (typeof t === 'string' && isValidTitle(t)) {
            console.log('[Tmall MainWorld] 从全局变量获取标题:', t.substring(0, 30) + '...')
            return t.trim()
        }
    }

    // 来源2: DOM 选择器（新增 span 选择器）
    const selectors = [
        "[class*='mainTitle']",      // 天猫新版，span 元素
        '.tb-main-title',
        "[class*='ItemHeader--mainTitle']",
        "h1[class*='title']",
        "[class*='ItemTitle']",
        "[class*='productTitle']"
    ]
    for (const sel of selectors) {
        try {
            const el = document.querySelector(sel)
            if (el) {
                const t = (el.textContent || '').trim()
                if (isValidTitle(t)) {
                    console.log(`[Tmall MainWorld] 从 DOM ${sel} 获取标题`)
                    return t
                }
            }
        } catch { }
    }

    // 来源3: Meta 标签
    const ogTitle = getMetaContent('og:title')
    if (isValidTitle(ogTitle)) {
        return ogTitle
    }

    // 来源4: document.title - 智能分割
    const docTitle = document.title || ''
    const parts = docTitle.split(/[-_|【]/)
    for (const part of parts) {
        const cleaned = part.trim()
        if (isValidTitle(cleaned)) {
            console.log('[Tmall MainWorld] 从 document.title 提取标题')
            return cleaned
        }
    }

    console.log('[Tmall MainWorld] 标题提取失败，返回空')
    return ''
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
        // 过滤小尺寸图片（如 App 下载引导图，URL 中包含 tps-236-298 这样的尺寸标识）
        const tpsMatch = u.match(/tps-(\d+)-(\d+)/)
        if (tpsMatch) {
            const width = parseInt(tpsMatch[1], 10)
            const height = parseInt(tpsMatch[2], 10)
            if (width < 400 || height < 400) {
                console.log(`[Tmall] 过滤小尺寸图片: ${width}x${height}`, u.substring(0, 50))
                return null
            }
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
    let descImages: string[] = []  // 详情图 URL
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

        // 增强标题提取 - 多来源 + 过滤
        title = extractTmallTitle(globalData)
        price = cleanNumericPrice(getMetaContent('product:price:amount') || getMetaContent('og:product:price:amount'))

        // 提取详情图 URL
        try {
            const iceData = (window as any).__ICE_APP_CONTEXT__?.loaderData?.home?.data?.res
            const descUrl = iceData?.item?.pcADescUrl || iceData?.pcDescUrl || iceData?.descUrl || ''
            if (descUrl) {
                console.log('[Tmall MainWorld] 详情图 URL:', descUrl)
                // 发送详情图 URL 给内容脚本，让它异步加载
                window.postMessage({
                    type: 'TMALL_DESC_URL',
                    descUrl
                }, '*')
            }
        } catch { }

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

// 检查 DOM 是否准备好
function isDomReady(): boolean {
    // 检查是否有标题元素
    const hasTitle = !!document.querySelector('.sku-name, .tb-main-title, .proinfo-title, h1')
    // 检查是否有正文内容
    const bodyLength = (document.body?.innerText || '').length
    return hasTitle || bodyLength > 1000
}

// 等待 DOM 准备好后执行提取
function waitForDomAndExtract(retries = 0) {
    if (isDomReady() || retries >= 10) {
        console.log(`[MainWorld] DOM 准备好，开始提取 (重试次数: ${retries})`)
        extractProductData()
    } else {
        console.log(`[MainWorld] 等待 DOM 准备... (${retries}/10)`)
        setTimeout(() => waitForDomAndExtract(retries + 1), 500)
    }
}

// 页面加载后自动提取
if (document.readyState === 'loading') {
    // 如果文档还在加载，等待 DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
        console.log('[MainWorld] DOMContentLoaded 触发')
        setTimeout(waitForDomAndExtract, 1000) // 额外等待1秒让JS执行
    })
} else {
    // 文档已加载完成
    console.log('[MainWorld] 文档已加载，等待JS执行')
    setTimeout(waitForDomAndExtract, 2000) // 等待2秒
}

console.log(`[MainWorld] E-commerce script loaded on ${location.hostname}`)
