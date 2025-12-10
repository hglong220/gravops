// ================= 天猫 SKU 采集模块 (增强版) =================
// 纯新增模块，不影响任何现有功能
// 支持规格组结构，兼容政采云格式

// 规格值接口
export interface SpecValue {
    id: string          // 规格值ID
    name: string        // 规格值名称，如"黑色8056"
    image?: string      // 缩略图URL
}

// 规格组接口
export interface SpecGroup {
    name: string        // 规格组名，如"颜色分类"/"尺码"
    values: SpecValue[] // 规格值列表
}

// SKU组合价格映射
export interface SkuPrice {
    skuId: string
    price: number
    stock?: number
    specs: Record<string, string>  // 如 {"颜色分类": "黑色8056", "尺码": "170/92A"}
}

// 完整SKU数据结构（兼容政采云）
export interface TmallSkuData {
    specGroups: SpecGroup[]      // 规格组定义
    skuPrices: SkuPrice[]        // SKU价格列表
    defaultPrice: number | null  // 默认/当前价格
}

/**
 * 从天猫页面提取完整SKU数据
 */
export async function extractTmallSkuData(): Promise<TmallSkuData> {
    console.log('[Tmall SKU] 开始采集SKU数据...')

    const result: TmallSkuData = {
        specGroups: [],
        skuPrices: [],
        defaultPrice: null
    }

    try {
        // 策略1: 从window全局变量提取（最完整）
        const windowData = extractFromWindowVars()
        if (windowData.specGroups.length > 0) {
            console.log('[Tmall SKU] 从window变量获取规格组:', windowData.specGroups.length)
            result.specGroups = windowData.specGroups
            result.skuPrices = windowData.skuPrices
            result.defaultPrice = windowData.defaultPrice
        }

        // 策略2: 从DOM提取（补充或备用）
        if (result.specGroups.length === 0) {
            const domData = extractFromDOM()
            if (domData.specGroups.length > 0) {
                console.log('[Tmall SKU] 从DOM获取规格组:', domData.specGroups.length)
                result.specGroups = domData.specGroups
                result.defaultPrice = domData.defaultPrice
            }
        }

        // 策略3: 从Script标签提取
        if (result.specGroups.length === 0) {
            const scriptData = extractFromScripts()
            if (scriptData.specGroups.length > 0) {
                console.log('[Tmall SKU] 从Script标签获取规格组:', scriptData.specGroups.length)
                result.specGroups = scriptData.specGroups
                result.skuPrices = scriptData.skuPrices
            }
        }

    } catch (e) {
        console.error('[Tmall SKU] 采集异常:', e)
    }

    // 去重处理：移除重复的规格值
    result.specGroups = result.specGroups.map(group => {
        const seen = new Set<string>()
        const uniqueValues = group.values.filter(v => {
            const key = v.name.trim()
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
        return { ...group, values: uniqueValues }
    })

    // 统计
    const totalSpecs = result.specGroups.reduce((sum, g) => sum + g.values.length, 0)
    console.log('[Tmall SKU] 最终结果:', {
        规格组数: result.specGroups.length,
        规格值总数: totalSpecs,
        SKU价格数: result.skuPrices.length,
        默认价格: result.defaultPrice
    })

    return result
}

/**
 * 从window全局变量提取SKU数据
 */
function extractFromWindowVars(): TmallSkuData {
    const result: TmallSkuData = {
        specGroups: [],
        skuPrices: [],
        defaultPrice: null
    }
    const win = window as any

    try {
        // 尝试多个可能的全局变量路径
        const globalData = win.__GLOBAL_DATA__ ||
            win.g_config ||
            win.Hub?.config ||
            win.__INIT_DATA__?.data

        if (!globalData) {
            console.log('[Tmall SKU] 未找到全局变量')
            return result
        }

        // 提取规格属性定义 (propertyMemoMap / props)
        const propData = globalData.propertyMemoMap ||
            globalData.props ||
            globalData.skuBase?.props ||
            globalData.itemDO?.propertyMemoMap

        if (propData && Array.isArray(propData)) {
            propData.forEach((prop: any) => {
                if (prop.values && Array.isArray(prop.values)) {
                    const specGroup: SpecGroup = {
                        name: prop.name || prop.propName || '规格',
                        values: prop.values.map((v: any, idx: number) => ({
                            id: String(v.vid || v.valueId || idx),
                            name: v.name || v.text || v.value || '',
                            image: v.image || v.imgUrl || undefined
                        }))
                    }
                    if (specGroup.values.length > 0) {
                        result.specGroups.push(specGroup)
                    }
                }
            })
        }

        // 提取SKU价格映射 (skuMap / valItemInfo)
        const skuMap = globalData.skuMap ||
            globalData.valItemInfo?.skuMap ||
            globalData.skuBase?.skuMap

        if (skuMap && typeof skuMap === 'object') {
            Object.entries(skuMap).forEach(([key, value]: [string, any]) => {
                if (value && typeof value === 'object') {
                    // key格式可能是 "1627207:28320;20509:28317" 或 "黑色;XL"
                    const specs: Record<string, string> = {}

                    // 尝试解析specs
                    const parts = key.split(';')
                    parts.forEach((part, idx) => {
                        if (result.specGroups[idx]) {
                            specs[result.specGroups[idx].name] = part
                        }
                    })

                    result.skuPrices.push({
                        skuId: String(value.skuId || key),
                        price: parseFloat(value.price || value.promotionPrice) || 0,
                        stock: value.quantity || value.stock,
                        specs
                    })
                }
            })
        }

        // 提取默认/当前价格
        const priceInfo = globalData.price ||
            globalData.itemDO?.price ||
            globalData.apiItemDO?.price

        if (priceInfo) {
            result.defaultPrice = parseFloat(
                priceInfo.price ||
                priceInfo.promotionPrice ||
                priceInfo.originalPrice ||
                priceInfo
            ) || null
        }

    } catch (e) {
        console.warn('[Tmall SKU] window变量提取失败:', e)
    }

    return result
}

/**
 * 从DOM元素提取SKU数据
 * 适配天猫新版/老版页面结构
 */
function extractFromDOM(): TmallSkuData {
    const result: TmallSkuData = {
        specGroups: [],
        skuPrices: [],
        defaultPrice: null
    }

    // 规格区域容器选择器
    const specContainerSelectors = [
        '[class*="SkuContent"]',      // 新版天猫
        '[class*="skuContent"]',
        '.tm-sku',                     // 老版天猫
        '.tb-sku',
        '#J_isku'
    ]

    let specContainer: Element | null = null
    for (const sel of specContainerSelectors) {
        specContainer = document.querySelector(sel)
        if (specContainer) break
    }

    if (!specContainer) {
        console.log('[Tmall SKU] 未找到规格容器')
        // 尝试直接搜索规格组
        specContainer = document.body
    }

    // 查找规格组
    // 天猫结构通常是: 规格组标签 + 规格值按钮列表
    const specGroupElements = specContainer.querySelectorAll(
        '[class*="skuItem"], .tm-sell, .tb-prop, [class*="SkuItem"]'
    )

    if (specGroupElements.length === 0) {
        // 尝试更宽松的选择
        // 查找包含规格名称的dt元素
        const dtElements = document.querySelectorAll('dt, [class*="label"]')

        dtElements.forEach(dt => {
            const text = dt.textContent?.trim() || ''
            // 常见规格组名称
            if (['颜色分类', '颜色', '尺码', '尺寸', '版本', '规格', '套餐'].some(k => text.includes(k))) {
                const container = dt.closest('dl, [class*="row"], [class*="item"]')
                if (container) {
                    const specGroup: SpecGroup = {
                        name: text.replace(/[：:]/g, ''),
                        values: []
                    }

                    // 查找规格值
                    const valueElements = container.querySelectorAll('li, [class*="value"], a[title], span[title]')
                    valueElements.forEach((el, idx) => {
                        const name = el.getAttribute('title') ||
                            el.textContent?.trim() || ''
                        const img = el.querySelector('img')
                        const image = img?.getAttribute('data-src') || img?.src

                        if (name && name.length < 50) {
                            specGroup.values.push({
                                id: String(idx),
                                name: name,
                                image: image || undefined
                            })
                        }
                    })

                    if (specGroup.values.length > 0) {
                        result.specGroups.push(specGroup)
                    }
                }
            }
        })
    } else {
        // 处理找到的规格组元素
        specGroupElements.forEach((groupEl, groupIdx) => {
            // 尝试获取规格组名称
            const labelEl = groupEl.querySelector('[class*="label"], dt, .tb-prop-title')
            const groupName = labelEl?.textContent?.trim()?.replace(/[：:]/g, '') || `规格${groupIdx + 1}`

            const specGroup: SpecGroup = {
                name: groupName,
                values: []
            }

            // 获取规格值
            const valueElements = groupEl.querySelectorAll('li, [class*="valueItem"], a, span[title]')
            valueElements.forEach((el, idx) => {
                const htmlEl = el as HTMLElement
                const name = htmlEl.getAttribute('title') ||
                    htmlEl.getAttribute('data-value') ||
                    htmlEl.textContent?.trim() || ''

                const img = el.querySelector('img') as HTMLImageElement
                let image = img?.getAttribute('data-src') || img?.src
                if (image?.startsWith('//')) image = 'https:' + image

                if (name && name.length > 0 && name.length < 80) {
                    specGroup.values.push({
                        id: htmlEl.getAttribute('data-value') || String(idx),
                        name: name,
                        image: image || undefined
                    })
                }
            })

            if (specGroup.values.length > 0) {
                result.specGroups.push(specGroup)
            }
        })
    }

    // 提取当前显示的价格
    const priceSelectors = [
        '[class*="Price--priceText"]',
        '[class*="priceText"]',
        '.tm-price',
        '.tb-rmb-num',
        '#J_StrPrice .tm-price'
    ]

    for (const sel of priceSelectors) {
        const priceEl = document.querySelector(sel)
        if (priceEl) {
            const priceText = priceEl.textContent || ''
            const match = priceText.match(/[\d,.]+/)
            if (match) {
                result.defaultPrice = parseFloat(match[0].replace(/,/g, ''))
                break
            }
        }
    }

    return result
}

/**
 * 从Script标签提取SKU数据
 */
function extractFromScripts(): TmallSkuData {
    const result: TmallSkuData = {
        specGroups: [],
        skuPrices: [],
        defaultPrice: null
    }

    const scripts = document.querySelectorAll('script:not([src])')

    for (const script of scripts) {
        const text = script.textContent || ''

        // 查找包含SKU数据的模式
        if (text.includes('propertyMemoMap') || text.includes('skuMap') || text.includes('props')) {
            try {
                // 尝试提取props数组
                const propsMatch = text.match(/"props"\s*:\s*(\[[^\]]+\])/s)
                if (propsMatch) {
                    const props = JSON.parse(propsMatch[1])
                    if (Array.isArray(props)) {
                        props.forEach((prop: any) => {
                            if (prop.values && Array.isArray(prop.values)) {
                                result.specGroups.push({
                                    name: prop.name || '规格',
                                    values: prop.values.map((v: any, idx: number) => ({
                                        id: String(v.vid || idx),
                                        name: v.name || '',
                                        image: v.image
                                    }))
                                })
                            }
                        })
                    }
                }

                // 尝试提取skuMap
                const skuMapMatch = text.match(/"skuMap"\s*:\s*(\{[^}]+\})/s)
                if (skuMapMatch) {
                    const skuMap = JSON.parse(skuMapMatch[1])
                    Object.entries(skuMap).forEach(([key, value]: [string, any]) => {
                        result.skuPrices.push({
                            skuId: String(value.skuId || key),
                            price: parseFloat(value.price) || 0,
                            specs: {}
                        })
                    })
                }

            } catch (e) {
                // JSON解析失败，继续下一个script
            }
        }
    }

    return result
}

// ========== 兼容旧接口 ==========
// 保持向后兼容，旧的 extractTmallSkuVariants 函数仍可用

export interface SkuVariant {
    skuId: string
    name: string
    specGroup: string
    price: number | null
    image?: string
    stock?: number
    selected?: boolean
}

/**
 * 兼容旧接口 - 返回扁平化的SKU列表
 */
export async function extractTmallSkuVariants(): Promise<SkuVariant[]> {
    const skuData = await extractTmallSkuData()
    const variants: SkuVariant[] = []

    // 将规格组数据转换为扁平列表
    skuData.specGroups.forEach(group => {
        group.values.forEach(value => {
            variants.push({
                skuId: value.id,
                name: value.name,
                specGroup: group.name,
                price: skuData.defaultPrice,
                image: value.image
            })
        })
    })

    return variants
}
