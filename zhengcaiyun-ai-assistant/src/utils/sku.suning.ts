// ================= 苏宁 SKU 采集模块 (增强版) =================
// 纯新增模块，不影响任何现有功能
// 支持规格组结构，兼容政采云格式

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

// 完整SKU数据结构（兼容政采云）
export interface SuningSkuData {
    specGroups: SpecGroup[]
    skuPrices: SkuPrice[]
    defaultPrice: number | null
}

/**
 * 从苏宁页面提取完整SKU数据
 */
export async function extractSuningSkuData(): Promise<SuningSkuData> {
    console.log('[Suning SKU] 开始采集SKU数据...')

    const result: SuningSkuData = {
        specGroups: [],
        skuPrices: [],
        defaultPrice: null
    }

    try {
        // 策略1: 从DOM提取（苏宁主要靠DOM）
        const domData = extractFromDOM()
        if (domData.specGroups.length > 0) {
            console.log('[Suning SKU] 从DOM获取规格组:', domData.specGroups.length)
            result.specGroups = domData.specGroups
            result.defaultPrice = domData.defaultPrice
        }

        // 策略2: 从window全局变量提取
        if (result.specGroups.length === 0) {
            const windowData = extractFromWindowVars()
            if (windowData.specGroups.length > 0) {
                console.log('[Suning SKU] 从window变量获取规格组:', windowData.specGroups.length)
                result.specGroups = windowData.specGroups
                result.skuPrices = windowData.skuPrices
            }
        }

        // 策略3: 从Script标签提取
        if (result.specGroups.length === 0) {
            const scriptData = extractFromScripts()
            if (scriptData.specGroups.length > 0) {
                console.log('[Suning SKU] 从Script标签获取规格组:', scriptData.specGroups.length)
                result.specGroups = scriptData.specGroups
            }
        }

    } catch (e) {
        console.error('[Suning SKU] 采集异常:', e)
    }

    // ========== 严格过滤：只保留颜色/尺码相关的规格组 ==========
    const validSpecKeywords = ['颜色', '尺码', '尺寸', '规格', '版本', '套餐', '容量', '内存', '配置', '型号', '包装', '瓶装', '箱装']
    const invalidKeywords = [
        '本店', '所有商品', '优惠', '满减', '立减', '直降', '补贴', '赠品', '套餐优惠',
        '任性付', '任 性 付', '任性', '分期', '租期', '区域', '联系', '客服', '验证码',
        '女装', '男装', '配饰', '上装', '下装', '套装', '皮衣', '皮裤', '羽绒',
        '返券', '支付', '免运费', '换新', '维修', '全区',
        '支持', '回收', '电脑类目', '平板电脑类目', '手机类目', '类目',
        '存储', '增值服务', '配件', '保险', '延保', '碎屏保',
        '精品', '推荐', '热卖', '新品', '季节', '春夏秋冬',
        '屏幕', 'CPU', '网络', '电池', '处理器', '摄像头', '功率', '重量',
        // 新增更多无效关键词
        '购物指南', '会员等级', '常见问题', '免费注册', '支付方式', '售后服务',
        '配送', '物流', '送货', '安装', '服务', '说明', '注意', '提示',
        '分期付款', '云钻', '花呗', '白条', '信用卡', '储值卡'
    ]

    result.specGroups = result.specGroups.filter(group => {
        // 去除空格后匹配
        const name = group.name.replace(/\s+/g, '')
        
        // 必须包含有效关键词之一
        const isValidSpec = validSpecKeywords.some(k => name.includes(k))
        // 不能包含无效关键词（去除空格后匹配）
        const isInvalid = invalidKeywords.some(k => name.replace(/\s+/g, '').includes(k.replace(/\s+/g, '')))

        if (isInvalid) {
            console.log(`[Suning SKU] 过滤无效规格组: ${group.name}`)
            return false
        }

        // 如果名称不包含有效关键词但值过多（>15，可能是分类），也过滤
        if (!isValidSpec && group.values.length > 15) {
            console.log(`[Suning SKU] 过滤疑似分类: ${group.name} (${group.values.length}个值)`)
            return false
        }

        // 如果不包含有效关键词且值只有1个，可能也不是有效规格
        if (!isValidSpec && group.values.length <= 1) {
            console.log(`[Suning SKU] 过滤单值非规格: ${group.name}`)
            return false
        }

        return true
    })

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

    const totalSpecs = result.specGroups.reduce((sum, g) => sum + g.values.length, 0)
    console.log('[Suning SKU] 最终结果:', {
        规格组数: result.specGroups.length,
        规格值总数: totalSpecs,
        默认价格: result.defaultPrice
    })

    return result
}

/**
 * 从DOM元素提取SKU数据 (优化版)
 * 适配苏宁最新页面结构
 */
function extractFromDOM(): SuningSkuData {
    const result: SuningSkuData = {
        specGroups: [],
        skuPrices: [],
        defaultPrice: null
    }

    console.log('[Suning SKU] 开始DOM提取...')

    // 方式1: 苏宁规格选择区域 - 扩展选择器
    const containerSelectors = [
        '#cluster-choose',            // 主规格选择
        '.choose-cluster',            // 选择聚合
        '.clr-hover-main',            // 颜色hover主区域
        '.choose-attr-list',          // 属性列表
        '.choose-wrap',               // 选择包装
        '.prod-choose',               // 商品选择
        '.salesProperty',             // 销售属性
        '[class*="choose"]',          // 任何包含choose的
        '.product-detail-wrap'        // 商品详情包装
    ]

    let mainContainer: Element | null = null
    for (const sel of containerSelectors) {
        mainContainer = document.querySelector(sel)
        if (mainContainer && mainContainer.querySelectorAll('dl, li, [class*="item"]').length > 0) {
            console.log('[Suning SKU] 找到容器:', sel)
            break
        }
    }

    if (!mainContainer) {
        console.log('[Suning SKU] 未找到主容器,使用body')
        mainContainer = document.body
    }

    // 查找规格组 - 多种结构尝试
    const dlElements = mainContainer.querySelectorAll('dl')

    if (dlElements.length > 0) {
        console.log('[Suning SKU] 找到dl元素:', dlElements.length)

        dlElements.forEach((dl, dlIdx) => {
            const dt = dl.querySelector('dt, .clr-lbl, [class*="label"]')
            let groupName = dt?.textContent?.trim()?.replace(/[：:]/g, '') || ''

            // 过滤非规格项
            const skipKeywords = ['数量', '送至', '配送', '运费', '服务', '店铺', '赠品']
            if (skipKeywords.some(k => groupName.includes(k)) || !groupName) {
                return
            }

            // 判断是否是规格相关
            const specKeywords = ['颜色', '尺码', '尺寸', '规格', '版本', '套餐', '型号', '容量', '大小']
            const isSpecGroup = specKeywords.some(k => groupName.includes(k))

            const specGroup: SpecGroup = {
                name: groupName || `规格${dlIdx + 1}`,
                values: []
            }

            // 获取规格值 - 扩展选择器
            const valueSelectors = [
                'dd li',
                'dd a[title]',
                'dd .clr-item',
                'dd [data-partnum]',
                'dd [class*="item"]',
                'dd span[title]'
            ]

            const items = dl.querySelectorAll(valueSelectors.join(', '))
            console.log(`[Suning SKU] ${groupName} 找到项数:`, items.length)

            items.forEach((item, idx) => {
                const el = item as HTMLElement
                const link = el.querySelector('a') as HTMLAnchorElement
                const img = el.querySelector('img') as HTMLImageElement

                // 提取名称 - 多种方式
                let name = el.getAttribute('title') ||
                    el.getAttribute('data-attr-value') ||
                    link?.getAttribute('title') ||
                    el.querySelector('span')?.textContent?.trim() ||
                    el.textContent?.trim() || ''

                // 清理名称
                name = name.replace(/\s+/g, ' ').trim()
                if (name.length > 80) name = name.substring(0, 80)

                // 提取图片
                let image = img?.getAttribute('data-url') ||
                    img?.getAttribute('data-src') ||
                    img?.getAttribute('data-original') ||
                    img?.src || ''
                if (image.startsWith('//')) image = 'https:' + image

                // 提取SKU ID
                const skuId = el.getAttribute('data-partnum') ||
                    link?.getAttribute('data-partnum') ||
                    el.getAttribute('data-sku') ||
                    String(idx)

                // 过滤无效项
                if (name && name.length > 1 && !['选择', '请选择', '暂无'].includes(name)) {
                    specGroup.values.push({
                        id: skuId,
                        name: name,
                        image: image || undefined
                    })
                }
            })

            if (specGroup.values.length > 0) {
                console.log(`[Suning SKU] 添加规格组: ${groupName} (${specGroup.values.length}个值)`)
                result.specGroups.push(specGroup)
            }
        })
    }

    // 方式2: 如果dl方式没找到,尝试直接查找颜色/尺码区域
    if (result.specGroups.length === 0) {
        console.log('[Suning SKU] dl方式未找到,尝试备用方式')

        // 查找包含颜色/尺码关键词的标签
        const labels = mainContainer.querySelectorAll('dt, label, [class*="label"], [class*="name"], span')

        labels.forEach((label, idx) => {
            const labelText = label.textContent?.trim()?.replace(/[：:]/g, '') || ''
            const specKeywords = ['颜色', '尺码', '尺寸', '规格', '版本', '型号']

            if (!specKeywords.some(k => labelText.includes(k))) return
            if (labelText.length > 10) return // 过长的不是标签

            const container = label.closest('dl, div, [class*="row"], [class*="list"]')
            if (!container) return

            const specGroup: SpecGroup = {
                name: labelText,
                values: []
            }

            const items = container.querySelectorAll('li, a[title], span[title], [class*="item"]')
            items.forEach((item, itemIdx) => {
                const el = item as HTMLElement
                const name = el.getAttribute('title') ||
                    el.textContent?.trim() || ''
                const img = item.querySelector('img') as HTMLImageElement
                let image = img?.src || ''
                if (image.startsWith('//')) image = 'https:' + image

                if (name && name.length > 1 && name.length < 80 && name !== labelText) {
                    specGroup.values.push({
                        id: String(itemIdx),
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

    // 方式3: 更宽松的选择器
    if (result.specGroups.length === 0) {
        console.log('[Suning SKU] 尝试更宽松的选择器')

        const altContainers = document.querySelectorAll(
            '.choose-color-type, .choose-size-type, .saletype-list, [class*="color-list"], [class*="size-list"]'
        )

        altContainers.forEach((container, groupIdx) => {
            // 尝试从class名推断规格类型
            const className = container.className || ''
            let groupName = '规格'
            if (className.includes('color')) groupName = '颜色'
            else if (className.includes('size')) groupName = '尺码'

            const specGroup: SpecGroup = {
                name: groupName,
                values: []
            }

            container.querySelectorAll('li, a, span[title]').forEach((el, idx) => {
                const name = (el as HTMLElement).getAttribute('title') ||
                    (el as HTMLElement).textContent?.trim() || ''
                if (name && name.length > 1 && name.length < 60) {
                    specGroup.values.push({
                        id: String(idx),
                        name: name
                    })
                }
            })

            if (specGroup.values.length > 0) {
                result.specGroups.push(specGroup)
            }
        })
    }

    // 提取当前价格
    const priceSelectors = [
        '.mainprice',
        '#itemDisplayPrice',
        '.price-current',
        '.promo-price',
        '[class*="price"] .price',
        '.product-price .price'
    ]

    for (const sel of priceSelectors) {
        const priceEl = document.querySelector(sel)
        if (priceEl) {
            const match = priceEl.textContent?.match(/[\d,.]+/)
            if (match) {
                result.defaultPrice = parseFloat(match[0].replace(/,/g, ''))
                break
            }
        }
    }

    console.log('[Suning SKU] DOM提取完成, 规格组:', result.specGroups.length)
    return result
}

/**
 * 从window全局变量提取SKU数据
 */
function extractFromWindowVars(): SuningSkuData {
    const result: SuningSkuData = {
        specGroups: [],
        skuPrices: [],
        defaultPrice: null
    }
    const win = window as any

    try {
        // 苏宁可能的全局变量
        const clusterData = win.clusterData || win.pageConfig?.cluster || []

        if (Array.isArray(clusterData)) {
            clusterData.forEach((cluster: any) => {
                if (cluster.items && Array.isArray(cluster.items)) {
                    const specGroup: SpecGroup = {
                        name: cluster.name || '规格',
                        values: cluster.items.map((item: any, idx: number) => ({
                            id: String(item.partNum || item.id || idx),
                            name: item.attrValue || item.name || '',
                            image: item.img
                        }))
                    }
                    if (specGroup.values.length > 0) {
                        result.specGroups.push(specGroup)
                    }
                }
            })
        }

    } catch (e) {
        console.warn('[Suning SKU] window变量提取失败:', e)
    }

    return result
}

/**
 * 从Script标签提取SKU数据
 */
function extractFromScripts(): SuningSkuData {
    const result: SuningSkuData = {
        specGroups: [],
        skuPrices: [],
        defaultPrice: null
    }

    const scripts = document.querySelectorAll('script:not([src])')

    for (const script of scripts) {
        const text = script.textContent || ''

        if (text.includes('clusterData') || text.includes('skuInfo')) {
            try {
                const clusterMatch = text.match(/clusterData\s*[:=]\s*(\[[^\]]+\])/s)
                if (clusterMatch) {
                    const clusterData = JSON.parse(clusterMatch[1])
                    if (Array.isArray(clusterData)) {
                        clusterData.forEach((cluster: any) => {
                            if (cluster.items) {
                                result.specGroups.push({
                                    name: cluster.name || '规格',
                                    values: cluster.items.map((item: any, idx: number) => ({
                                        id: String(item.partNum || idx),
                                        name: item.attrValue || ''
                                    }))
                                })
                            }
                        })
                    }
                }

            } catch (e) {
                // 继续下一个
            }
        }
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
export async function extractSuningSkuVariants(): Promise<SkuVariant[]> {
    const skuData = await extractSuningSkuData()
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
