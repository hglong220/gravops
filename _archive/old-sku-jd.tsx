// ================= 浜笢 SKU 閲囬泦妯″潡 (鐢ㄦ埛鏂规閲嶅啓鐗? =================
// 浼樺厛浣跨敤colorSize缁撴瀯鍖栨暟鎹紝褰诲簳鎶涘純椤甸潰鏂囨湰鎻愬彇鏂规

// 瑙勬牸鍊兼帴鍙?export interface SpecValue {
    id: string
    name: string
    image?: string
}

// 瑙勬牸缁勬帴鍙?export interface SpecGroup {
    name: string
    values: SpecValue[]
}

// SKU缁勫悎浠锋牸鏄犲皠
export interface SkuPrice {
    skuId: string
    price: number
    stock?: number
    specs: Record<string, string>
}

// 瀹屾暣SKU鏁版嵁缁撴瀯
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
 * 浠巆olorSize鏋勫缓SKU瑙勬牸缁勶紙鐢ㄦ埛鏂规鏍稿績鍑芥暟锛? * 鑷姩鎵嚭鎵€鏈夊睘鎬у悕锛屾寜灞炴€у悕鑱氬悎鐢熸垚瑙勬牸缁? */
function buildSkuFromColorSize(colorSize: JdColorSizeItem[]): JDSkuData | null {
    if (!Array.isArray(colorSize) || !colorSize.length) {
        console.log('[JD SKU] colorSize涓虹┖锛屾棤娉曟瀯寤?)
        return null
    }

    console.log('[JD SKU] buildSkuFromColorSize澶勭悊:', colorSize.length, '涓猄KU')
    console.log('[JD SKU] colorSize绗竴椤?', JSON.stringify(colorSize[0]).substring(0, 200))

    // 1. 鎵惧嚭鎵€鏈?瑙勬牸鍚?锛堟帓闄ら潪瑙勬牸瀛楁锛?    const excludeKeys = new Set(['skuId', 'stock', 'jdPrice', 'image', 'img', 'imgUrl', 'price'])
    const specNameSet = new Set<string>()

    for (const item of colorSize) {
        Object.keys(item).forEach((key) => {
            if (excludeKeys.has(key)) return
            // 涓€鑸兘鏄腑鏂囧瓧娈碉紝姣斿 棰滆壊 / 濂楅绫诲瀷 / 娆惧紡 绛?            if (typeof item[key] === 'string' && item[key].trim()) {
                specNameSet.add(key)
            }
        })
    }

    const specNames = Array.from(specNameSet)
    console.log('[JD SKU] 鍙戠幇瑙勬牸鍚?', specNames)

    if (!specNames.length) {
        console.log('[JD SKU] 鏈壘鍒拌鏍煎悕')
        return null
    }

    // 2. 鑱氬悎瑙勬牸鍊硷紙鍘婚噸锛?    const specValuesMap = new Map<string, Set<string>>()
    specNames.forEach((n) => specValuesMap.set(n, new Set()))

    for (const item of colorSize) {
        for (const name of specNames) {
            const v = String(item[name] ?? '').trim()
            if (v) specValuesMap.get(name)!.add(v)
        }
    }

    // 3. 鐢熸垚瑙勬牸缁?    const specGroups: SpecGroup[] = specNames.map((name) => {
        const values = Array.from(specValuesMap.get(name)!)
        console.log(`[JD SKU] 瑙勬牸缁?"${name}": ${values.length}涓€糮)
        return {
            name,
            values: values.map((v, idx) => ({
                id: String(idx),
                name: v
            }))
        }
    })

    // 4. 榛樿閫変腑鐨勮鏍硷紙浼樺厛鐢ㄩ〉闈笂鐪熸閫変腑鐨勶級
    let defaultItem: JdColorSizeItem | null = null

    try {
        const selectedEl = document.querySelector('#choose-attr-1 .selected a, [id^="choose-"] .selected a, .sku-item.selected a')
        const selectedText = selectedEl?.textContent?.trim() || selectedEl?.getAttribute('title') || ''

        if (selectedText) {
            defaultItem = colorSize.find((it) => {
                // 閬嶅巻鎵€鏈夎鏍煎瓧娈垫鏌ユ槸鍚﹀尮閰?                for (const name of specNames) {
                    const val = String(it[name] ?? '').trim()
                    if (val && selectedText.includes(val)) {
                        return true
                    }
                }
                return false
            }) || null
        }
    } catch (_) {
        // 蹇界暐 DOM 璇诲彇閿欒
    }

    if (!defaultItem) defaultItem = colorSize[0]

    console.log('[JD SKU] 榛樿瑙勬牸:', JSON.stringify(defaultItem).substring(0, 100))

    return {
        specGroups,
        skuPrices: [], // 鏆備笉鎷嗗垎姣忎釜SKU浠锋牸
        defaultPrice: null,
        defaultSpec: defaultItem
    }
}

/**
 * 浠庝含涓滈〉闈㈡彁鍙栧畬鏁碨KU鏁版嵁锛堢敤鎴锋柟妗堥噸鍐欑増锛? * @param mainWorldColorSize - 浠庝富涓栫晫鑴氭湰鑾峰彇鐨刢olorSize鏁扮粍
 */
export async function extractJDSkuData(mainWorldColorSize?: any[]): Promise<JDSkuData> {
    console.log('[JD SKU] 寮€濮嬮噰闆哠KU鏁版嵁...')

    const result: JDSkuData = {
        specGroups: [],
        skuPrices: [],
        defaultPrice: null
    }

    // 绛栫暐1: 寮哄埗浼樺厛浣跨敤colorSize锛堢敤鎴锋柟妗堟牳蹇冿級
    if (mainWorldColorSize && Array.isArray(mainWorldColorSize) && mainWorldColorSize.length > 0) {
        console.log('[JD SKU] 浣跨敤涓讳笘鐣宑olorSize:', mainWorldColorSize.length, '涓猄KU')

        const built = buildSkuFromColorSize(mainWorldColorSize)
        if (built && built.specGroups.length > 0) {
            console.log('[JD SKU] colorSize鏋勫缓鎴愬姛, 瑙勬牸缁勬暟:', built.specGroups.length)
            result.specGroups = built.specGroups
            result.defaultSpec = built.defaultSpec

            // 鎻愬彇榛樿浠锋牸锛堜粠椤甸潰鑾峰彇锛?            const priceEl = document.querySelector('.price, .p-price, #jd-price, [class*="Price"]')
            const priceText = priceEl?.textContent || ''
            const priceMatch = priceText.match(/[\d,.]+/)
            if (priceMatch) {
                result.defaultPrice = parseFloat(priceMatch[0].replace(/,/g, ''))
            }

            // 鍏抽敭锛氱洿鎺ヨ繑鍥烇紝涓嶅啀璧伴〉闈㈡枃鏈彁鍙栵紒
            const totalSpecs = result.specGroups.reduce((sum, g) => sum + g.values.length, 0)
            console.log('[JD SKU] 鏈€缁堢粨鏋?', {
                瑙勬牸缁勬暟: result.specGroups.length,
                瑙勬牸鍊兼€绘暟: totalSpecs,
                榛樿浠锋牸: result.defaultPrice
            })
            return result
        }
    }

    // 鍏滃簳锛氬彧鏈塩olorSize瀹屽叏澶辫触鎵嶇敤椤甸潰鏂囨湰锛堝熀鏈笉浼氳蛋鍒拌繖閲岋級
    console.log('[JD SKU] colorSize澶辫触锛屼娇鐢ㄩ〉闈㈡枃鏈厹搴?)
    const pageTextData = extractFromPageText()
    if (pageTextData.specGroups.length > 0) {
        result.specGroups = pageTextData.specGroups
        result.defaultPrice = pageTextData.defaultPrice
    }

    const totalSpecs = result.specGroups.reduce((sum, g) => sum + g.values.length, 0)
    console.log('[JD SKU] 鏈€缁堢粨鏋?', {
        瑙勬牸缁勬暟: result.specGroups.length,
        瑙勬牸鍊兼€绘暟: totalSpecs,
        榛樿浠锋牸: result.defaultPrice
    })

    return result
}

/**
 * 浠庨〉闈㈡枃鏈彁鍙栬鏍硷紙鍏滃簳鏂规锛屽熀鏈笉鐢級
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

// ========== 鍏煎鏃ф帴鍙?==========

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
