/**
 * E-commerce Network Interceptor
 * 电商网络请求拦截器 - 运行在页面主世界(MAIN)
 * 
 * 拦截京东、天猫、苏宁等电商网站的 API 请求
 * 获取比 DOM 更精准的商品数据（SKU、价格、库存等）
 * 
 * 技术原理：
 * 1. 重写 XMLHttpRequest 和 fetch，拦截网络响应
 * 2. 筛选包含商品数据的 API 响应（mtop、getDetail 等）
 * 3. 通过 postMessage 发送给 content script
 * 
 * 注意：此文件只处理电商网站，不涉及政采云
 */

import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
    matches: [
        // 京东 - 与 ecommerce-main-world.ts 保持一致
        "https://item.jd.com/*",
        "https://item.m.jd.com/*",
        // 天猫
        "https://detail.tmall.com/*",
        "https://detail.tmall.hk/*",
        "https://chaoshi.detail.tmall.com/*",
        // 淘宝
        "https://item.taobao.com/*",
        // 苏宁
        "https://product.suning.com/*"
    ],
    world: "MAIN",
    run_at: "document_start" // 关键：在页面脚本执行前注入，确保能拦截所有请求
}

// ========== 数据存储 ==========
interface InterceptedData {
    platform: 'jd' | 'tmall' | 'taobao' | 'suning'
    type: string
    url: string
    data: any
    timestamp: number
}

const interceptedDataStore: InterceptedData[] = []

// ========== 工具函数 ==========

function detectPlatform(): 'jd' | 'tmall' | 'taobao' | 'suning' | null {
    const hostname = window.location.hostname
    if (hostname.includes('jd.com')) return 'jd'
    if (hostname.includes('tmall.com')) return 'tmall'
    if (hostname.includes('taobao.com')) return 'taobao'
    if (hostname.includes('suning.com')) return 'suning'
    return null
}

function safeJsonParse(text: string): any {
    try {
        // 处理 JSONP 格式: callback({...})
        const jsonpMatch = text.match(/^\s*\w+\s*\(\s*(\{[\s\S]*\})\s*\)\s*;?\s*$/)
        if (jsonpMatch) {
            return JSON.parse(jsonpMatch[1])
        }
        return JSON.parse(text)
    } catch {
        return null
    }
}

function sendToContentScript(type: string, data: any) {
    const platform = detectPlatform()
    if (!platform) return

    const payload: InterceptedData = {
        platform,
        type,
        url: '',
        data,
        timestamp: Date.now()
    }

    interceptedDataStore.push(payload)

    window.postMessage({
        type: 'ECOMMERCE_NETWORK_INTERCEPTED',
        payload
    }, '*')

    console.log(`[Ecommerce Interceptor] 捕获 ${platform} ${type}:`,
        typeof data === 'object' ? Object.keys(data).slice(0, 5) : typeof data)
}

// ========== 京东 API 匹配规则 ==========

const JD_API_PATTERNS = {
    // 商品详情
    productDetail: [
        /api\.m\.jd\.com.*functionId=wareBusiness/i,
        /api\.m\.jd\.com.*functionId=pc_detailpage/i,
        /cd\.jd\.com.*callback.*getDetailData/i,
        /item-soa\.jd\.com.*getWareBusiness/i
    ],
    // 价格
    price: [
        /p\.3\.cn.*skuIds/i,
        /c0\.3\.cn.*skuIds/i,
        /pe\.3\.cn.*skuIds/i,
        /api\.m\.jd\.com.*functionId=warePriceInfo/i
    ],
    // 库存
    stock: [
        /c0\.3\.cn.*stocks/i,
        /api\.m\.jd\.com.*functionId=stockInfo/i
    ],
    // SKU 信息
    sku: [
        /api\.m\.jd\.com.*functionId=wareSku/i,
        /cd\.jd\.com.*callback.*getColorSize/i
    ]
}

// ========== 天猫/淘宝 API 匹配规则 ==========

const TMALL_API_PATTERNS = {
    // 商品详情 - mtop 接口
    productDetail: [
        /mtop\.taobao\.detail\.getdetail/i,
        /mtop\.tmall\.detail\.getdetail/i,
        /h5api\.m\.taobao\.com.*getDetail/i,
        /h5api\.m\.tmall\.com.*getDetail/i,
        /acs\.m\.taobao\.com.*mtop\.taobao/i,
        /detail\.m\.tmall\.com.*getDetail/i
    ],
    // SKU 信息
    sku: [
        /mtop\.taobao\.pcdetail\.data/i,
        /mtop\.tmall\.kangaroo\.core/i,
        /sku\.info/i,
        /skuInfo/i
    ],
    // 价格
    price: [
        /mtop\.taobao\.detail\.getprice/i,
        /mtop\.tmall\.detail\.getprice/i,
        /dynamicPrice/i
    ],
    // 库存
    stock: [
        /mtop\.taobao\.detail\.getstock/i,
        /inventory/i
    ]
}

// ========== 苏宁 API 匹配规则 ==========

const SUNING_API_PATTERNS = {
    // 商品详情
    productDetail: [
        /product\.suning\.com.*getItemInfo/i,
        /res\.suning\.cn.*getclusterinfo/i,
        /icps\.suning\.com.*getProductDetail/i
    ],
    // 价格
    price: [
        /icps\.suning\.com.*getprice/i,
        /pas\.suning\.com.*price/i,
        /pcprice\.suning\.com/i
    ],
    // 库存
    stock: [
        /iss\.suning\.com.*stock/i,
        /stock\.suning\.com/i
    ],
    // SKU
    sku: [
        /product\.suning\.com.*getClusetersku/i,
        /icps\.suning\.com.*sku/i
    ]
}

// ========== 匹配和处理 ==========

function matchUrl(url: string, patterns: Record<string, RegExp[]>): string | null {
    for (const [type, regexList] of Object.entries(patterns)) {
        for (const regex of regexList) {
            if (regex.test(url)) {
                return type
            }
        }
    }
    return null
}

function processJdResponse(url: string, responseText: string) {
    const matchedType = matchUrl(url, JD_API_PATTERNS)
    if (!matchedType) return

    const data = safeJsonParse(responseText)
    if (!data) return

    sendToContentScript(`jd_${matchedType}`, data)

    // 提取关键数据
    if (matchedType === 'productDetail') {
        extractJdProductDetail(data)
    } else if (matchedType === 'price') {
        extractJdPrice(data)
    } else if (matchedType === 'sku') {
        extractJdSku(data)
    }
}

function processTmallResponse(url: string, responseText: string) {
    const matchedType = matchUrl(url, TMALL_API_PATTERNS)
    if (!matchedType) return

    const data = safeJsonParse(responseText)
    if (!data) return

    sendToContentScript(`tmall_${matchedType}`, data)

    // 提取关键数据
    if (matchedType === 'productDetail') {
        extractTmallProductDetail(data)
    } else if (matchedType === 'sku') {
        extractTmallSku(data)
    }
}

function processSuningResponse(url: string, responseText: string) {
    const matchedType = matchUrl(url, SUNING_API_PATTERNS)
    if (!matchedType) return

    const data = safeJsonParse(responseText)
    if (!data) return

    sendToContentScript(`suning_${matchedType}`, data)

    if (matchedType === 'productDetail') {
        extractSuningProductDetail(data)
    }
}

// ========== 数据提取函数 ==========

function extractJdProductDetail(data: any) {
    try {
        // 京东详情接口的常见数据结构
        const paths = [
            () => data?.data?.product,
            () => data?.product,
            () => data?.wareInfo,
            () => data?.result?.product,
            () => data
        ]

        for (const getter of paths) {
            const product = getter()
            if (product && (product.name || product.skuName || product.wareName)) {
                sendToContentScript('jd_product_extracted', {
                    title: product.name || product.skuName || product.wareName,
                    skuId: product.skuId,
                    brand: product.brand || product.brandName,
                    price: product.price || product.p,
                    images: product.imageList || product.images,
                    colorSize: product.colorSize,
                    params: product.parameterList || product.attrList
                })
                break
            }
        }
    } catch (e) {
        console.warn('[JD Interceptor] 提取商品详情失败:', e)
    }
}

function extractJdPrice(data: any) {
    try {
        // 京东价格接口返回格式通常是数组
        const prices = Array.isArray(data) ? data : (data?.data || data?.result || [])
        if (Array.isArray(prices) && prices.length > 0) {
            sendToContentScript('jd_price_extracted', {
                prices: prices.map(p => ({
                    skuId: p.id || p.skuId,
                    price: p.p || p.price || p.op,
                    originalPrice: p.op || p.m
                }))
            })
        }
    } catch (e) {
        console.warn('[JD Interceptor] 提取价格失败:', e)
    }
}

function extractJdSku(data: any) {
    try {
        const colorSize = data?.data?.colorSize || data?.colorSize || data?.result?.colorSize
        if (Array.isArray(colorSize) && colorSize.length > 0) {
            sendToContentScript('jd_sku_extracted', { colorSize })
        }
    } catch (e) {
        console.warn('[JD Interceptor] 提取SKU失败:', e)
    }
}

function extractTmallProductDetail(data: any) {
    try {
        // 天猫 mtop 接口的数据结构
        const paths = [
            () => data?.data,
            () => data?.ret?.[0] === 'SUCCESS' ? data?.data : null,
            () => data?.result?.data,
            () => data
        ]

        for (const getter of paths) {
            const detail = getter()
            if (!detail) continue

            // 提取 SKU 信息
            const skuBase = detail?.skuBase || detail?.componentsVO?.skuBase
            const skuProps = skuBase?.props || []

            // 提取商品属性
            const itemDO = detail?.itemDO || detail?.item || {}
            const props = detail?.moduleData?.itemProps?.props || detail?.props?.props || []

            if (itemDO.title || skuProps.length > 0) {
                sendToContentScript('tmall_product_extracted', {
                    title: itemDO.title || detail?.title,
                    itemId: itemDO.itemId,
                    price: itemDO.price || detail?.price,
                    images: itemDO.images || detail?.images,
                    skuProps: skuProps,
                    skuMap: skuBase?.skuMap,
                    props: props
                })
                break
            }
        }
    } catch (e) {
        console.warn('[Tmall Interceptor] 提取商品详情失败:', e)
    }
}

function extractTmallSku(data: any) {
    try {
        const skuBase = data?.data?.skuBase || data?.skuBase
        if (skuBase) {
            sendToContentScript('tmall_sku_extracted', {
                props: skuBase.props,
                skuMap: skuBase.skuMap,
                skus: skuBase.skus
            })
        }
    } catch (e) {
        console.warn('[Tmall Interceptor] 提取SKU失败:', e)
    }
}

function extractSuningProductDetail(data: any) {
    try {
        const paths = [
            () => data?.data,
            () => data?.result,
            () => data
        ]

        for (const getter of paths) {
            const detail = getter()
            if (detail && (detail.name || detail.commodityName)) {
                sendToContentScript('suning_product_extracted', {
                    title: detail.name || detail.commodityName,
                    skuId: detail.cmmdtyCode || detail.skuId,
                    price: detail.price,
                    images: detail.imageList || detail.images,
                    params: detail.paramList || detail.params
                })
                break
            }
        }
    } catch (e) {
        console.warn('[Suning Interceptor] 提取商品详情失败:', e)
    }
}

// ========== 主处理函数 ==========

function processResponse(url: string, responseText: string) {
    if (!url || !responseText) return

    const platform = detectPlatform()
    if (!platform) return

    try {
        switch (platform) {
            case 'jd':
                processJdResponse(url, responseText)
                break
            case 'tmall':
            case 'taobao':
                processTmallResponse(url, responseText)
                break
            case 'suning':
                processSuningResponse(url, responseText)
                break
        }
    } catch (e) {
        console.warn('[Ecommerce Interceptor] 处理响应时出错:', e)
    }
}

// ========== XHR 拦截 ==========

const originalXhrOpen = window.XMLHttpRequest.prototype.open
const originalXhrSend = window.XMLHttpRequest.prototype.send

window.XMLHttpRequest.prototype.open = function (method: string, url: string | URL) {
    this._interceptor_url = typeof url === 'string' ? url : url.toString()
    return originalXhrOpen.apply(this, arguments as any)
}

window.XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
    this.addEventListener('load', function () {
        try {
            const url = this._interceptor_url || ''
            const responseText = this.responseText
            if (url && responseText) {
                processResponse(url, responseText)
            }
        } catch (e) {
            // 静默处理错误，不影响页面正常功能
        }
    })
    return originalXhrSend.apply(this, arguments as any)
}

// ========== Fetch 拦截 ==========

const originalFetch = window.fetch

window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const response = await originalFetch.apply(this, [input, init])

    try {
        const url = typeof input === 'string'
            ? input
            : (input instanceof Request ? input.url : input.toString())

        // 克隆响应以避免消耗原始 body
        const clone = response.clone()

        clone.text().then(text => {
            if (text) {
                processResponse(url, text)
            }
        }).catch(() => {
            // 静默处理
        })
    } catch (e) {
        // 静默处理错误
    }

    return response
}

    // ========== 提供全局访问 ==========

    // 暴露给 content script 查询已拦截的数据
    ; (window as any).__ECOMMERCE_INTERCEPTED_DATA__ = {
        getAll: () => [...interceptedDataStore],
        getByType: (type: string) => interceptedDataStore.filter(d => d.type === type),
        getLatest: () => interceptedDataStore[interceptedDataStore.length - 1],
        clear: () => { interceptedDataStore.length = 0 }
    }

console.log(`[Ecommerce Network Interceptor] 已启动 (${detectPlatform() || 'unknown'})`)
