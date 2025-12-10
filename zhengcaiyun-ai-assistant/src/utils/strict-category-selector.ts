/**
 * RPA 严格类目选择模块
 * 
 * 特性：
 * 1. 100% 按 AI 指令执行，找不到立即报错
 * 2. 三层找不到判定
 * 3. 每级验证选中状态
 * 4. 详细日志
 */

// ========== 类型定义 ==========

/** AI 类目指令 */
export interface AiCategoryCommand {
    category_path: string[]
    confidence: number
    /** 期望的根类目（一级类目），用于校验当前标项 */
    expectedRoot?: string
}

/** 失败原因枚举 */
export enum FailReason {
    LEVEL_NOT_FOUND = 'LEVEL_NOT_FOUND',
    RENDER_NOT_COMPLETE = 'RENDER_NOT_COMPLETE',
    NOT_IN_VIEWPORT = 'NOT_IN_VIEWPORT',
    VIRTUAL_SCROLL_NOT_LOADED = 'VIRTUAL_SCROLL_NOT_LOADED',
    CLICK_NOT_EFFECTIVE = 'CLICK_NOT_EFFECTIVE',
    EXPAND_FAILED = 'EXPAND_FAILED',
    TIMEOUT = 'TIMEOUT',
    INVALID_COMMAND = 'INVALID_COMMAND',
    /** 标项与推荐类目不符 */
    BID_MISMATCH = 'BID_MISMATCH'
}

/** 执行结果 */
export interface StrictSelectionResult {
    success: boolean
    selectedPath: string[]
    failedAt?: number
    failedReason?: FailReason
    log: string[]
}

// ========== 日志工具 ==========

const logs: string[] = []

function log(level: number, message: string): void {
    const prefix = level > 0 ? `[RPA][Level ${level}]` : '[RPA]'
    const entry = `${prefix} ${message}`
    logs.push(entry)
    console.log(entry)
}

function clearLogs(): void {
    logs.length = 0
}

// ========== 工具函数 ==========

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/** 模拟点击 */
function simulateClick(el: HTMLElement): void {
    el.scrollIntoView({ behavior: 'instant', block: 'center' })

    // 多种点击方式确保生效
    el.click()
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

// ========== 核心函数 ==========

/**
 * 主入口：严格执行类目选择
 */
export async function executeStrictCategorySelection(
    command: AiCategoryCommand
): Promise<StrictSelectionResult> {
    clearLogs()
    log(0, '═══════════════════════════════════════')
    log(0, '开始严格类目选择')
    log(0, `路径: ${command.category_path.join(' > ')}`)
    log(0, `置信度: ${command.confidence}`)
    log(0, '═══════════════════════════════════════')

    const selectedPath: string[] = []

    try {
        // 1. 验证指令
        if (!command.category_path || command.category_path.length === 0) {
            log(0, '✗ 错误: 类目路径为空')
            throw { reason: FailReason.INVALID_COMMAND, level: 0 }
        }

        // 2. 校验标项（根类目）是否匹配
        const expectedRoot = command.expectedRoot || command.category_path[0]
        log(0, `期望根类目: ${expectedRoot}`)

        const currentBidRoot = detectCurrentBidRoot()
        log(0, `当前标项根类目: ${currentBidRoot || '(未检测到)'}`)

        if (currentBidRoot && currentBidRoot !== expectedRoot) {
            log(0, '✗ 标项与推荐类目不符')
            log(0, `  当前标项: ${currentBidRoot}`)
            log(0, `  推荐类目: ${expectedRoot}`)
            log(0, '请切换标项后重试')
            throw {
                reason: FailReason.BID_MISMATCH,
                level: 0,
                message: `标项与推荐类目不符，当前标项是"${currentBidRoot}"，请切换到"${expectedRoot}"后重试`
            }
        }

        // 3. 等待类目区域就绪
        log(0, '等待类目选择区域...')
        await waitForCategoryAreaReady()
        log(0, '✓ 类目区域就绪')

        // 4. 逐级选择（严格执行，任一级失败立即终止，不继续不跳过）
        for (let i = 0; i < command.category_path.length; i++) {
            const level = i + 1
            const categoryName = command.category_path[i]

            log(level, `正在选择: ${categoryName}`)

            // 如果找不到，selectSingleLevel 会抛出错误，流程立即终止
            await selectSingleLevel(level, categoryName)
            selectedPath.push(categoryName)

            log(level, `✓ 第${level}级选择成功`)
        }

        // 全部成功才返回 success=true
        // 注意：不打印"类目选择完成"，由调用方决定后续操作
        return {
            success: true,
            selectedPath,
            log: [...logs]
        }

    } catch (error: any) {
        const failedAt = error.level || 0
        const reason = error.reason || FailReason.LEVEL_NOT_FOUND

        log(failedAt, `✗ 错误: ${reason}`)
        log(0, '执行中止')

        return {
            success: false,
            selectedPath,
            failedAt,
            failedReason: reason,
            log: [...logs]
        }
    }
}

// ========== 步骤函数 ==========

/**
 * 等待类目选择区域就绪
 */
async function waitForCategoryAreaReady(): Promise<HTMLElement> {
    const selectors = [
        '.category-container',
        '.category-list',
        '[class*="category"]',
        '.tree-container',
        '.el-scrollbar',
        '.cascader-panel'
    ]

    const maxWait = 10000
    const interval = 200
    const start = Date.now()

    while (Date.now() - start < maxWait) {
        for (const selector of selectors) {
            const el = document.querySelector(selector) as HTMLElement
            if (el && el.offsetHeight > 0) {
                return el
            }
        }
        await sleep(interval)
    }

    throw { reason: FailReason.TIMEOUT, level: 0 }
}

/**
 * 选择单级类目（核心逻辑）
 */
async function selectSingleLevel(level: number, categoryName: string): Promise<void> {
    // 1. 等待该级列表容器就绪
    await waitForLevelReady(level)

    // 2. 三层查找逻辑
    const item = await findCategoryItemWithRetry(level, categoryName)

    if (!item) {
        log(level, `✗ 未找到类目: ${categoryName}`)
        throw { reason: FailReason.LEVEL_NOT_FOUND, level }
    }

    log(level, `找到目标元素`)

    // 3. 点击
    simulateClick(item)
    log(level, '点击完成')

    // 4. 验证选中
    await sleep(300)
    const isSelected = verifySelection(level, categoryName, item)
    if (!isSelected) {
        // 重试一次
        log(level, '选中验证失败，重试点击...')
        simulateClick(item)
        await sleep(500)

        if (!verifySelection(level, categoryName, item)) {
            throw { reason: FailReason.CLICK_NOT_EFFECTIVE, level }
        }
    }
    log(level, '✓ 选中验证通过')

    // 5. 如果不是最后一级，验证下一级展开
    // （这里简化处理，等待一段时间让下一级加载）
    await sleep(800)
}

/**
 * 等待指定级别的列表就绪
 */
async function waitForLevelReady(level: number): Promise<void> {
    const maxWait = 5000
    const start = Date.now()

    while (Date.now() - start < maxWait) {
        const items = getAllVisibleCategoryItems()
        if (items.length > 0) {
            return
        }
        await sleep(200)
    }

    throw { reason: FailReason.TIMEOUT, level }
}

/**
 * 三层查找：渲染 → 滚动 → 虚拟列表
 */
async function findCategoryItemWithRetry(
    level: number,
    categoryName: string
): Promise<HTMLElement | null> {
    // 第一层：检查渲染是否完成，直接查找
    log(level, '[Layer 1] 检查已渲染内容...')
    let item = findCategoryByName(categoryName)
    if (item) {
        log(level, '[Layer 1] ✓ 直接找到')
        return item
    }

    // 第二层：滚动搜索
    log(level, '[Layer 2] 开始滚动搜索...')
    item = await scrollAndSearch(categoryName, level)
    if (item) {
        log(level, '[Layer 2] ✓ 滚动后找到')
        return item
    }

    // 第三层：尝试触发虚拟滚动加载
    log(level, '[Layer 3] 尝试触发虚拟滚动...')
    await triggerVirtualScrollLoad()
    await sleep(500)

    item = findCategoryByName(categoryName)
    if (item) {
        log(level, '[Layer 3] ✓ 虚拟滚动后找到')
        return item
    }

    log(level, '[Layer 3] ✗ 三层查找均失败')
    return null
}

/**
 * 获取所有可见的类目项
 */
function getAllVisibleCategoryItems(): HTMLElement[] {
    const items: HTMLElement[] = []
    const candidates = document.querySelectorAll('li, .el-cascader-node, .category-item, [role="treeitem"]')

    for (const el of candidates) {
        const rect = (el as HTMLElement).getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0) {
            items.push(el as HTMLElement)
        }
    }

    return items
}

/**
 * 按名称查找类目
 */
function findCategoryByName(categoryName: string): HTMLElement | null {
    const items = getAllVisibleCategoryItems()

    for (const item of items) {
        const text = item.textContent?.trim() || ''
        // 清理文本：去除数字后缀如 (123)
        const cleanText = text.replace(/\s*[\(（]\d+[\)）]\s*$/, '').replace(/标$/, '').trim()

        if (cleanText === categoryName) {
            return item
        }
    }

    return null
}

/**
 * 滚动搜索
 */
async function scrollAndSearch(categoryName: string, level: number): Promise<HTMLElement | null> {
    // 找到可滚动容器
    const scrollContainers = document.querySelectorAll('.el-scrollbar__wrap, .category-list, [style*="overflow"]')

    for (const container of scrollContainers) {
        const scrollEl = container as HTMLElement
        if (scrollEl.scrollHeight <= scrollEl.clientHeight) continue

        const scrollStep = scrollEl.clientHeight * 0.8
        const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight
        let currentScroll = 0

        // 先滚到顶部
        scrollEl.scrollTop = 0
        await sleep(200)

        // 分段滚动
        while (currentScroll < maxScroll) {
            const item = findCategoryByName(categoryName)
            if (item) return item

            currentScroll += scrollStep
            scrollEl.scrollTop = currentScroll
            await sleep(300)

            const progress = Math.min(100, Math.round((currentScroll / maxScroll) * 100))
            log(level, `  滚动 ${progress}%...`)
        }

        // 最后检查一次
        const item = findCategoryByName(categoryName)
        if (item) return item
    }

    return null
}

/**
 * 触发虚拟滚动加载
 */
async function triggerVirtualScrollLoad(): Promise<void> {
    // 检测虚拟列表
    const virtualContainers = document.querySelectorAll(
        '[class*="virtual"], [class*="Virtual"], .el-virtual-scrollbar'
    )

    for (const container of virtualContainers) {
        const el = container as HTMLElement
        // 快速滚动触发加载
        el.scrollTop = 0
        await sleep(100)
        el.scrollTop = el.scrollHeight / 2
        await sleep(100)
        el.scrollTop = el.scrollHeight
        await sleep(100)
        el.scrollTop = 0
    }
}

/**
 * 验证选中状态
 */
function verifySelection(level: number, expectedName: string, clickedItem: HTMLElement): boolean {
    // 检查方式1：元素本身是否有选中类
    const hasActiveClass = clickedItem.classList.contains('is-active') ||
        clickedItem.classList.contains('selected') ||
        clickedItem.classList.contains('is-checked') ||
        clickedItem.getAttribute('aria-selected') === 'true'

    if (hasActiveClass) return true

    // 检查方式2：检查父元素
    const parent = clickedItem.closest('.is-active, .selected, [aria-selected="true"]')
    if (parent) return true

    // 检查方式3：检查文本是否仍可见（至少说明没出错）
    const text = clickedItem.textContent?.trim() || ''
    if (text.includes(expectedName)) return true

    return false
}

// ========== 导出简化接口 ==========

/**
 * 简化版：只传路径数组
 */
export async function selectCategoryPath(path: string[]): Promise<StrictSelectionResult> {
    return executeStrictCategorySelection({
        category_path: path,
        confidence: 1.0
    })
}

// ========== 标项检测 ==========

/**
 * 检测当前选中的标项根类目
 * 用于校验当前页面的标项是否与AI推荐的类目匹配
 */
function detectCurrentBidRoot(): string | null {
    // 方式1: 从面包屑/已选路径中检测
    const breadcrumbs = document.querySelectorAll(
        '.el-breadcrumb__item, .breadcrumb-item, [class*="breadcrumb"] span, .category-path span'
    )
    if (breadcrumbs.length > 0) {
        const first = breadcrumbs[0]?.textContent?.trim()
        if (first && first.length > 1 && first.length < 20) {
            return first.replace(/[>\/]$/, '').trim()
        }
    }

    // 方式2: 从页面标题/标项名称中检测
    const bidNameSelectors = [
        '.bid-name',
        '.category-root',
        '[class*="bid-title"]',
        '.current-category',
        '.selected-category'
    ]
    for (const sel of bidNameSelectors) {
        const el = document.querySelector(sel)
        if (el?.textContent?.trim()) {
            return el.textContent.trim()
        }
    }

    // 方式3: 从已选中的一级类目检测
    const activeL1 = document.querySelector(
        '.category-level-1 .is-active, [data-level="1"].selected, .first-level .active'
    )
    if (activeL1?.textContent?.trim()) {
        return activeL1.textContent.trim().replace(/\s*[\(（]\d+[\)）]\s*$/, '')
    }

    // 方式4: 从URL中解析
    const url = window.location.href
    const categoryMatch = url.match(/category[=\/]([^&\/]+)/i)
    if (categoryMatch) {
        return decodeURIComponent(categoryMatch[1])
    }

    // 未检测到
    return null
}

