/**
 * ZCY Professional Scraper V2.2 - 政采云专业级数据采集引擎（修复版）
 * 
 * V2.2 修复：
 * 1. 标题提取：更精确的选择器，避免抓到服务选项
 * 2. 图片URL：确保完整路径
 * 3. 规格参数：过滤价格等脏数据
 * 4. 详情图：改进提取逻辑
 */

// ========== 类型定义 ==========

interface ExtractedData {
    title: string
    price: string
    brand: string
    model: string
    specs: Record<string, string>
    images: string[]
    detailImages: string[]
    detailHtml: string
    shopName: string
    originalUrl: string
    zcyItemUrl: string
}

interface ParamRow {
    label: string
    value: string
}

// ========== 1. 图片过滤逻辑 ==========

function isUsefulImage(url: string): boolean {
    if (!url) return false
    // Quick validation before URL construction
    if (!url.startsWith('http') && !url.startsWith('//') && !url.startsWith('/')) {
        return url.includes('itemcdn.zcycdn.com')
    }
    try {
        // Normalize the URL first
        let normalizedUrl = url
        if (url.startsWith('//')) {
            normalizedUrl = 'https:' + url
        } else if (url.startsWith('/') && !url.startsWith('//')) {
            normalizedUrl = 'https://itemcdn.zcycdn.com' + url
        }
        const u = new URL(normalizedUrl)
        // 仅保留 itemcdn 图片
        if (!u.hostname.includes('itemcdn.zcycdn.com')) return false
        // 后缀限制（也接受无后缀的CDN图片）
        const path = u.pathname.toLowerCase()
        if (path.includes('.') && !/\.(jpg|jpeg|png|webp|gif)$/i.test(path)) return false
        return true
    } catch (e) {
        // 如果URL解析失败，检查是否是相对路径
        console.warn('[ZCY Pro V2] URL parse failed:', url.substring(0, 50), e)
        return url.includes('itemcdn.zcycdn.com')
    }
}

function normalizeImageUrl(url: string): string {
    if (!url) return ''
    // 处理协议相对URL
    if (url.startsWith('//')) {
        return 'https:' + url
    }
    // 处理相对路径
    if (url.startsWith('/') && !url.startsWith('//')) {
        return 'https://itemcdn.zcycdn.com' + url
    }
    return url
}

function extractImages(): string[] {
    const allImages: string[] = []
    const seen = new Set<string>()

    const imgSelectors = [
        // ZCY特定选择器
        '.sku-preview img',
        '.preview-box img',
        '.item-gallery img',
        '.swiper-slide img',
        '.thumbnail-list img',
        'li.swiper-slide img',
        // 更通用的
        '[class*="preview"] img',
        '[class*="gallery"] img',
        '[class*="thumb"] img',
        '[class*="sku"] img',
        'img[data-src*="itemcdn"]',
        'img[src*="itemcdn"]'
    ]

    for (const sel of imgSelectors) {
        try {
            document.querySelectorAll(sel).forEach(img => {
                const imgEl = img as HTMLImageElement
                let src = imgEl.src ||
                    imgEl.getAttribute('data-src') ||
                    imgEl.getAttribute('data-lazy') ||
                    imgEl.getAttribute('data-original') || ''

                src = normalizeImageUrl(src)

                if (src && !seen.has(src)) {
                    seen.add(src)
                    allImages.push(src)
                }
            })
        } catch { }
    }

    // 兜底：扫描所有含itemcdn的图片
    if (allImages.length === 0) {
        document.querySelectorAll('img').forEach(img => {
            const imgEl = img as HTMLImageElement
            let src = imgEl.src || imgEl.getAttribute('data-src') || ''
            src = normalizeImageUrl(src)
            if (src && src.includes('itemcdn') && !seen.has(src)) {
                seen.add(src)
                allImages.push(src)
            }
        })
    }

    const filtered = allImages.filter(isUsefulImage)
    console.log(`[ZCY Pro V2] 主图过滤: 原始=${allImages.length}, 有效=${filtered.length}`)
    if (filtered.length > 0) {
        console.log('[ZCY Pro V2] 主图样例:', filtered[0].substring(0, 80))
    }
    return filtered.slice(0, 10)
}

// ========== 2. 详情图提取 ==========

async function extractDetailImages(mainImages: string[]): Promise<string[]> {
    const allImages: string[] = []
    const mainSet = new Set(mainImages)

    // 点击商品详情Tab
    await clickDetailTab()
    await sleep(1000)

    // 查找详情内容区域
    const detailContainers = [
        '#pane-introduction',
        '#pane-detail',
        '[id*="introduction"]',
        '.item-detail',
        '.goods-desc',
        '.detail-desc',
        '.detail-content',
        '.rich-text',
        '[class*="introduction"]',
        '[class*="description"]',
        '[class*="detail-info"]'
    ]

    for (const sel of detailContainers) {
        try {
            const container = document.querySelector(sel)
            if (container) {
                container.querySelectorAll('img').forEach(img => {
                    const imgEl = img as HTMLImageElement
                    let src = imgEl.src ||
                        imgEl.getAttribute('data-src') ||
                        imgEl.getAttribute('data-lazy') ||
                        imgEl.getAttribute('data-original') || ''

                    src = normalizeImageUrl(src)

                    if (src && !mainSet.has(src) && src.includes('itemcdn')) {
                        allImages.push(src)
                    }
                })
            }
        } catch { }
    }

    // 去重并过滤
    const unique = [...new Set(allImages)]
    const filtered = unique.filter(isUsefulImage)
    console.log(`[ZCY Pro V2] 详情图过滤: 原始=${unique.length}, 有效=${filtered.length}`)
    return filtered.slice(0, 30)
}

async function clickDetailTab(): Promise<boolean> {
    const tabSelectors = [
        '#tab-introduction',
        '[id*="introduction"]',
        '[role="tab"]',
        '.po-tabs__item',
        '.el-tabs__item'
    ]

    for (const selector of tabSelectors) {
        const tabs = document.querySelectorAll(selector)
        for (const tab of tabs) {
            const text = tab.textContent?.trim() || ''
            if (text.includes('商品详情') || text.includes('商品介绍') || text === '详情') {
                console.log('[ZCY Pro V2] 点击商品详情Tab:', text)
                    ; (tab as HTMLElement).click()
                return true
            }
        }
    }
    return false
}

// ========== 3. 原始链接提取 ==========

function findEcommerceLink(): { ecommerceUrl: string; zcyUrl: string } {
    const zcyUrl = window.location.href
    let ecommerceUrl = ''

    const jdLinks: string[] = []
    const tmallLinks: string[] = []

    // 查找跳转链接
    document.querySelectorAll('a[href*="/eevees/link"], a[href*="target="]').forEach(a => {
        const href = (a as HTMLAnchorElement).href || ''
        const match = href.match(/target=([^&]+)/)
        if (match) {
            try {
                const decoded = decodeURIComponent(match[1])
                if (decoded.includes('jd.com')) {
                    jdLinks.push(decoded)
                } else if (decoded.includes('tmall.com')) {
                    tmallLinks.push(decoded)
                }
            } catch { }
        }
    })

    // 直接链接
    document.querySelectorAll('a[href*="jd.com"], a[href*="tmall.com"]').forEach(a => {
        const href = (a as HTMLAnchorElement).href || ''
        if (href.includes('jd.com') && !jdLinks.includes(href)) {
            jdLinks.push(href)
        } else if (href.includes('tmall.com') && !tmallLinks.includes(href)) {
            tmallLinks.push(href)
        }
    })

    if (jdLinks.length > 0) {
        ecommerceUrl = jdLinks[0]
    } else if (tmallLinks.length > 0) {
        ecommerceUrl = tmallLinks[0]
    }

    const linkType = ecommerceUrl.includes('jd.com') ? 'JD' :
        ecommerceUrl.includes('tmall') ? 'Tmall' : 'ZCY'
    console.log(`[ZCY Pro V2] 原始链接: ${linkType} -> ${(ecommerceUrl || zcyUrl).substring(0, 60)}`)

    return {
        ecommerceUrl: ecommerceUrl || zcyUrl,
        zcyUrl
    }
}

// ========== 4. 规格参数精细解析 ==========

const MODEL_LABELS = ['型号', '产品型号', '规格型号', '型号规格']
const BRAND_LABELS = ['品牌', '商品品牌']
const COLOR_LABELS = ['颜色', '颜色分类', '外观颜色']
const SIZE_LABELS = ['尺寸', '产品尺寸', '外形尺寸']
const WEIGHT_LABELS = ['重量', '净重', '毛重']
const POWER_LABELS = ['功率', '额定功率']
const VOLT_LABELS = ['电压', '额定电压']
const CAP_LABELS = ['容量', '产品容量']
const UNIT_LABELS = ['计量单位', '单位']

function cleanLabel(raw: string): string {
    return raw.replace(/[：:：\s]/g, '').trim()
}

function cleanValue(label: string, raw: string): string {
    let v = raw.trim()
    v = v.replace(new RegExp(label, 'g'), '').trim()
    v = v.replace(/^其他参数\s*/g, '')
    v = v.replace(/^更多参数\s*/g, '')
    return v.trim()
}

function isValidBrand(value: string): boolean {
    const v = value.trim()
    if (!v) return false
    if (v.length > 25) return false
    const badKeywords = ['政采云', '供应商', '平台', '专卖店', '服务承诺', '评价', '成交记录', '授权', '引入']
    if (badKeywords.some(k => v.includes(k))) return false
    return true
}

/**
 * 判断是否是有效的规格参数值（过滤脏数据）
 */
function isValidSpecValue(label: string, value: string): boolean {
    const v = value.trim()
    if (!v) return false

    // 过滤价格数据
    if (/^[¥￥$]?\s*[\d,.]+$/.test(v)) return false
    if (v === '¥' || v === '￥') return false

    // 过滤纯数字（可能是价格）
    if (/^\d+\.\d{2}$/.test(v)) return false

    // 过滤导航类文本
    const badPatterns = ['用户评价', '成交记录', '服务承诺', '查看更多', '详情']
    if (badPatterns.some(p => v.includes(p))) return false

    // Label不能是价格相关
    const badLabels = ['销售价', '市场价', '电商平台价', '优惠', '折扣']
    if (badLabels.some(l => label.includes(l))) return false

    return true
}

async function clickSpecTabAndWait(): Promise<Element | null> {
    const tabSelectors = [
        '#tab-specification',
        '[id*="specification"]',
        '[role="tab"]',
        '.po-tabs__item',
        '.el-tabs__item'
    ]

    let clickedTab: Element | null = null

    for (const selector of tabSelectors) {
        const tabs = document.querySelectorAll(selector)
        for (const tab of tabs) {
            const text = tab.textContent?.trim() || ''
            if (text.includes('规格') || text.includes('参数')) {
                console.log('[ZCY Pro V2] 找到规格参数Tab:', text)
                    ; (tab as HTMLElement).click()
                clickedTab = tab
                break
            }
        }
        if (clickedTab) break
    }

    if (!clickedTab) {
        console.log('[ZCY Pro V2] 未找到规格参数Tab')
        return null
    }

    await sleep(800)
    return waitForSpecContainer()
}

async function waitForSpecContainer(): Promise<Element | null> {
    const containerSelectors = [
        '#pane-specification',
        '[id*="specification"]',
        '.spec-table',
        '.detail-attr',
        '.param-list',
        '.goods-params',
        '.product-params',
        'table'
    ]

    return new Promise((resolve) => {
        const tryFind = (): Element | null => {
            for (const sel of containerSelectors) {
                const containers = document.querySelectorAll(sel)
                for (const container of containers) {
                    const hasTable = container.querySelector('table')
                    const hasRows = container.querySelectorAll('tr, li, dl').length > 2
                    const text = container.textContent || ''
                    const hasLabelValue = text.includes('品牌') || text.includes('型号')

                    if (hasTable || hasRows || hasLabelValue) {
                        console.log('[ZCY Pro V2] 规格参数容器已加载')
                        return container
                    }
                }
            }
            return null
        }

        const found = tryFind()
        if (found) {
            resolve(found)
            return
        }

        const observer = new MutationObserver(() => {
            const container = tryFind()
            if (container) {
                observer.disconnect()
                resolve(container)
            }
        })

        observer.observe(document.body, { childList: true, subtree: true })

        setTimeout(() => {
            observer.disconnect()
            resolve(tryFind() || document.body)
        }, 3000)
    })
}

function extractParamRows(container: Element): ParamRow[] {
    const rows: ParamRow[] = []
    const seen = new Set<string>()

    // 方式1: 表格
    container.querySelectorAll('tr').forEach(tr => {
        const cells = tr.querySelectorAll('td, th')
        if (cells.length >= 2) {
            const label = cleanLabel(cells[0].textContent || '')
            const value = (cells[1].textContent || '').trim()
            if (label && value && label.length <= 15 && label.length >= 2 && !seen.has(label)) {
                if (isValidSpecValue(label, value)) {
                    seen.add(label)
                    rows.push({ label, value: cleanValue(label, value) })
                }
            }
        }
    })

    // 方式2: dl/dt/dd
    container.querySelectorAll('dt').forEach(dt => {
        const dd = dt.nextElementSibling
        if (dd && dd.tagName === 'DD') {
            const label = cleanLabel(dt.textContent || '')
            const value = (dd.textContent || '').trim()
            if (label && value && label.length <= 15 && label.length >= 2 && !seen.has(label)) {
                if (isValidSpecValue(label, value)) {
                    seen.add(label)
                    rows.push({ label, value: cleanValue(label, value) })
                }
            }
        }
    })

    // 方式3: li with spans
    container.querySelectorAll('li').forEach(li => {
        const spans = li.querySelectorAll('span')
        if (spans.length >= 2) {
            const label = cleanLabel(spans[0].textContent || '')
            const value = (spans[1].textContent || '').trim()
            if (label && value && label.length <= 15 && label.length >= 2 && !seen.has(label)) {
                if (isValidSpecValue(label, value)) {
                    seen.add(label)
                    rows.push({ label, value: cleanValue(label, value) })
                }
            }
        }
    })

    // 方式4: 文本模式
    const textContent = container.textContent || ''
    const lines = textContent.split(/[\n\r]+/)
    for (const line of lines) {
        const trimmed = line.trim()
        const match = trimmed.match(/^([^：:\s]{2,15})[：:](.+)$/)
        if (match) {
            const label = cleanLabel(match[1])
            const value = match[2].trim()
            if (label.length >= 2 && label.length <= 15 && value.length < 100 && !seen.has(label)) {
                if (isValidSpecValue(label, value)) {
                    seen.add(label)
                    rows.push({ label, value: cleanValue(label, value) })
                }
            }
        }
    }

    console.log(`[ZCY Pro V2] 规格参数行数: 原始=${rows.length}`)
    return rows
}

function matchLabel(label: string, labelList: string[]): boolean {
    const l = cleanLabel(label)
    return labelList.some(target => l === target || l.includes(target) || target.includes(l))
}

function mapParamsToFields(rows: ParamRow[]): {
    model: string
    brand: string
    specs: Record<string, string>
} {
    let model = ''
    let brand = ''
    const specs: Record<string, string> = {}

    for (const row of rows) {
        const { label, value } = row

        if (!model && matchLabel(label, MODEL_LABELS)) {
            model = value
            specs['型号'] = value
            console.log('[ZCY Pro V2] 型号解析: 来源=参数 ->', value)
        }
        else if (!brand && matchLabel(label, BRAND_LABELS)) {
            if (isValidBrand(value)) {
                brand = value
                specs['品牌'] = value
                console.log('[ZCY Pro V2] 品牌解析: 来源=参数 ->', value)
            }
        }
        else if (matchLabel(label, COLOR_LABELS)) {
            specs['颜色'] = cleanValue(label, value)
        }
        else if (matchLabel(label, SIZE_LABELS)) {
            specs['尺寸'] = cleanValue(label, value)
        }
        else if (matchLabel(label, WEIGHT_LABELS)) {
            specs['重量'] = value
        }
        else if (matchLabel(label, POWER_LABELS) && value !== '(w)' && value !== '(W)') {
            specs['功率'] = value
        }
        else if (matchLabel(label, VOLT_LABELS) && value !== '(V)' && value !== '(v)') {
            specs['电压'] = value
        }
        else if (matchLabel(label, CAP_LABELS) && value !== '(kg)' && value !== '(L)') {
            specs['容量'] = value
        }
        else if (matchLabel(label, UNIT_LABELS)) {
            specs['计量单位'] = value
        }
        else if (label && value && value.length < 50) {
            // 其他参数直接保留
            specs[label] = value
        }
    }

    console.log(`[ZCY Pro V2] 规格参数有效: ${Object.keys(specs).length} 项`)
    return { model, brand, specs }
}

// ========== 5. 标题提取（改进版）==========

function extractTitle(): string {
    // 1. 优先：特定的商品名称选择器
    const titleSelectors = [
        '.sku-name',
        '.item-name',
        '.goods-name',
        '.product-name',
        '[class*="sku-name"]',
        '[class*="item-name"]',
        '[class*="goods-title"]',
        '[class*="product-title"]',
        '.item-info h1',
        '.goods-info h1',
        '[class*="title-text"]',
        '[class*="goods-name"]'
    ]

    for (const sel of titleSelectors) {
        try {
            const el = document.querySelector(sel)
            const text = el?.textContent?.trim()
            if (text && text.length > 8 && text.length < 200) {
                if (!text.includes('服务') && !text.includes('安装调试') &&
                    !text.includes('政采云') && !text.includes('电子卖场') &&
                    !text.includes('下载采云学院') && !text.includes('采云学院')) {
                    console.log('[ZCY Pro V2] 标题(选择器):', text.substring(0, 50))
                    return text
                }
            }
        } catch { }
    }

    // 2. 评分法找标题
    const allText = document.body.innerText || ''
    const lines = allText.split('\n').map(l => l.trim()).filter(l => l.length > 15 && l.length < 200)

    const scoreTitle = (text: string): number => {
        let score = 0
        // 包含常见商品词汇
        const productKeywords = ['机', '器', '仪', '柜', '箱', '台', '架', '板', '桌', '椅', '灯', '扇', '烫', '熨']
        if (productKeywords.some(k => text.includes(k))) score += 3
        // 包含品牌标识（中文-英文或中文/英文格式）
        if (/[\u4e00-\u9fa5]+[-\/][\u4e00-\u9fa5a-zA-Z]+/.test(text)) score += 2
        // 长度适中
        if (text.length >= 20 && text.length <= 100) score += 2
        // 扣分
        if (text.includes('服务') || text.includes('安装调试')) score -= 10
        if (text.includes('政采云') || text.includes('电子卖场')) score -= 10
        if (text.includes('价格') || text.includes('库存')) score -= 5
        if (text.includes('销售') || text.includes('买家')) score -= 5
        if (/^¥|^￥|^\d+\.\d{2}/.test(text)) score -= 10
        return score
    }

    let bestTitle = ''
    let bestScore = -100

    for (const line of lines) {
        const score = scoreTitle(line)
        if (score > bestScore) {
            bestScore = score
            bestTitle = line
        }
    }

    if (bestTitle && bestScore >= 3) {
        console.log('[ZCY Pro V2] 标题(评分):', bestTitle.substring(0, 50), '分数:', bestScore)
        return bestTitle
    }

    // 3. h1
    const h1 = document.querySelector('h1')
    if (h1?.textContent?.trim()) {
        const text = h1.textContent.trim()
        if (text.length > 5 && text.length < 150 &&
            !text.includes('政采云') && !text.includes('电子卖场') &&
            !text.includes('下载采云学院') && !text.includes('采云学院')) {
            console.log('[ZCY Pro V2] 标题(h1):', text.substring(0, 50))
            return text
        }
    }

    // 4. 页面title
    let pageTitle = document.title
        .replace(/[-_|–—].*/g, '')
        .replace(/商品详情/g, '')
        .replace(/政采云/g, '')
        .replace(/电子卖场/g, '')
        .replace(/下载采云学院APP/g, '')
        .replace(/采云学院/g, '')
        .trim()

    if (pageTitle && pageTitle.length > 5 && !pageTitle.includes('采云学院')) {
        console.log('[ZCY Pro V2] 标题(页面title):', pageTitle.substring(0, 50))
        return pageTitle
    }

    console.log('[ZCY Pro V2] 标题提取失败')
    return '未知商品'
}

// ========== 6. 标题反推品牌/型号 ==========

function extractModelFromTitle(title: string): string | null {
    // 匹配型号：字母开头或数字开头，包含字母数字横杠
    const matches = title.match(/[A-Za-z][A-Za-z0-9\-]{1,14}|[A-Za-z0-9]{2,}[A-Za-z]+[0-9]+/g)
    if (matches) {
        const sorted = matches.sort((a, b) => b.length - a.length)
        for (const m of sorted) {
            if (m.length >= 2 && m.length <= 15) {
                return m
            }
        }
    }
    return null
}

function guessBrandFromTitle(title: string, model: string | null): string | null {
    // 按空格分词
    const parts = title.split(/[\s\/]+/).filter(p => p.length >= 2)
    if (!parts.length) return null

    if (model) {
        const idx = parts.findIndex(p => p.includes(model) || model.includes(p))
        if (idx > 0) {
            const candidate = parts[idx - 1]
            if (isValidBrand(candidate) && candidate.length <= 15) {
                return candidate
            }
        }
    }

    // 取第一个中文词作为品牌
    for (const part of parts) {
        if (/^[\u4e00-\u9fa5]+$/.test(part) && part.length <= 10) {
            if (isValidBrand(part)) {
                return part
            }
        }
    }

    return null
}

// ========== 7. 其他提取函数 ==========

function extractPrice(): string {
    const priceSelectors = ['.real-price', '.sku-price', '.sale-price', '[class*="price"]']
    for (const sel of priceSelectors) {
        const el = document.querySelector(sel)
        const text = el?.textContent || ''
        const match = text.match(/[\d,]+\.?\d*/)
        if (match) {
            return match[0].replace(/,/g, '')
        }
    }
    return '0'
}

function extractShopName(): string {
    const selectors = ['.shop-name', '.seller-name', '.merchant-name', '[class*="shop"] a']
    for (const sel of selectors) {
        const el = document.querySelector(sel)
        const text = el?.textContent?.trim()
        if (text && text.length < 50 && !text.includes('政采云')) {
            return text
        }
    }
    return ''
}

function extractDetailHtml(): string {
    const removePatterns = ['market-price-tip', 'popover', 'tooltip', 'drainage_dialog']
    const removeTexts = ['供应商自行上传的同款商品', '仅供参考']

    const detailSelectors = ['#pane-introduction', '.item-detail', '.goods-desc', '.detail-content']

    for (const sel of detailSelectors) {
        const el = document.querySelector(sel)
        if (el && el.innerHTML.length > 100) {
            const clone = el.cloneNode(true) as Element

            removePatterns.forEach(pattern => {
                clone.querySelectorAll(`[class*="${pattern}"]`).forEach(n => n.remove())
            })

            return clone.innerHTML
        }
    }

    return ''
}

// ========== 8. 主入口 ==========

async function extractAllData(): Promise<ExtractedData> {
    console.log('[ZCY Pro V2] ========== 开始综合数据提取 ==========')

    // 1. 提取标题（改进版）
    const title = extractTitle()

    // 2. 点击规格参数Tab并等待
    const specContainer = await clickSpecTabAndWait()

    // 3. 提取规格参数
    let paramRows: ParamRow[] = []
    if (specContainer) {
        paramRows = extractParamRows(specContainer)
    }
    let { model, brand, specs } = mapParamsToFields(paramRows)

    // 4. 品牌/型号兜底
    if (!model) {
        const titleModel = extractModelFromTitle(title)
        if (titleModel) {
            model = titleModel
            specs['型号'] = titleModel
            console.log('[ZCY Pro V2] 型号解析: 来源=标题 ->', titleModel)
        }
    }

    if (!brand) {
        const titleBrand = guessBrandFromTitle(title, model)
        if (titleBrand) {
            brand = titleBrand
            specs['品牌'] = titleBrand
            console.log('[ZCY Pro V2] 品牌解析: 来源=标题 ->', titleBrand)
        }
    }

    // 5. 提取链接
    const { ecommerceUrl, zcyUrl } = findEcommerceLink()

    // 6. 提取价格
    const price = extractPrice()

    // 7. 提取主图
    const images = extractImages()

    // 8. 提取详情图
    const detailImages = await extractDetailImages(images)

    // 9. 详情HTML
    const detailHtml = extractDetailHtml()

    // 10. 店铺名
    const shopName = extractShopName()

    const result: ExtractedData = {
        title, price, brand, model, specs, images, detailImages, detailHtml, shopName,
        originalUrl: ecommerceUrl, zcyItemUrl: zcyUrl
    }

    console.log('[ZCY Pro V2] ========== 提取完成 ==========')
    console.log(`  标题: ${title.substring(0, 50)}`)
    console.log(`  品牌: ${brand || '(空)'}`)
    console.log(`  型号: ${model || '(空)'}`)
    console.log(`  主图: ${images.length} 张`)
    console.log(`  详情图: ${detailImages.length} 张`)
    console.log(`  规格参数: ${Object.keys(specs).length} 项`)

    return result
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

// ========== 9. 监听与推送 ==========

interface DataReadyCallback {
    (data: ExtractedData): void
}

export function waitForDataReady(callback: DataReadyCallback, timeout = 10000): void {
    const startTime = Date.now()

    const checkReady = () => {
        const body = document.body
        if (!body) return false
        const text = body.textContent || ''
        return text.length > 1000
    }

    if (checkReady()) {
        setTimeout(() => extractAndCallback(callback), 500)
        return
    }

    const observer = new MutationObserver(() => {
        if (checkReady()) {
            observer.disconnect()
            setTimeout(() => extractAndCallback(callback), 500)
        } else if (Date.now() - startTime > timeout) {
            observer.disconnect()
            extractAndCallback(callback)
        }
    })

    observer.observe(document.body, { childList: true, subtree: true })

    setTimeout(() => {
        observer.disconnect()
        extractAndCallback(callback)
    }, timeout)
}

async function extractAndCallback(callback: DataReadyCallback) {
    const data = await extractAllData()
    callback(data)
}

export async function pushToBackend(data: ExtractedData): Promise<boolean> {
    const BACKEND_URL = process.env.PLASMO_PUBLIC_BACKEND_URL || 'http://localhost:3000'

    console.log('[ZCY Pro V2] ========== 开始推送 ==========')

    try {
        const payload = {
            title: data.title,
            originalUrl: data.originalUrl,
            zcyItemUrl: data.zcyItemUrl,
            shopName: data.shopName,
            brand: data.brand,
            model: data.model,
            price: parseFloat(data.price) || 0,
            stock: 99,
            mainImages: data.images,
            detailImages: data.detailImages,
            specs: data.specs,
            detailHtml: data.detailHtml
        }

        console.log('[ZCY Pro V2] 推送摘要:', {
            title: payload.title?.substring(0, 30),
            brand: payload.brand || '(空)',
            model: payload.model || '(空)',
            mainImages: payload.mainImages.length,
            detailImages: payload.detailImages.length,
            specs: Object.keys(payload.specs).length
        })

        const response = await fetch(`${BACKEND_URL}/api/plugin/collect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product: payload })
        })

        const result = await response.json()
        console.log('[ZCY Pro V2] 后台响应:', result.success ? '成功' : '失败')

        return result.success === true
    } catch (error) {
        console.error('[ZCY Pro V2] 推送失败:', error)
        return false
    }
}

export async function startCollection(): Promise<{ success: boolean; data?: ExtractedData; message?: string }> {
    return new Promise((resolve) => {
        waitForDataReady(async (data) => {
            const pushSuccess = await pushToBackend(data)

            if (pushSuccess) {
                resolve({ success: true, data, message: '采集成功！' })
            } else {
                resolve({ success: false, data, message: '推送后台失败' })
            }
        })
    })
}

// ========== 新增：京东（JD）采集函数 ==========

async function scrapeJD(doc: Document): Promise<Partial<ExtractedData>> {
    const result: Partial<ExtractedData> = {}

    // 标题
    result.title =
        doc.querySelector('.sku-name')?.textContent?.trim() ||
        doc.querySelector('.product-intro .title-text')?.textContent?.trim() ||
        ''

    // 价格（DOM）
    const priceText =
        doc.querySelector('.p-price .price')?.textContent ||
        doc.querySelector('.summary-price-wrap .price')?.textContent ||
        ''
    result.price = priceText.replace(/[^\d.]/g, '') || '0'

    // 主图（高清）
    result.images = [...doc.querySelectorAll('#spec-list img, #spec-n1 img')].map(img =>
        (img as HTMLImageElement).src.replace(/\/n\d+\//, '/n1/')
    ).filter(Boolean)

    // 品牌
    const brandNode = doc.querySelector('.parameter-brand li, #parameter-brand li')
    result.brand = brandNode?.textContent?.replace(/品牌[：:]?/g, '').trim() || ''

    // 规格参数
    result.specs = {}
    doc.querySelectorAll('#detail .parameter2 li, .Ptable-item dl').forEach(li => {
        const txt = li.textContent?.trim() || ''
        const match = txt.match(/^(.+?)[：:](.+)$/)
        if (match) {
            result.specs![match[1].trim()] = match[2].trim()
        }
    })

    result.originalUrl = location.href
    result.zcyItemUrl = location.href
    result.shopName = ''
    result.model = ''
    result.detailImages = []
    result.detailHtml = ''

    console.log('[JD Scraper] 采集结果:', { title: result.title?.substring(0, 30), price: result.price, images: result.images?.length })
    return result
}

// ========== 新增：天猫（Tmall）采集函数 ==========

async function scrapeTmall(doc: Document): Promise<Partial<ExtractedData>> {
    const result: Partial<ExtractedData> = {}

    // 标题
    result.title = doc.querySelector('.tb-detail-hd h1')?.textContent?.trim() || ''

    // 价格
    const priceText =
        doc.querySelector('.tm-price')?.textContent ||
        doc.querySelector('#J_StrPrice .tm-price')?.textContent ||
        ''
    result.price = priceText.replace(/[^\d.]/g, '') || '0'

    // 主图
    result.images = [...doc.querySelectorAll('#J_UlThumb img')].map(img =>
        (img as HTMLImageElement).src.replace(/_60x60q90\.jpg/i, '')
    ).filter(Boolean)

    // 品牌
    result.brand = doc.querySelector('#J_BrandAttr .attr-value')?.textContent?.trim() || ''

    // 规格参数
    result.specs = {}
    doc.querySelectorAll('#J_AttrUL li').forEach(li => {
        const txt = li.textContent?.trim() || ''
        const match = txt.match(/^(.+?)[：:](.+)$/)
        if (match) {
            result.specs![match[1].trim()] = match[2].trim()
        }
    })

    result.originalUrl = location.href
    result.zcyItemUrl = location.href
    result.shopName = ''
    result.model = ''
    result.detailImages = []
    result.detailHtml = ''

    console.log('[Tmall Scraper] 采集结果:', { title: result.title?.substring(0, 30), price: result.price, images: result.images?.length })
    return result
}

// ========== 新增：苏宁（Suning）采集函数 ==========

async function scrapeSuning(doc: Document): Promise<Partial<ExtractedData>> {
    const result: Partial<ExtractedData> = {}

    // 标题
    result.title = doc.querySelector('.proinfo-title')?.textContent?.trim() || ''

    // 价格
    const priceText =
        doc.querySelector('.mainprice')?.textContent ||
        doc.querySelector('#promotionPrice')?.textContent ||
        ''
    result.price = priceText.replace(/[^\d.]/g, '') || '0'

    // 主图
    result.images = [...doc.querySelectorAll('.imgzoom-thumb-main img')].map(img =>
        (img as HTMLImageElement).src.replace(/_60x60\.jpg/i, '')
    ).filter(Boolean)

    // 品牌
    result.brand = doc.querySelector('.proinfo-brand a')?.textContent?.trim() || ''

    // 规格参数
    result.specs = {}
    doc.querySelectorAll('.parameter2 li, .itemparameter li').forEach(li => {
        const txt = li.textContent?.trim() || ''
        const match = txt.match(/^(.+?)[：:](.+)$/)
        if (match) {
            result.specs![match[1].trim()] = match[2].trim()
        }
    })

    result.originalUrl = location.href
    result.zcyItemUrl = location.href
    result.shopName = ''
    result.model = ''
    result.detailImages = []
    result.detailHtml = ''

    console.log('[Suning Scraper] 采集结果:', { title: result.title?.substring(0, 30), price: result.price, images: result.images?.length })
    return result
}

// ========== 新增：平台自动识别 ==========

export function detectPlatform(): 'JD' | 'Tmall' | 'Suning' | 'ZCY' | null {
    const host = location.host
    if (host.includes('jd.com')) return 'JD'
    if (host.includes('tmall.com')) return 'Tmall'
    if (host.includes('suning.com')) return 'Suning'
    if (host.includes('zcygov.cn')) return 'ZCY'
    return null
}

export async function scrapeByPlatform(): Promise<Partial<ExtractedData> | null> {
    const platform = detectPlatform()
    console.log('[Platform Scraper] 检测平台:', platform)

    if (platform === 'JD') return scrapeJD(document)
    if (platform === 'Tmall') return scrapeTmall(document)
    if (platform === 'Suning') return scrapeSuning(document)

    // ZCY 或其他平台，返回 null，使用原有逻辑
    return null
}

export type { ExtractedData }
export { extractAllData, isUsefulImage, isValidBrand, findEcommerceLink, scrapeJD, scrapeTmall, scrapeSuning }
