// ================= 政采云 SKU 采集模块 =================
// 纯新增模块，不影响任何现有功能
// 支持规格组结构，兼容政采云发布页格式

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
export interface ZcySkuData {
    specGroups: SpecGroup[]
    skuPrices: SkuPrice[]
    defaultPrice: number | null
}

/**
 * 从政采云页面提取完整SKU数据
 */
export async function extractZcySkuData(): Promise<ZcySkuData> {
    console.log('[ZCY SKU] 开始采集SKU数据...')

    const result: ZcySkuData = {
        specGroups: [],
        skuPrices: [],
        defaultPrice: null
    }

    try {
        // 策略1: 从DOM提取规格选择区域
        const domData = extractFromDOM()
        if (domData.specGroups.length > 0) {
            console.log('[ZCY SKU] 从DOM获取规格组:', domData.specGroups.length)
            result.specGroups = domData.specGroups
            result.defaultPrice = domData.defaultPrice
        }

        // 策略2: 从window全局变量提取
        if (result.specGroups.length === 0) {
            const windowData = extractFromWindowVars()
            if (windowData.specGroups.length > 0) {
                console.log('[ZCY SKU] 从window变量获取规格组:', windowData.specGroups.length)
                result.specGroups = windowData.specGroups
                result.skuPrices = windowData.skuPrices
            }
        }

    } catch (e) {
        console.error('[ZCY SKU] 采集异常:', e)
    }

    // 去重处理
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

    const totalSpecs = result.specGroups.reduce((sum, g) => sum + g.values.length, 0)
    console.log('[ZCY SKU] 最终结果:', {
        规格组数: result.specGroups.length,
        规格值总数: totalSpecs,
        默认价格: result.defaultPrice
    })

    return result
}

/**
 * 从DOM元素提取SKU数据
 */
function extractFromDOM(): ZcySkuData {
    const result: ZcySkuData = {
        specGroups: [],
        skuPrices: [],
        defaultPrice: null
    }

    // 政采云规格选择区域选择器
    const specContainerSelectors = [
        '.sku-select',
        '.sku-content',
        '.sku-item',
        '[class*="sku"]',
        '.spec-select',
        '.product-sku'
    ]

    let specContainer: Element | null = null
    for (const sel of specContainerSelectors) {
        specContainer = document.querySelector(sel)
        if (specContainer) break
    }

    if (!specContainer) {
        console.log('[ZCY SKU] 未找到规格容器，使用body')
        specContainer = document.body
    }

    // 查找规格组（政采云结构：规格名 + 规格值按钮/选项）
    const specGroupElements = specContainer.querySelectorAll(
        '[class*="sku-item"], [class*="spec-row"], dl, .sku-row'
    )

    if (specGroupElements.length === 0) {
        // 尝试更宽松的选择：查找包含规格关键词的元素
        const labels = document.querySelectorAll('dt, label, [class*="label"]')

        labels.forEach(label => {
            const text = label.textContent?.trim() || ''
            // 常见规格组名称
            if (['颜色', '颜色分类', '尺码', '尺寸', '规格', '版本', '套餐', '型号'].some(k => text.includes(k))) {
                const container = label.closest('dl, [class*="row"], [class*="item"], div')
                if (container) {
                    const specGroup: SpecGroup = {
                        name: text.replace(/[：:]/g, ''),
                        values: []
                    }

                    // 查找规格值
                    const valueElements = container.querySelectorAll('li, dd, [class*="value"], a, button, span[title]')
                    valueElements.forEach((el, idx) => {
                        const name = el.getAttribute('title') ||
                            el.textContent?.trim() || ''
                        const img = el.querySelector('img')
                        let image = img?.getAttribute('data-src') || img?.src

                        if (name && name.length > 0 && name.length < 60 && !['：', ':'].includes(name)) {
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
            const labelEl = groupEl.querySelector('dt, [class*="label"], label')
            const groupName = labelEl?.textContent?.trim()?.replace(/[：:]/g, '') || `规格${groupIdx + 1}`

            const specGroup: SpecGroup = {
                name: groupName,
                values: []
            }

            // 获取规格值
            const valueElements = groupEl.querySelectorAll('li, dd, [class*="value"], a, button')
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
        '.real-price',
        '.sku-price',
        '.sale-price',
        '[class*="price"]',
        '.price-current'
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
 * 从window全局变量提取SKU数据
 */
function extractFromWindowVars(): ZcySkuData {
    const result: ZcySkuData = {
        specGroups: [],
        skuPrices: [],
        defaultPrice: null
    }
    const win = window as any

    try {
        // 政采云可能的全局变量
        const skuData = win.__SKU_DATA__ ||
            win.pageData?.sku ||
            win.itemData?.skuList ||
            win.__INITIAL_STATE__?.sku

        if (skuData && Array.isArray(skuData.specs)) {
            skuData.specs.forEach((spec: any) => {
                if (spec.values && Array.isArray(spec.values)) {
                    result.specGroups.push({
                        name: spec.name || '规格',
                        values: spec.values.map((v: any, idx: number) => ({
                            id: String(v.id || idx),
                            name: v.name || v.text || '',
                            image: v.image
                        }))
                    })
                }
            })
        }

        // 提取SKU价格
        if (skuData && skuData.skuMap) {
            Object.entries(skuData.skuMap).forEach(([key, value]: [string, any]) => {
                result.skuPrices.push({
                    skuId: String(value.skuId || key),
                    price: parseFloat(value.price) || 0,
                    stock: value.stock,
                    specs: {}
                })
            })
        }

    } catch (e) {
        console.warn('[ZCY SKU] window变量提取失败:', e)
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

/**
 * 兼容旧接口 - 返回扁平化的SKU列表
 */
export async function extractZcySkuVariants(): Promise<SkuVariant[]> {
    const skuData = await extractZcySkuData()
    const variants: SkuVariant[] = []

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
