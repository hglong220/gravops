/**
 * 政采云自动发布RPA - 稳定版
 * 按照 waitForElement + 文字查找 + 分步骤 的方式实现
 * 
 * ⭐ 增强功能：JSON数据驱动
 * - 从后端加载完整类目树
 * - 支持按ID/Code/名称查询类目路径
 * - 不需要硬编码类目，更新JSON即可
 */

import { getStoredLicense } from './license'

// 开发环境用本地，生产环境用vercel
const BACKEND_URL = 'http://localhost:3000'
// const BACKEND_URL = 'https://zhengcaiyun-backend.vercel.app'

// ========== ⭐ 新增：类目树数据驱动 ==========

interface CategoryNode {
    id: number
    categoryCode: string
    name: string
    level: number
    parentId: number | null
    hasChildren: boolean
    children?: CategoryNode[]
}

interface CategoryTree {
    data: CategoryNode[]
    loadedAt: number
}

// 缓存类目树
let categoryTreeCache: CategoryTree | null = null

/**
 * 加载完整类目树（带缓存）
 */
async function loadCategoryTree(): Promise<CategoryNode[]> {
    // 检查缓存（1小时内有效）
    if (categoryTreeCache && Date.now() - categoryTreeCache.loadedAt < 3600000) {
        return categoryTreeCache.data
    }

    try {
        const resp = await fetch(`${BACKEND_URL}/api/政采云完整类目.json`)
        if (!resp.ok) throw new Error('加载类目树失败')

        const json = await resp.json()
        // ⭐ 正确提取 categories 字段
        const data = json.categories || json.data || json

        if (!Array.isArray(data)) {
            throw new Error('类目树格式错误，不是数组')
        }

        categoryTreeCache = { data, loadedAt: Date.now() }
        log(`✓ 类目树已加载: ${countCategories(data)} 个类目`)
        return data
    } catch (e) {
        log(`加载类目树失败: ${e}`)
        return []
    }
}

function countCategories(nodes: CategoryNode[]): number {
    let count = nodes.length
    for (const node of nodes) {
        if (node.children) {
            count += countCategories(node.children)
        }
    }
    return count
}

/**
 * 按ID查找类目并返回完整路径
 */
async function getCategoryPathById(categoryId: number): Promise<string[] | null> {
    const tree = await loadCategoryTree()
    const path: string[] = []

    function findNode(nodes: CategoryNode[], targetId: number): boolean {
        for (const node of nodes) {
            if (node.id === targetId) {
                path.push(node.name)
                return true
            }
            if (node.children && node.children.length > 0) {
                path.push(node.name)
                if (findNode(node.children, targetId)) {
                    return true
                }
                path.pop()
            }
        }
        return false
    }

    if (findNode(tree, categoryId)) {
        return path
    }
    return null
}

/**
 * 按categoryCode查找类目并返回完整路径
 */
async function getCategoryPathByCode(code: string): Promise<string[] | null> {
    const tree = await loadCategoryTree()
    const path: string[] = []

    function findNode(nodes: CategoryNode[], targetCode: string): boolean {
        for (const node of nodes) {
            if (node.categoryCode === targetCode) {
                path.push(node.name)
                return true
            }
            if (node.children && node.children.length > 0) {
                path.push(node.name)
                if (findNode(node.children, targetCode)) {
                    return true
                }
                path.pop()
            }
        }
        return false
    }

    if (findNode(tree, code)) {
        return path
    }
    return null
}

/**
 * 按名称查找类目（模糊匹配）
 */
async function getCategoryPathByName(name: string): Promise<string[] | null> {
    const tree = await loadCategoryTree()
    const path: string[] = []

    function findNode(nodes: CategoryNode[], targetName: string): boolean {
        for (const node of nodes) {
            if (node.name === targetName || node.name.includes(targetName)) {
                path.push(node.name)
                return true
            }
            if (node.children && node.children.length > 0) {
                path.push(node.name)
                if (findNode(node.children, targetName)) {
                    return true
                }
                path.pop()
            }
        }
        return false
    }

    if (findNode(tree, name)) {
        return path
    }
    return null
}

/**
 * 获取所有一级类目（用于权限检查）
 */
async function getFirstLevelCategories(): Promise<string[]> {
    const tree = await loadCategoryTree()
    return tree.map(node => node.name)
}

// ========== ⭐ 真正先进的类目选择：直接调用Vue内部方法 ==========

/**
 * 获取类目选择组件的 Vue 实例
 */
function getCategoryVM(): any {
    // 找到挂载在 doraemon-dialog 上的 Vue 实例
    const dialog = document.querySelector('.doraemon-dialog') as any
    return dialog && dialog.__vue__
}

/**
 * ⭐ 快速选择类目（直接调用内部方法，不点击DOM）
 * 
 * 优势：
 * - 🔥 页面自动展开
 * - 🔥 自动定位
 * - 🔥 自动选中
 * - 🔥 自动触发属性加载
 * - 🔥 无需逐级点击
 * - 🔥 永远不会"类目弹窗未出现"
 * 
 * @param refId - 类目的refId（如 "ref-5018"）
 */
async function selectCategoryFast(refId: string): Promise<boolean> {
    const vm = getCategoryVM()

    if (!vm) {
        log('⚠ 找不到类目 Vue 实例，回退到DOM点击方式')
        return false
    }

    try {
        // 检查是否有 selectCategoryById 方法
        if (typeof vm.selectCategoryById === 'function') {
            vm.selectCategoryById(refId)
            log(`✓ 已通过内部方法选中类目: ${refId}`)
            return true
        }

        // 备选方法名
        const methodNames = ['selectCategory', 'handleSelect', 'onSelect', 'select']
        for (const method of methodNames) {
            if (typeof vm[method] === 'function') {
                vm[method](refId)
                log(`✓ 已通过 ${method} 选中类目: ${refId}`)
                return true
            }
        }

        log('⚠ Vue实例上未找到选择方法')
        return false
    } catch (e) {
        log(`快速选择失败: ${e}`)
        return false
    }
}

/**
 * 按类目ID快速选择（先从JSON获取refId，再调用内部方法）
 */
async function selectCategoryFastById(categoryId: number): Promise<boolean> {
    const tree = await loadCategoryTree()

    // 查找节点获取 categoryCode 作为 refId
    function findNode(nodes: CategoryNode[], targetId: number): CategoryNode | null {
        for (const node of nodes) {
            if (node.id === targetId) return node
            if (node.children) {
                const found = findNode(node.children, targetId)
                if (found) return found
            }
        }
        return null
    }

    const node = findNode(tree, categoryId)
    if (!node) {
        log(`未找到类目ID: ${categoryId}`)
        return false
    }

    // 尝试使用 categoryCode 或 id 作为 refId
    const refId = node.categoryCode || `ref-${node.id}`
    return await selectCategoryFast(refId)
}

// 导出新增的数据驱动函数
export {
    loadCategoryTree,
    getCategoryPathById,
    getCategoryPathByCode,
    getCategoryPathByName,
    getFirstLevelCategories,
    selectCategoryFast,
    selectCategoryFastById
}

// ========== 通用工具函数 ==========

function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms))
}

function log(msg: string) {
    console.log(`[RPA V3] ${msg}`)
}

// 等待元素出现
async function waitForElement<T extends Element>(
    findFn: () => T | null,
    timeout = 10000,
    interval = 300
): Promise<T> {
    const start = Date.now()
    while (Date.now() - start < timeout) {
        try {
            const el = findFn()
            if (el) return el
        } catch (e) { }
        await sleep(interval)
    }
    throw new Error('waitForElement timeout')
}

// 在容器中按文字查找按钮
function findButtonByText(root: Element | Document, text: string): HTMLButtonElement | null {
    const buttons = root.querySelectorAll('button')
    for (const btn of buttons) {
        const t = btn.textContent?.trim() || ''
        if (t === text || t.includes(text)) {
            return btn
        }
    }
    return null
}

// 在容器中按文字查找元素（li, span, div等）
function findElementByText(root: Element | Document, text: string, tagName = 'li'): HTMLElement | null {
    const elements = root.querySelectorAll(tagName)
    for (const el of elements) {
        const t = el.textContent?.trim() || ''
        // 去掉数字后缀如 (123)
        const cleanText = t.replace(/\s*[\(（]\d+[\)）]\s*$/, '').trim()
        if (cleanText === text || cleanText.includes(text)) {
            return el as HTMLElement
        }
    }
    return null
}

// 模拟真实用户点击
function simulateClick(element: HTMLElement) {
    const rect = element.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2

    const eventOptions: MouseEventInit = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
        button: 0,
        buttons: 1
    }

    element.dispatchEvent(new MouseEvent('mouseenter', eventOptions))
    element.dispatchEvent(new MouseEvent('mouseover', eventOptions))
    element.dispatchEvent(new MouseEvent('mousedown', eventOptions))
    element.dispatchEvent(new MouseEvent('mouseup', eventOptions))
    element.dispatchEvent(new MouseEvent('click', eventOptions))
    element.click()
}

// 常见品牌列表
const COMMON_BRANDS = [
    // 打印机/办公设备
    { name: '惠普', alias: ['HP', 'hp', 'Hp', '惠普/HP'] },
    { name: '佳能', alias: ['Canon', 'CANON', 'canon'] },
    { name: '爱普生', alias: ['Epson', 'EPSON', 'epson'] },
    { name: '兄弟', alias: ['Brother', 'BROTHER', 'brother'] },
    { name: '联想', alias: ['Lenovo', 'LENOVO', 'lenovo', 'ThinkPad'] },
    { name: '戴尔', alias: ['Dell', 'DELL', 'dell'] },
    { name: '华为', alias: ['Huawei', 'HUAWEI', 'huawei'] },
    { name: '小米', alias: ['Xiaomi', 'MI', 'mi', '小米'] },
    { name: '得力', alias: ['Deli', 'DELI', 'deli'] },
    { name: '晨光', alias: ['M&G', 'MG', 'mg'] },
    { name: '齐心', alias: ['Comix', 'COMIX', 'comix'] },
    // 电器
    { name: '美的', alias: ['Midea', 'MIDEA', 'midea'] },
    { name: '格力', alias: ['Gree', 'GREE', 'gree'] },
    { name: '海尔', alias: ['Haier', 'HAIER', 'haier'] },
    { name: '奥克斯', alias: ['AUX', 'aux', 'Aux'] },
    { name: '飞利浦', alias: ['Philips', 'PHILIPS', 'philips'] },
    { name: '松下', alias: ['Panasonic', 'PANASONIC', 'panasonic'] },
    { name: '苹果', alias: ['Apple', 'APPLE', 'apple', 'iPhone', 'iPad', 'Mac'] },
    { name: '三星', alias: ['Samsung', 'SAMSUNG', 'samsung'] },
]

// 从商品标题中提取品牌
function extractBrandFromTitle(title: string): string {
    // 先尝试匹配常见品牌
    for (const brand of COMMON_BRANDS) {
        // 检查品牌名
        if (title.includes(brand.name)) {
            return brand.name
        }
        // 检查别名
        for (const alias of brand.alias) {
            if (title.includes(alias)) {
                return brand.name
            }
        }
    }

    // 尝试从标题开头提取（很多标题以品牌开头）
    // 匹配模式：中文品牌 或 英文品牌
    const patterns = [
        /^([A-Z]{2,}[a-z]*)/,  // 如 HP, Dell, Lenovo
        /^([\u4e00-\u9fa5]{2,4})/,  // 如 惠普, 联想
        /([A-Z][a-z]+)/,  // 如 Apple, Canon
    ]

    for (const pattern of patterns) {
        const match = title.match(pattern)
        if (match && match[1]) {
            // 验证是否是有意义的品牌（长度合理）
            if (match[1].length >= 2 && match[1].length <= 10) {
                return match[1]
            }
        }
    }

    return ''
}

// 从商品标题中提取型号
function extractModelFromTitle(title: string): string {
    // 常见型号模式
    const patterns = [
        /型号[：:]\s*([A-Za-z0-9\-]+)/,  // 型号：ABC123
        /([A-Z]{1,3}[-]?\d{2,5}[A-Za-z]?)/,  // 如 HP-117w, M1136
        /(\d{3,5}[A-Za-z]{1,3})/,  // 如 117w, 1136mfp
        /([A-Za-z]{2,}\d{3,})/,  // 如 LaserJet1020
    ]

    for (const pattern of patterns) {
        const match = title.match(pattern)
        if (match && match[1]) {
            return match[1]
        }
    }

    return ''
}

// ========== 步骤1: 点击"修改"按钮，打开电子卖场弹窗 ==========

async function step1_openMarketDialog(): Promise<Element> {
    log('========== 步骤1: 点击修改按钮 ==========')

    // 找"修改"按钮
    const modifyBtn = await waitForElement(
        () => findButtonByText(document, '修改'),
        8000
    )
    log('✓ 找到修改按钮')
    simulateClick(modifyBtn)

    // 等待弹窗出现（使用更宽松的条件）
    await sleep(1000) // 先等待1秒让弹窗渲染

    const dialog = await waitForElement(() => {
        // 方法1: 查找el-dialog
        const elDialogs = document.querySelectorAll('.el-dialog, .el-dialog__wrapper')
        for (const d of elDialogs) {
            const style = window.getComputedStyle(d)
            // 检查是否可见（不是display:none）
            if (style.display !== 'none' && style.visibility !== 'hidden') {
                // 检查是否包含电子卖场相关文字
                const text = d.textContent || ''
                if (text.includes('电子卖场') || text.includes('网上超市') || text.includes('标项')) {
                    return d
                }
            }
        }

        // 方法2: 查找任何可见的模态弹窗
        const modals = document.querySelectorAll('[class*="dialog"], [class*="modal"], [role="dialog"]')
        for (const m of modals) {
            const rect = (m as HTMLElement).getBoundingClientRect()
            if (rect.width > 300 && rect.height > 200) {
                const text = m.textContent || ''
                if (text.includes('电子卖场') || text.includes('网上超市')) {
                    return m
                }
            }
        }

        return null
    }, 8000)

    log('✓ 弹窗已打开')
    return dialog
}

// ========== 步骤2: 在弹窗中选择电子卖场和标项 ==========

async function step2_selectMarketAndBid(dialog: Element, targetBidName: string): Promise<boolean> {
    log('========== 步骤2: 选择电子卖场标项 ==========')
    log(`目标标项: ${targetBidName}`)

    await sleep(500) // 等待弹窗内容加载

    // ===== 第一步: 找到"网上超市(青海网超)"行并点击展开 =====
    log('查找网上超市行...')

    // 在表格中找包含"网上超市"的行
    const allRows = dialog.querySelectorAll('tr')
    let marketRow: HTMLTableRowElement | null = null

    for (const tr of allRows) {
        const rowText = tr.textContent || ''
        if (rowText.includes('网上超市')) {
            marketRow = tr as HTMLTableRowElement
            log(`✓ 找到网上超市行: ${rowText.substring(0, 50)}...`)
            break
        }
    }

    if (!marketRow) {
        log('✗ 未找到网上超市行')
        return false
    }

    // 点击展开按钮（尝试多种选择器）
    const expandSelectors = [
        '.el-table__expand-icon',      // ElementUI 展开图标
        '.el-icon-arrow-right',        // 右箭头
        '.el-icon-plus',               // 加号
        '[class*="expand"]',           // 任何包含expand的元素
        'button',                      // 按钮
        'i',                           // 图标
        'svg',                         // SVG图标
        'span:first-child',            // 第一个span（可能是+号）
        'td:first-child'               // 第一列（整个单元格）
    ]

    let expanded = false
    for (const selector of expandSelectors) {
        const expandBtn = marketRow.querySelector(selector) as HTMLElement
        if (expandBtn) {
            const btnText = expandBtn.textContent?.trim() || ''
            const btnClass = expandBtn.className || ''
            log(`  尝试点击展开: ${selector} (text="${btnText}", class="${btnClass.substring(0, 30)}")`)

            simulateClick(expandBtn)
            await sleep(300)

            // 检查是否展开成功（看是否有新行出现）
            const rowsAfter = dialog.querySelectorAll('tr')
            if (rowsAfter.length > allRows.length) {
                log(`  ✓ 展开成功，行数: ${allRows.length} → ${rowsAfter.length}`)
                expanded = true
                break
            }
        }
    }

    if (!expanded) {
        // 如果仍未展开，尝试点击整行
        log('  展开按钮未生效，尝试点击整行...')
        simulateClick(marketRow)
        await sleep(500)
    }

    await sleep(800) // 等待展开动画和内容加载

    // ===== 第二步: 在展开的标项列表中找到目标标项并选中 =====
    log('查找标项行...')

    const expandedRows = dialog.querySelectorAll('tr')
    log(`  弹窗中共有 ${expandedRows.length} 行`)

    let foundBid = false
    let bidRow: HTMLElement | null = null

    for (const tr of expandedRows) {
        const rowText = tr.textContent || ''

        // 跳过网上超市主行
        if (rowText.includes('网上超市') && rowText.includes('青海')) continue

        // 检查是否是标项行（包含"标项名称"）
        if (rowText.includes('标项名称')) {
            log(`  发现标项行: ${rowText.substring(0, 60)}...`)

            // 灵活匹配：检查行文本是否包含目标标项名
            // 例如 targetBidName="办公设备"，行文本="标项名称: 办公设备"
            if (rowText.includes(targetBidName)) {
                log(`  ✓ 匹配到目标标项: ${targetBidName}`)
                bidRow = tr as HTMLElement
                break
            }
        }
    }

    if (!bidRow) {
        log(`✗ 未找到标项: ${targetBidName}`)
        log('  可能原因: 展开失败、标项名称不匹配、或当前用户没有该标项权限')
        log('  请手动选择正确的标项后重试')
        return false  // 不点确定，让用户手动处理
    }

    // 找到该行的单选按钮并点击
    const radioSelectors = [
        'input[type="radio"]',
        '.el-radio',
        '.el-radio__input',
        '.el-radio__inner',
        'label',
        'span.el-radio__label'
    ]

    let clicked = false
    for (const selector of radioSelectors) {
        const radio = bidRow.querySelector(selector) as HTMLElement
        if (radio) {
            log(`  点击单选按钮: ${selector}`)
            simulateClick(radio)
            if (radio instanceof HTMLInputElement) {
                radio.checked = true
            }
            clicked = true
            break
        }
    }

    // 如果没找到单选按钮，尝试点击整行
    if (!clicked) {
        log('  未找到单选按钮，点击整行')
        simulateClick(bidRow)
    }

    await sleep(300)
    foundBid = true
    log(`✓ 已选中标项: ${targetBidName}`)

    // ===== 第三步: 点击弹窗的"确定"按钮 =====
    await sleep(300)

    const okBtn = findButtonByText(dialog, '确定')
    if (okBtn) {
        log('✓ 点击确定按钮')
        simulateClick(okBtn)
        await sleep(1000)
        return true
    } else {
        log('✗ 未找到确定按钮')
        return false
    }
}

// ========== 步骤3: 选择类目树 ==========

async function step3_selectCategoryTree(categoryPath: string[]): Promise<boolean> {
    log('========== 步骤3: 选择类目树 ==========')
    log(`路径: ${categoryPath.join(' > ')}`)

    await sleep(1500) // 等待类目树加载

    // 查找所有可见的类目项元素（支持多种选择器）
    function getAllVisibleCategoryItems(): HTMLElement[] {
        const items: HTMLElement[] = []
        // 扩展选择器，兼容政采云各种UI组件
        const candidates = document.querySelectorAll(
            'li, .el-cascader-node, .category-item, [role="treeitem"], ' +
            '.tree-node, .menu-item, [class*="category"] span, ' +
            '.el-menu-item, .el-tree-node__content'
        )

        for (const el of candidates) {
            const rect = (el as HTMLElement).getBoundingClientRect()
            // 只处理可见元素
            if (rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0) {
                items.push(el as HTMLElement)
            }
        }

        return items
    }

    // 按名称查找类目（支持多种匹配方式）
    function findCategoryByName(categoryName: string): HTMLElement | null {
        const items = getAllVisibleCategoryItems()
        log(`  当前可见类目项: ${items.length} 个`)

        // 打印所有可见项便于调试
        const visibleTexts = items.slice(0, 10).map(item => {
            const t = item.textContent?.trim() || ''
            return t.substring(0, 30)
        })
        log(`  前10个可见项: ${visibleTexts.join(', ')}`)

        // 第一轮：精确匹配
        for (const item of items) {
            const text = item.textContent?.trim() || ''
            // 清理文本：去除数字后缀如 (123)、去除"标"后缀
            const cleanText = text.replace(/\s*[\(（]\d+[\)）]\s*$/, '').replace(/标$/, '').trim()

            if (cleanText === categoryName) {
                log(`  ✓ 精确匹配: ${cleanText}`)
                return item
            }
        }

        // 第二轮：包含匹配（"办公用纸" 包含在 "办公设备/耗材/办公用纸" 中）
        for (const item of items) {
            const text = item.textContent?.trim() || ''
            const cleanText = text.replace(/\s*[\(（]\d+[\)）]\s*$/, '').replace(/标$/, '').trim()

            if (cleanText.includes(categoryName) || categoryName.includes(cleanText)) {
                log(`  ✓ 包含匹配: ${cleanText} ~ ${categoryName}`)
                return item
            }
        }

        // 第三轮：开头匹配（"办公" 匹配 "办公设备/耗材"）
        const shortName = categoryName.substring(0, 2) // 取前两个字
        for (const item of items) {
            const text = item.textContent?.trim() || ''
            const cleanText = text.replace(/\s*[\(（]\d+[\)）]\s*$/, '').replace(/标$/, '').trim()

            if (cleanText.startsWith(shortName)) {
                log(`  ✓ 开头匹配: ${cleanText} startsWith ${shortName}`)
                return item
            }
        }

        log(`  ✗ 未找到匹配项: ${categoryName}`)
        return null
    }

    // 滚动搜索（处理虚拟滚动列表）
    async function scrollAndSearch(categoryName: string): Promise<HTMLElement | null> {
        const scrollContainers = document.querySelectorAll(
            '.el-scrollbar__wrap, .category-list, [style*="overflow"], .el-tree, .el-menu'
        )

        for (const container of scrollContainers) {
            const scrollEl = container as HTMLElement
            if (scrollEl.scrollHeight <= scrollEl.clientHeight + 10) continue // 不需要滚动

            const scrollStep = scrollEl.clientHeight * 0.7
            const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight
            let currentScroll = 0

            // 先滚到顶部
            scrollEl.scrollTop = 0
            await sleep(200)

            // 分段滚动查找
            while (currentScroll < maxScroll) {
                const item = findCategoryByName(categoryName)
                if (item) return item

                currentScroll += scrollStep
                scrollEl.scrollTop = currentScroll
                await sleep(300)
            }

            // 最后检查一次
            const item = findCategoryByName(categoryName)
            if (item) return item
        }

        return null
    }

    // ★★★ 支持最多5级类目 ★★★
    for (let i = 0; i < categoryPath.length && i < 5; i++) {
        const categoryName = categoryPath[i]
        const level = i + 1

        log(`选择第${level}级类目: ${categoryName}`)

        // 等待并查找类目项
        let found = false
        let retries = 0

        while (!found && retries < 5) {
            retries++

            // 1. 直接查找
            let item = findCategoryByName(categoryName)

            // 2. 如果没找到，尝试滚动搜索
            if (!item && retries >= 2) {
                log(`  尝试滚动搜索...`)
                item = await scrollAndSearch(categoryName)
            }

            if (item) {
                log(`  找到: ${item.textContent?.trim()?.substring(0, 30)}`)
                simulateClick(item)

                // 同时点击内部的span（有些框架需要）
                const span = item.querySelector('span')
                if (span) {
                    simulateClick(span as HTMLElement)
                }

                found = true
                log(`  ✓ 点击第${level}级: ${categoryName}`)
            }

            if (!found) {
                log(`  等待重试... (${retries}/5)`)
                await sleep(800)
            }
        }

        // ★★★ 严格执行：找不到立即终止，返回 false ★★★
        if (!found) {
            log(`  ✗ 未找到第${level}级类目: ${categoryName}`)
            log('  ✗ 类目选择失败，流程终止')
            return false  // 立即返回失败，不继续
        }

        // 等待下一级类目加载
        await sleep(1000)
    }

    // 只有全部成功才返回 true
    return true
}

// ========== 步骤4: 填写关键属性（品牌/型号） ==========

// 通用：根据"附近文字"找到对应控件
// 遍历所有匹配选择器的元素，向上爬几层parent，看容器里是否有labelText
function findFieldByLabelText(labelText: string, fieldSelector: string, maxDepth: number = 15): Element | null {
    const fields = document.querySelectorAll(fieldSelector)

    for (const field of fields) {
        let p: Element | null = field
        for (let i = 0; i < maxDepth && p; i++) {
            const txt = (p.textContent || '').replace(/\s+/g, '')
            if (txt.includes(labelText)) {
                return field
            }
            p = p.parentElement
        }
    }

    return null
}

// 选择品牌（下拉框）- 针对政采云doraemon-select组件
async function selectBrand(brandText: string): Promise<void> {
    if (!brandText) return

    log('  查找品牌下拉框...')

    // 政采云使用doraemon-select组件，不是ElementUI的el-select
    let brandControl: Element | null = null
    try {
        brandControl = await waitForElement(() => {
            // 优先找doraemon-select
            let el = findFieldByLabelText('品牌', '.doraemon-select-selection', 15)
            if (el) return el

            el = findFieldByLabelText('品牌', '[class*="doraemon-select"]', 15)
            if (el) return el

            // 兜底：找el-select（旧版可能用这个）
            el = findFieldByLabelText('品牌', '.el-select', 15)
            if (el) return el

            el = findFieldByLabelText('品牌', 'input', 15)
            return el || null
        }, 10000)
    } catch (e) {
        log('  ⚠ 未找到品牌下拉框')
        return
    }

    log(`  找到品牌下拉框: ${brandControl.className?.substring(0, 50)}`)

        // 确保元素可见并滚动到视图中
        ; (brandControl as HTMLElement).scrollIntoView({ behavior: 'instant', block: 'center' })
    await sleep(300)

    // 多种方式尝试打开下拉
    async function tryOpenBrandDropdown(target: Element): Promise<void> {
        const el = target as HTMLElement
        const rect = el.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2

        // 验证点击位置
        const elementAtPoint = document.elementFromPoint(centerX, centerY)
        log(`  点击坐标: (${centerX.toFixed(0)}, ${centerY.toFixed(0)})`)
        log(`  该坐标处的元素: ${elementAtPoint?.tagName} ${elementAtPoint?.className?.substring(0, 30)}`)

        // 方法1: 使用simulateClick
        simulateClick(el)

        // 方法2: 发送完整的鼠标事件序列
        el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true }))
        el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }))
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: centerX, clientY: centerY }))
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: centerX, clientY: centerY }))
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: centerX, clientY: centerY }))

        // 方法3: focus + 键盘事件
        el.focus?.()
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }))
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', keyCode: 40, bubbles: true }))
        el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', keyCode: 32, bubbles: true }))

        // 方法4: 如果有input子元素，也点击它
        const inputChild = el.querySelector('input')
        if (inputChild) {
            log(`  尝试点击内部input...`)
            inputChild.focus()
            inputChild.click()
            inputChild.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
            inputChild.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
        }
    }

    await tryOpenBrandDropdown(brandControl)
    await sleep(1000)

    // 调试：打印当前页面所有可见dropdown
    const allDropdowns = document.querySelectorAll('[class*="dropdown"], [class*="menu"], [class*="popup"], [class*="popper"]')
    log(`  页面上找到 ${allDropdowns.length} 个dropdown类元素`)
    let visibleCount = 0
    allDropdowns.forEach((d, i) => {
        const rect = d.getBoundingClientRect()
        if (rect.width > 50 && rect.height > 50) {
            visibleCount++
            if (visibleCount <= 3) {
                log(`    [${i}] ${d.className?.substring(0, 40)} - ${rect.width.toFixed(0)}x${rect.height.toFixed(0)}`)
            }
        }
    })
    log(`  其中可见的有 ${visibleCount} 个`)

    // 查找doraemon下拉面板
    let dropdown: Element | null = null
    try {
        dropdown = await waitForElement(() => {
            // doraemon组件的下拉面板
            const doraemonDropdowns = document.querySelectorAll('[class*="doraemon-select-dropdown"], [class*="doraemon-dropdown"], [class*="rc-select-dropdown"]')
            for (const d of doraemonDropdowns) {
                const rect = d.getBoundingClientRect()
                if (rect.width > 0 && rect.height > 0) {
                    return d
                }
            }

            // 兜底：el-select下拉面板
            const elDropdowns = document.querySelectorAll('.el-select-dropdown')
            for (const d of elDropdowns) {
                const rect = d.getBoundingClientRect()
                if (rect.width > 0 && rect.height > 0) {
                    return d
                }
            }

            // 再兜底：查找任何可见的下拉菜单（包含option/item）
            const anyDropdowns = document.querySelectorAll('[class*="dropdown"]:not([style*="display: none"])')
            for (const d of anyDropdowns) {
                const rect = d.getBoundingClientRect()
                if (rect.width > 100 && rect.height > 50 && d.querySelectorAll('li, [class*="option"], [class*="item"]').length > 0) {
                    return d
                }
            }

            return null
        }, 2000)
    } catch (e) {
        dropdown = null
    }

    if (!dropdown) {
        // 再试一次：点击selection内部
        log('  第一次未找到下拉，再次尝试...')
        const innerDiv = brandControl.querySelector('div, span')
        if (innerDiv) {
            simulateClick(innerDiv as HTMLElement)
            await sleep(500)
        }

        try {
            dropdown = await waitForElement(() => {
                const dropdowns = document.querySelectorAll('[class*="dropdown"]:not([style*="display: none"])')
                for (const d of dropdowns) {
                    const rect = d.getBoundingClientRect()
                    if (rect.width > 100 && rect.height > 50) {
                        return d
                    }
                }
                return null
            }, 2000)
        } catch (e) {
            dropdown = null
        }
    }

    if (dropdown) {
        log(`  下拉面板已打开: ${dropdown.className?.substring(0, 50)}`)

        // 查找选项（支持多种选择器）
        const options = dropdown.querySelectorAll('li, [class*="option"], [class*="item"], [class*="menu-item"]')
        log(`  找到 ${options.length} 个品牌选项`)

        const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()
        const candidates = brandText.split(/[\/\s]/).filter(Boolean).map(norm)

        let target: Element | null = null

        // 匹配品牌
        for (const opt of options) {
            const txt = norm(opt.textContent || '')
            if (candidates.some(c => txt.includes(c))) {
                target = opt
                log(`  匹配到选项: ${opt.textContent?.trim()}`)
                break
            }
        }

        if (!target) {
            for (const opt of options) {
                if (opt.textContent?.trim().includes(brandText)) {
                    target = opt
                    break
                }
            }
        }

        if (target) {
            simulateClick(target as HTMLElement)
            await sleep(300)
            document.body.click()
            log(`  ✓ 已选择品牌：${(target.textContent || '').trim()}`)
            return
        }

        // 如果没找到匹配的，尝试输入筛选
        const searchInput = dropdown.querySelector('input') as HTMLInputElement
        if (searchInput) {
            searchInput.focus()
            searchInput.value = brandText
            searchInput.dispatchEvent(new Event('input', { bubbles: true }))
            await sleep(300)
            searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }))
            log(`  ✓ 通过输入筛选选择品牌：${brandText}`)
            return
        }

        log(`  ⚠ 在选项中未找到匹配的品牌: ${brandText}`)
    }

    // 提示用户手动处理
    log(`  ❌ 无法打开品牌下拉面板，请手动选择品牌: ${brandText}`)
}

// 填写型号 - 针对政采云 doraemon-select 组件
async function fillModel(modelText: string): Promise<void> {
    if (!modelText) return

    log('  查找型号下拉框...')

    // 政采云型号也是 doraemon-select 组件，需要正确操作
    let modelBox: Element | null = null
    try {
        modelBox = await waitForElement(() => {
            // 优先找 doraemon-select
            let el = findFieldByLabelText('型号', '.doraemon-select-selection', 15)
            if (el) return el

            el = findFieldByLabelText('型号', '[class*="doraemon-select"]', 15)
            if (el) return el

            // 兜底：直接找 input
            el = findFieldByLabelText('型号', 'input', 15)
            return el || null
        }, 10000)
    } catch (e) {
        log('  ⚠ 未找到型号控件')
        return
    }

    if (!modelBox) {
        log('  ⚠ 未找到型号控件')
        return
    }

    log(`  找到型号控件: ${modelBox.className?.substring(0, 50)}`)

        // 滚动到可见位置
        ; (modelBox as HTMLElement).scrollIntoView({ behavior: 'instant', block: 'center' })
    await sleep(300)

    // 点击打开下拉（激活组件）
    simulateClick(modelBox as HTMLElement)
    await sleep(300)

    // 查找内部的搜索输入框
    let input: HTMLInputElement | null = modelBox.querySelector('input#specification, input.doraemon-select-search__field, input') as HTMLInputElement

    // 如果 modelBox 本身就是 input
    if (!input && modelBox.tagName === 'INPUT') {
        input = modelBox as HTMLInputElement
    }

    if (!input) {
        log('  ⚠ 未找到型号输入框')
        return
    }

    log('  找到型号输入框，开始输入...')

    // 聚焦并输入
    input.focus()
    input.value = modelText

    // 触发 input 事件，让组件刷新候选列表
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await sleep(400)

    // 模拟 Enter 键，让组件选中第一条候选或确认输入
    input.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
    }))
    input.dispatchEvent(new KeyboardEvent('keyup', {
        key: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true
    }))

    await sleep(300)

    // 点击其他地方关闭下拉（如果还开着）
    document.body.click()

    log(`  ✓ 型号已输入并选择: ${modelText}`)
}

// 步骤4主函数
async function step4_fillAttributes(brand: string, model: string): Promise<boolean> {
    log('========== 步骤4: 填写属性 ==========')
    log(`品牌: ${brand || '无'}, 型号: ${model || '无'}`)

    await selectBrand(brand)
    await fillModel(model)

    return true
}

// ========== 步骤5: 点击下一步 ==========

async function step5_clickNext(): Promise<boolean> {
    log('========== 步骤5: 点击下一步 ==========')

    await sleep(500)

    // 按文字查找"下一步"按钮
    try {
        const nextBtn = await waitForElement(
            () => findButtonByText(document, '下一步'),
            8000
        )

        // 滚动到可见位置
        nextBtn.scrollIntoView({ block: 'center' })
        await sleep(200)

        simulateClick(nextBtn)
        log('✓ 点击下一步')
        return true
    } catch (e) {
        log('⚠ 未找到下一步按钮')
        return false
    }
}

// ========== 类目匹配API调用 ==========

interface CategoryMatchResult {
    primary: {
        id: string
        name: string
        path: string[]
        fullName: string
        rootName: string
    }
    backup: null
    matchMethod: string
    confidence: number
}

async function matchCategoryFromBackend(
    productTitle: string,
    brand?: string,
    model?: string,
    allowedRoots?: string[]
): Promise<CategoryMatchResult | null> {
    log(`调用类目匹配API: ${productTitle}`)

    try {
        let licenseKey = ''
        try {
            const stored = await getStoredLicense()
            licenseKey = stored?.licenseKey || ''
            log(`licenseKey: ${licenseKey ? licenseKey.substring(0, 10) + '...' : '未获取到'}`)
        } catch (e) {
            log(`获取licenseKey失败: ${e}`)
        }

        if (!licenseKey) {
            log('⚠ licenseKey为空，请先激活License')
            return null
        }

        const response = await fetch(`${BACKEND_URL}/api/category-match`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                licenseKey,
                productTitle,
                brand,
                model,
                mode: 'full'
            })
        })

        if (!response.ok) {
            log(`API请求失败: ${response.status}`)
            return null
        }

        const data = await response.json()

        if (data.rejected) {
            log(`类目匹配被拒绝: ${data.reason}`)
            return null
        }

        const result = data.data || data

        if (data.success && result.categoryPath) {
            const categoryPath = result.categoryPath as string[]
            const fullName = categoryPath.join(' > ')
            log(`匹配结果: ${fullName}`)

            return {
                primary: {
                    id: String(result.categoryIds?.[result.categoryIds.length - 1] || 0),
                    name: categoryPath[categoryPath.length - 1] || '',
                    path: categoryPath,
                    fullName,
                    rootName: categoryPath[0] || ''
                },
                backup: null,
                matchMethod: result.matchMethod || 'keyword',
                confidence: result.confidence === 'high' ? 0.9 : result.confidence === 'medium' ? 0.7 : 0.5
            }
        }

        log('API返回格式异常')
        return null
    } catch (error) {
        log(`API调用错误: ${error}`)
        return null
    }
}

// ========== 主流程 ==========

export interface AutoPublishOptions {
    title: string
    brand?: string
    model?: string
    allowedRoots: string[]
}

export async function executeAutoPublish(options: AutoPublishOptions): Promise<{
    success: boolean
    error?: string
    categoryUsed?: string
}> {
    log('═══════════════════════════════════════')
    log('开始自动发布流程')
    log(`商品: ${options.title}`)
    log('═══════════════════════════════════════')

    try {
        // 0. 从标题中提取品牌和型号（如果未传入）
        const brand = options.brand || extractBrandFromTitle(options.title)
        const model = options.model || extractModelFromTitle(options.title)
        log(`提取品牌: ${brand || '未识别'}, 型号: ${model || '未识别'}`)

        // 1. 调用后端匹配类目
        const matchResult = await matchCategoryFromBackend(
            options.title,
            brand,
            model,
            options.allowedRoots
        )

        if (!matchResult) {
            return { success: false, error: '类目匹配失败' }
        }

        const { primary } = matchResult
        const pathSegments = primary.path
        const rootName = pathSegments[0]

        log(`AI选择的类目: ${primary.fullName}`)
        log(`一级类目: ${rootName}`)
        log(`完整路径: ${pathSegments.join(' > ')}`)

        // 2. 点击修改按钮，打开电子卖场弹窗
        log('')
        let dialog: Element
        try {
            dialog = await step1_openMarketDialog()
        } catch (e) {
            log('✗ 步骤1失败: 无法打开电子卖场弹窗')
            return { success: false, error: '无法打开电子卖场弹窗' }
        }

        // 3. 选择电子卖场和标项（必须成功才能继续）
        const step2Success = await step2_selectMarketAndBid(dialog, rootName)
        if (!step2Success) {
            log('✗ 步骤2失败: 未能选中正确的标项')
            log(`  请手动选择标项"${rootName}"后重试`)
            return {
                success: false,
                error: `未能选中标项"${rootName}"，请手动选择后重试`
            }
        }

        // 4. 选择类目树（必须成功才能继续）
        // 注意：step3 要选择的是完整路径 [办公设备, 办公用纸, 打印/复印纸]
        // 但是因为步骤2已经选了"办公设备"作为标项，所以类目树的第一级就是"办公设备"的子类目
        // 因此这里需要从第二级开始选择
        const categoryPathForTree = pathSegments.slice(1) // 跳过第一级（标项已选）
        log(`类目树选择路径（跳过一级）: ${categoryPathForTree.join(' > ')}`)

        const step3Success = await step3_selectCategoryTree(categoryPathForTree)
        if (!step3Success) {
            log('✗ 步骤3失败: 类目选择未完成')
            return { success: false, error: '类目选择失败' }
        }

        // 5. 填写属性（使用提取的品牌和型号）
        await step4_fillAttributes(brand, model)

        // 6. 点击下一步
        const step5Success = await step5_clickNext()
        if (!step5Success) {
            log('⚠ 步骤5: 未找到下一步按钮，但流程已基本完成')
        }

        log('')
        log('═══════════════════════════════════════')
        log('自动发布流程完成')
        log('═══════════════════════════════════════')

        return { success: true, categoryUsed: primary.fullName }

    } catch (error) {
        log(`发布失败: ${error}`)
        return {
            success: false,
            error: error instanceof Error ? error.message : '未知错误'
        }
    }
}

// 导出函数供publisher.tsx使用
export { step3_selectCategoryTree as autoSelectCategoryTree }
export { step4_fillAttributes as autoFillAttributes }
export { step5_clickNext as autoSubmit }
export { step2_selectMarketAndBid as autoSelectMarketDialog }

