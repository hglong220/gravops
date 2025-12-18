// ================= 京东 SKU 采集模块 (用户方案重写版) =================
// 优先使用colorSize结构化数据，彻底抛弃页面文本提取方案

// 规格值接口
export interface SpecValue {
    id: string
    name: string
    image?: string
}

// 规格组接口
export interface SpecGroup {
    name: string
    values: SpecValue[]
}

// SKU组合价格映射
export interface SkuPrice {
    skuId: string
    price: number
    stock?: number
    specs: Record<string, string>
}

// 完整SKU数据结构
export interface JDSkuData {
    specGroups: SpecGroup[]
    skuPrices: SkuPrice[]
    defaultPrice: number | null
    defaultSpec?: any
}

interface JdColorSizeItem {
    skuId: string | number
    stock?: boolean
    jdPrice?: number
    [prop: string]: any
}

/**
 * 从colorSize构建SKU规格组（用户方案核心函数）
 * 自动扫出所有属性名，按属性名聚合生成规格组
 */
function buildSkuFromColorSize(colorSize: JdColorSizeItem[]): JDSkuData | null {
    if (!Array.isArray(colorSize) || !colorSize.length) {
        console.log('[JD SKU] colorSize为空，无法构建')
        return null
    }

    console.log('[JD SKU] buildSkuFromColorSize处理:', colorSize.length, '个SKU')
    console.log('[JD SKU] colorSize第一项:', JSON.stringify(colorSize[0]).substring(0, 200))

    // 1. 找出所有"规格名"（排除非规格字段）
    const excludeKeys = new Set(['skuId', 'stock', 'jdPrice', 'image', 'img', 'imgUrl', 'price'])
    const specNameSet = new Set<string>()

    for (const item of colorSize) {
        Object.keys(item).forEach((key) => {
            if (excludeKeys.has(key)) return
            // 一般都是中文字段，比如 颜色 / 套餐类型 / 款式 等
            if (typeof item[key] === 'string' && item[key].trim()) {
                specNameSet.add(key)
            }
        })
    }

    const specNames = Array.from(specNameSet)
    console.log('[JD SKU] 发现规格名:', specNames)

    if (!specNames.length) {
        console.log('[JD SKU] 未找到规格名')
        return null
    }

    // 2. 聚合规格值（去重）
    const specValuesMap = new Map<string, Set<string>>()
    specNames.forEach((n) => specValuesMap.set(n, new Set()))

    for (const item of colorSize) {
        for (const name of specNames) {
            const v = String(item[name] ?? '').trim()
            if (v) specValuesMap.get(name)!.add(v)
        }
    }

    // 3. 生成规格组
    const specGroups: SpecGroup[] = specNames.map((name) => {
        const values = Array.from(specValuesMap.get(name)!)
        console.log(`[JD SKU] 规格组 "${name}": ${values.length}个值`)
        return {
            name,
            values: values.map((v, idx) => ({
                id: String(idx),
                name: v
            }))
        }
    })

    // 4. 默认选中的规格（优先用页面上真正选中的）
    let defaultItem: JdColorSizeItem | null = null

    try {
        const selectedEl = document.querySelector('#choose-attr-1 .selected a, [id^="choose-"] .selected a, .sku-item.selected a')
        const selectedText = selectedEl?.textContent?.trim() || selectedEl?.getAttribute('title') || ''

        if (selectedText) {
            defaultItem = colorSize.find((it) => {
                // 遍历所有规格字段检查是否匹配
                for (const name of specNames) {
                    const val = String(it[name] ?? '').trim()
                    if (val && selectedText.includes(val)) {
                        return true
                    }
                }
                return false
            }) || null
        }
    } catch (_) {
        // 忽略 DOM 读取错误
    }

    if (!defaultItem) defaultItem = colorSize[0]

    console.log('[JD SKU] 默认规格:', JSON.stringify(defaultItem).substring(0, 100))

    return {
        specGroups,
        skuPrices: [], // 暂不拆分每个SKU价格
        defaultPrice: null,
        defaultSpec: defaultItem
    }
}

/**
 * 从京东页面提取完整SKU数据（用户方案重写版）
 * @param mainWorldColorSize - 从主世界脚本获取的colorSize数组
 */
export async function extractJDSkuData(mainWorldColorSize?: any[]): Promise<JDSkuData> {
    console.log('[JD SKU] 开始采集SKU数据...')

    const result: JDSkuData = {
        specGroups: [],
        skuPrices: [],
        defaultPrice: null
    }

    // 策略1: 强制优先使用colorSize（用户方案核心）
    if (mainWorldColorSize && Array.isArray(mainWorldColorSize) && mainWorldColorSize.length > 0) {
        console.log('[JD SKU] 使用主世界colorSize:', mainWorldColorSize.length, '个SKU')

        const built = buildSkuFromColorSize(mainWorldColorSize)
        if (built && built.specGroups.length > 0) {
            console.log('[JD SKU] colorSize构建成功, 规格组数:', built.specGroups.length)
            result.specGroups = built.specGroups
            result.defaultSpec = built.defaultSpec

            // 提取默认价格（从页面获取）
            const priceEl = document.querySelector('.price, .p-price, #jd-price, [class*="Price"]')
            const priceText = priceEl?.textContent || ''
            const priceMatch = priceText.match(/[\d,.]+/)
            if (priceMatch) {
                result.defaultPrice = parseFloat(priceMatch[0].replace(/,/g, ''))
            }

            // 关键：直接返回，不再走页面文本提取！
            const totalSpecs = result.specGroups.reduce((sum, g) => sum + g.values.length, 0)
            console.log('[JD SKU] 最终结果:', {
                规格组数: result.specGroups.length,
                规格值总数: totalSpecs,
                默认价格: result.defaultPrice
            })
            return result
        }
    }

    // 兜底：只有colorSize完全失败才用页面文本（基本不会走到这里）
    console.log('[JD SKU] colorSize失败，使用页面文本兜底')
    const pageTextData = extractFromPageText()
    if (pageTextData.specGroups.length > 0) {
        result.specGroups = pageTextData.specGroups
        result.defaultPrice = pageTextData.defaultPrice
    }

    const totalSpecs = result.specGroups.reduce((sum, g) => sum + g.values.length, 0)
    console.log('[JD SKU] 最终结果:', {
        规格组数: result.specGroups.length,
        规格值总数: totalSpecs,
        默认价格: result.defaultPrice
    })

    return result
}

/**
 * 从页面文本提取规格（兜底方案，基本不用）
 */
function extractFromPageText(): JDSkuData {
    const result: JDSkuData = {
        specGroups: [],
        skuPrices: [],
        defaultPrice: null
    }

    const priceEl = document.querySelector('.price, .p-price, #jd-price')
    const priceText = priceEl?.textContent || ''
    const priceMatch = priceText.match(/[\d,.]+/)
    if (priceMatch) {
        result.defaultPrice = parseFloat(priceMatch[0].replace(/,/g, ''))
    }

    return result
}

// ========== 兼容旧接口 ==========

export interface SkuVariant {
    skuId: string
    name: string
    specGroup: string
    price: number | null
    image?: string
    stock?: number
    selected?: boolean
}

export async function extractJDSkuVariants(): Promise<SkuVariant[]> {
    return []
}
