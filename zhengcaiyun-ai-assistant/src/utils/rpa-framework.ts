/**
 * RPA 核心框架
 * 
 * 提供可靠的 DOM 操作封装：
 * 1. 基于 MutationObserver 的等待机制
 * 2. 可视化调试（高亮目标元素）
 * 3. 详细日志
 * 4. 配置驱动
 */

import config from '../config/rpa-config.json'

// ========== 类型定义 ==========

export interface WaitOptions {
    timeout?: number
    interval?: number
    label?: string
}

export interface ClickOptions {
    highlight?: boolean
    highlightDuration?: number
    label?: string
}

// ========== 日志系统 ==========

const logHistory: string[] = []

export function log(message: string, level: 'info' | 'success' | 'warn' | 'error' = 'info') {
    const icons = { info: '📋', success: '✓', warn: '⚠', error: '✗' }
    const entry = `[RPA] ${icons[level]} ${message}`
    logHistory.push(entry)
    console.log(entry)
}

export function getLogHistory(): string[] {
    return [...logHistory]
}

export function clearLogHistory(): void {
    logHistory.length = 0
}

// ========== 可视化调试 ==========

let highlightOverlay: HTMLDivElement | null = null

export function highlightElement(el: HTMLElement, label: string, color = config.debug.highlightColor): void {
    if (!config.debug.showHighlight) return

    // 移除之前的高亮
    removeHighlight()

    // 获取元素位置
    const rect = el.getBoundingClientRect()

    // 创建高亮覆盖层
    highlightOverlay = document.createElement('div')
    highlightOverlay.id = 'rpa-highlight-overlay'
    highlightOverlay.style.cssText = `
        position: fixed;
        left: ${rect.left - 3}px;
        top: ${rect.top - 3}px;
        width: ${rect.width + 6}px;
        height: ${rect.height + 6}px;
        border: ${config.debug.highlightWidth} solid ${color};
        border-radius: 4px;
        pointer-events: none;
        z-index: 999999;
        box-shadow: 0 0 10px ${color}40;
    `

    // 添加标签
    const labelEl = document.createElement('div')
    labelEl.style.cssText = `
        position: absolute;
        top: -24px;
        left: 0;
        background: ${color};
        color: white;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
        white-space: nowrap;
    `
    labelEl.textContent = label
    highlightOverlay.appendChild(labelEl)

    document.body.appendChild(highlightOverlay)
}

export function removeHighlight(): void {
    if (highlightOverlay) {
        highlightOverlay.remove()
        highlightOverlay = null
    }
}

// ========== 基础工具 ==========

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 模拟真实用户点击
 */
export function simulateClick(el: HTMLElement): void {
    const rect = el.getBoundingClientRect()
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

    // 完整的鼠标事件序列
    el.dispatchEvent(new MouseEvent('mouseenter', eventOptions))
    el.dispatchEvent(new MouseEvent('mouseover', eventOptions))
    el.dispatchEvent(new MouseEvent('mousedown', eventOptions))
    el.dispatchEvent(new MouseEvent('mouseup', eventOptions))
    el.dispatchEvent(new MouseEvent('click', eventOptions))
    el.click()
}

// ========== 核心等待函数 ==========

/**
 * 等待元素出现
 */
export async function waitForElement<T extends Element>(
    finder: () => T | null,
    options: WaitOptions = {}
): Promise<T> {
    const timeout = options.timeout ?? config.timing.elementTimeout
    const interval = options.interval ?? 200
    const label = options.label ?? '元素'

    const start = Date.now()

    while (Date.now() - start < timeout) {
        try {
            const el = finder()
            if (el) {
                log(`找到${label}`, 'success')
                return el
            }
        } catch (e) { }
        await sleep(interval)
    }

    throw new Error(`等待${label}超时 (${timeout}ms)`)
}

/**
 * 等待条件满足
 */
export async function waitForCondition(
    condition: () => boolean,
    options: WaitOptions = {}
): Promise<void> {
    const timeout = options.timeout ?? config.timing.elementTimeout
    const interval = options.interval ?? 200
    const label = options.label ?? '条件'

    const start = Date.now()

    while (Date.now() - start < timeout) {
        if (condition()) {
            log(`${label}已满足`, 'success')
            return
        }
        await sleep(interval)
    }

    throw new Error(`等待${label}超时 (${timeout}ms)`)
}

/**
 * 使用 MutationObserver 等待 DOM 变化
 */
export function waitForDOMChange(
    target: Element,
    options: WaitOptions = {}
): Promise<MutationRecord[]> {
    const timeout = options.timeout ?? config.timing.elementTimeout
    const label = options.label ?? 'DOM变化'

    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            observer.disconnect()
            reject(new Error(`等待${label}超时`))
        }, timeout)

        const observer = new MutationObserver((mutations) => {
            clearTimeout(timer)
            observer.disconnect()
            log(`检测到${label}`, 'success')
            resolve(mutations)
        })

        observer.observe(target, {
            childList: true,
            subtree: true,
            attributes: true
        })
    })
}

// ========== 高级查找函数 ==========

/**
 * 按文本查找行
 */
export function findRowByText(container: Element, text: string): HTMLElement | null {
    const rows = container.querySelectorAll(config.selectors.table.row)

    for (const row of rows) {
        const rowText = row.textContent || ''
        if (rowText.includes(text)) {
            log(`找到包含"${text}"的行`, 'success')
            return row as HTMLElement
        }
    }

    log(`未找到包含"${text}"的行`, 'warn')
    return null
}

/**
 * 按文本查找按钮
 */
export function findButtonByText(container: Element | Document, text: string): HTMLButtonElement | null {
    const buttons = container.querySelectorAll('button')

    for (const btn of buttons) {
        const btnText = btn.textContent?.trim() || ''
        if (btnText === text || btnText.includes(text)) {
            return btn
        }
    }

    return null
}

/**
 * 查找可见的类目项
 */
export function findVisibleCategoryItems(): HTMLElement[] {
    const items: HTMLElement[] = []
    const candidates = document.querySelectorAll(config.selectors.category.item)

    for (const el of candidates) {
        const rect = (el as HTMLElement).getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0) {
            items.push(el as HTMLElement)
        }
    }

    return items
}

/**
 * 按名称查找类目项
 */
export function findCategoryByName(name: string): HTMLElement | null {
    const items = findVisibleCategoryItems()

    // 调试：显示找到的类目项
    if (items.length > 0 && items.length < 20) {
        const sampleTexts = items.slice(0, 5).map(i => {
            const t = i.textContent?.trim() || ''
            return t.substring(0, 20)
        })
        log(`  可见类目: [${sampleTexts.join(', ')}...]`)
    }

    for (const item of items) {
        const text = item.textContent?.trim() || ''
        // 清理文本：去除数字后缀如 (123)
        const cleanText = text.replace(/\s*[\(（]\d+[\)）]\s*$/, '').replace(/标$/, '').trim()

        if (cleanText === name) {
            return item
        }

        // 模糊匹配：如果文本包含目标名称
        if (cleanText.includes(name) || name.includes(cleanText)) {
            log(`  模糊匹配: "${cleanText}" ~ "${name}"`)
            return item
        }
    }

    return null
}

// ========== 高级操作函数 ==========

/**
 * 强制点击元素（使用多种方法确保点击生效）
 */
function forceClick(el: HTMLElement): void {
    log(`  强制点击: ${el.tagName}.${el.className?.substring(0, 20)}`)

    // 方法1: 原生 click
    el.click()

    // 方法2: 模拟鼠标事件
    const rect = el.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2

    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y }))
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x, clientY: y }))
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }))

    // 方法3: 如果是 i 标签，也点击它的父元素
    if (el.tagName === 'I' || el.tagName === 'SVG') {
        const parent = el.parentElement
        if (parent) {
            parent.click()
        }
    }
}

/**
 * 点击展开按钮并等待子行出现（必须成功展开）
 */
export async function clickExpandAndWait(row: HTMLElement, container: Element): Promise<boolean> {
    const rowsBefore = container.querySelectorAll(config.selectors.table.row).length
    log(`当前行数: ${rowsBefore}`)

    // 查找第一个单元格中的可点击元素
    const firstCell = row.querySelector('td') as HTMLElement
    if (!firstCell) {
        log('未找到第一个单元格', 'error')
        return false
    }

    // 尝试多种展开按钮选择器
    const expandSelectors = [
        '.el-table__expand-icon',
        '.el-icon-arrow-right',
        '.el-icon-plus',
        '[class*="expand"]',
        'i',
        'svg',
        'span:first-child'
    ]

    for (const selector of expandSelectors) {
        const expandBtn = row.querySelector(selector) as HTMLElement
        if (!expandBtn) continue

        // 检查元素是否可见
        const rect = expandBtn.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) continue

        highlightElement(expandBtn, '即将点击展开')
        log(`找到展开按钮: ${selector}`)

        await sleep(1000)  // 等1秒让用户看到高亮

        // 强制点击
        forceClick(expandBtn)

        log('已发送点击事件，等待展开...')

        // 等待展开（最多等10秒）
        for (let i = 0; i < 10; i++) {
            await sleep(1000)
            const rowsAfter = container.querySelectorAll(config.selectors.table.row).length
            log(`  检查行数: ${rowsAfter}`)

            if (rowsAfter > rowsBefore) {
                log(`展开成功: ${rowsBefore} → ${rowsAfter} 行`, 'success')
                removeHighlight()
                await sleep(config.timing.animationWait)
                return true
            }
        }

        log('点击后行数未变化，尝试下一个选择器...')
    }

    // 最后尝试：点击整个第一个单元格
    log('尝试点击第一个单元格')
    highlightElement(firstCell, '点击单元格展开')
    await sleep(1000)
    forceClick(firstCell)

    // 等待展开
    for (let i = 0; i < 5; i++) {
        await sleep(1000)
        const rowsAfter = container.querySelectorAll(config.selectors.table.row).length
        if (rowsAfter > rowsBefore) {
            log(`点击单元格展开成功: ${rowsBefore} → ${rowsAfter} 行`, 'success')
            removeHighlight()
            return true
        }
    }

    removeHighlight()
    log('展开失败：所有方法都未能展开', 'error')
    return false
}

/**
 * 选择标项（单选按钮）
 */
export async function selectBidItem(row: HTMLElement): Promise<boolean> {
    const radioSelectors = config.selectors.table.radio.split(', ')

    for (const selector of radioSelectors) {
        const radio = row.querySelector(selector.trim()) as HTMLElement
        if (!radio) continue

        highlightElement(radio, '选择标项')
        log(`点击单选按钮: ${selector}`)

        simulateClick(radio)
        if (radio instanceof HTMLInputElement) {
            radio.checked = true
        }

        await sleep(config.timing.shortWait)
        removeHighlight()
        return true
    }

    // 尝试点击整行
    log('未找到单选按钮，点击整行')
    highlightElement(row, '点击选择')
    simulateClick(row)
    await sleep(config.timing.shortWait)
    removeHighlight()

    return true
}

/**
 * 滚动搜索类目
 */
export async function scrollAndFindCategory(name: string): Promise<HTMLElement | null> {
    const containers = document.querySelectorAll(config.selectors.category.scrollContainer)

    for (const container of containers) {
        const scrollEl = container as HTMLElement
        if (scrollEl.scrollHeight <= scrollEl.clientHeight + 10) continue

        const scrollStep = scrollEl.clientHeight * 0.7
        const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight

        // 先滚到顶部
        scrollEl.scrollTop = 0
        await sleep(200)

        let currentScroll = 0
        while (currentScroll < maxScroll) {
            const item = findCategoryByName(name)
            if (item) {
                log(`滚动查找到: ${name}`, 'success')
                return item
            }

            currentScroll += scrollStep
            scrollEl.scrollTop = currentScroll
            await sleep(300)
        }

        // 最后检查一次
        const item = findCategoryByName(name)
        if (item) return item
    }

    return null
}

/**
 * 选择类目路径（逐级点击）
 */
export async function selectCategoryPath(path: string[]): Promise<boolean> {
    log(`选择类目路径: ${path.join(' > ')}`)

    for (let i = 0; i < path.length; i++) {
        const categoryName = path[i]
        const level = i + 1

        log(`选择第${level}级: ${categoryName}`)

        let item: HTMLElement | null = null
        let retries = 0

        while (!item && retries < config.timing.maxRetries) {
            retries++

            // 直接查找
            item = findCategoryByName(categoryName)

            // 滚动查找
            if (!item && retries >= 2) {
                log(`  尝试滚动搜索...`)
                item = await scrollAndFindCategory(categoryName)
            }

            if (!item) {
                log(`  等待重试... (${retries}/${config.timing.maxRetries})`)
                await sleep(config.timing.animationWait)
            }
        }

        if (!item) {
            log(`未找到第${level}级类目: ${categoryName}`, 'error')
            return false
        }

        highlightElement(item, `点击: ${categoryName}`)
        simulateClick(item)

        // 也点击内部 span
        const span = item.querySelector('span')
        if (span) simulateClick(span as HTMLElement)

        log(`第${level}级选择成功: ${categoryName}`, 'success')
        removeHighlight()

        await sleep(config.timing.longWait)
    }

    return true
}

// ========== 导出配置 ==========

export { config as rpaConfig }
