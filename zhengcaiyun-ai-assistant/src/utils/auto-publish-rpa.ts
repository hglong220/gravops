/**
 * 政采云自动发布RPA - 稳定版
 * 按照 waitForElement + 文字查找 + 分步骤 的方式实现
 */

import { getStoredLicense } from './license'

// 开发环境用本地，生产环境用vercel
const BACKEND_URL = 'http://localhost:3000'
// const BACKEND_URL = 'https://zhengcaiyun-backend.vercel.app'

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

    // 查找"网上超市(青海网超)"行并点击展开
    const tds = dialog.querySelectorAll('td')
    let marketRow: HTMLTableRowElement | null = null

    for (const td of tds) {
        if (td.textContent?.includes('网上超市')) {
            marketRow = td.closest('tr')
            break
        }
    }

    if (marketRow) {
        // 查找展开按钮（+ 号或箭头图标）
        const expandBtn = marketRow.querySelector('button, .el-icon-plus, .el-table__expand-icon, i, svg') as HTMLElement
        if (expandBtn) {
            log('✓ 点击展开网上超市')
            simulateClick(expandBtn)
            await sleep(800)
        }
    }

    // 在标项表格中找到目标标项并选中
    await sleep(300)
    const rows = dialog.querySelectorAll('tbody tr')
    let foundBid = false

    for (const tr of rows) {
        const rowText = tr.textContent || ''
        // 匹配 "标项名称：办公设备/耗材" 或直接包含类目名
        if (rowText.includes(targetBidName) || rowText.includes(`标项名称：${targetBidName}`) || rowText.includes(`标项名称:${targetBidName}`)) {
            const radio = tr.querySelector('input[type="radio"]') as HTMLInputElement
            const radioLabel = tr.querySelector('.el-radio, .el-radio__input, label') as HTMLElement

            if (radio) {
                radio.click()
                log(`✓ 选中标项: ${targetBidName}`)
                foundBid = true
            } else if (radioLabel) {
                simulateClick(radioLabel)
                log(`✓ 选中标项(label): ${targetBidName}`)
                foundBid = true
            }
            break
        }
    }

    if (!foundBid) {
        log(`⚠ 未找到标项: ${targetBidName}`)
    }

    await sleep(300)

    // 点击弹窗的"确定"按钮
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

    // 查找类目列表容器（通常有3列）
    // 根据政采云页面结构，类目通常在 el-scrollbar 或特定的列容器中

    for (let i = 0; i < categoryPath.length && i < 5; i++) {
        const categoryName = categoryPath[i]
        const level = i + 1

        log(`选择第${level}级类目: ${categoryName}`)

        // 等待并查找类目项
        let found = false
        let retries = 0

        while (!found && retries < 5) {
            retries++

            // 查找所有可见的li元素
            const allItems = document.querySelectorAll('li')
            for (const item of allItems) {
                const rect = item.getBoundingClientRect()
                // 只处理可见元素
                if (rect.width <= 0 || rect.height <= 0 || rect.top < 0 || rect.top > window.innerHeight) {
                    continue
                }

                const text = item.textContent?.trim() || ''
                const cleanText = text.replace(/\s*[\(（]\d+[\)）]\s*$/, '').replace(/标$/, '').trim()

                if (cleanText === categoryName) {
                    log(`  找到: ${cleanText}`)
                    simulateClick(item as HTMLElement)

                    // 同时点击内部的span（有些框架需要）
                    const span = item.querySelector('span')
                    if (span) {
                        simulateClick(span as HTMLElement)
                    }

                    found = true
                    log(`  ✓ 点击第${level}级: ${categoryName}`)
                    break
                }
            }

            if (!found) {
                log(`  等待重试... (${retries}/5)`)
                await sleep(800)
            }
        }

        if (!found) {
            log(`  ✗ 未找到第${level}级类目: ${categoryName}`)
        }

        // 等待下一级类目加载
        await sleep(1000)
    }

    log('类目选择完成')
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
        const dialog = await step1_openMarketDialog()

        // 3. 选择电子卖场和标项
        await step2_selectMarketAndBid(dialog, rootName)

        // 4. 选择类目树
        await step3_selectCategoryTree(pathSegments)

        // 5. 填写属性（使用提取的品牌和型号）
        await step4_fillAttributes(brand, model)

        // 6. 点击下一步
        await step5_clickNext()

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

