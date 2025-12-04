/**
 * Auto Publish RPA V3 - 政采云自动发布（完整流程重构）
 * 
 * 完整流程：
 * 1. 点击"修改"按钮打开选择卖场弹窗
 * 2. 点击➕展开"网上超市(青海网超)"
 * 3. 在展开的列表中选择对应标项（如"日用百货"）
 * 4. 点击"确定"关闭弹窗
 * 5. 在三列类目中逐级选择
 * 6. 填写品牌型号
 * 7. 点击下一步
 */

const BACKEND_URL = process.env.PLASMO_PUBLIC_BACKEND_URL || 'http://localhost:3000'

// ========== 工具函数 ==========

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function log(message: string) {
    console.log(`[RPA V3] ${message}`)
}

function clickElement(el: HTMLElement | null): boolean {
    if (!el) return false
    el.click()
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return true
}

/**
 * 通过文本查找按钮
 */
function findButtonByText(text: string): HTMLElement | null {
    const buttons = document.querySelectorAll<HTMLElement>('button, a, span, div')
    for (const btn of buttons) {
        const btnText = btn.textContent?.trim()
        if (btnText === text || btnText?.includes(text)) {
            // 确保是可点击的元素
            if (btn.tagName === 'BUTTON' || btn.tagName === 'A' ||
                btn.classList.contains('el-button') ||
                btn.style.cursor === 'pointer' ||
                btn.onclick) {
                return btn
            }
            // 返回包含文本的任何元素
            return btn
        }
    }
    return null
}

/**
 * 通过文本查找表格行
 */
function findTableRowByText(text: string): HTMLTableRowElement | null {
    const rows = document.querySelectorAll<HTMLTableRowElement>('tr')
    for (const row of rows) {
        if (row.textContent?.includes(text)) {
            return row
        }
    }
    return null
}

/**
 * 填写输入框
 */
function fillInput(selector: string, value: string): boolean {
    const input = document.querySelector<HTMLInputElement>(selector)
    if (!input) return false
    input.value = value
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    return true
}

// ========== API 调用 ==========

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
    title: string,
    brand: string | undefined,
    model: string | undefined,
    allowedRoots: string[]
): Promise<CategoryMatchResult | null> {
    try {
        log(`调用类目匹配API: ${title}`)

        const response = await fetch(`${BACKEND_URL}/api/category/match`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, brand, model, allowedRoots })
        })

        if (!response.ok) {
            log(`API请求失败: ${response.status}`)
            return null
        }

        const data = await response.json()
        if (data.success) {
            log(`匹配结果: ${data.data.primary.fullName}`)
            return data.data
        }

        return null
    } catch (error) {
        log(`API调用错误: ${error}`)
        return null
    }
}

// ========== 步骤1: 点击"修改"按钮打开弹窗 ==========

async function step1_clickModifyButton(): Promise<boolean> {
    log('========== 步骤1: 点击修改按钮 ==========')

    // 查找"修改"按钮
    const modifyBtn = findButtonByText('修改')

    if (modifyBtn) {
        clickElement(modifyBtn)
        log('✓ 点击修改按钮')
        await sleep(1000)
        return true
    }

    log('✗ 未找到修改按钮')
    return false
}

// ========== 步骤2: 展开"网上超市"并选择标项 ==========

async function step2_selectMarketCategory(rootName: string): Promise<boolean> {
    log('========== 步骤2: 选择电子卖场标项 ==========')
    log(`目标标项: ${rootName}`)

    // 等待弹窗加载
    await sleep(1000)

    // 查找弹窗
    const modal = document.querySelector('.el-dialog, .el-dialog__wrapper, [class*="modal"], [class*="dialog"]')
    if (!modal) {
        log('✗ 弹窗未出现')
        return false
    }
    log('✓ 弹窗已打开')

    // 查找"网上超市"行并点击展开按钮（➕）
    const rows = document.querySelectorAll<HTMLTableRowElement>('tr')
    for (const row of rows) {
        if (row.textContent?.includes('网上超市')) {
            log('✓ 找到网上超市行')

            // 查找展开按钮（➕号、箭头图标、或第一个可点击元素）
            const expandBtn = row.querySelector<HTMLElement>(
                '.el-table__expand-icon, ' +
                '[class*="expand"], ' +
                '[class*="plus"], ' +
                '.el-icon-arrow-right, ' +
                '.el-icon-plus, ' +
                'i, ' +
                'svg'
            )

            if (expandBtn) {
                clickElement(expandBtn)
                log('✓ 点击展开按钮')
                await sleep(800)
            } else {
                // 尝试点击行首的图标
                const firstCell = row.querySelector('td')
                if (firstCell) {
                    const icon = firstCell.querySelector('i, svg, span')
                    if (icon) {
                        clickElement(icon as HTMLElement)
                        log('✓ 点击行首图标')
                        await sleep(800)
                    }
                }
            }
            break
        }
    }

    // 等待子表格展开
    await sleep(500)

    // 查找包含目标标项的行（如"日用百货"）
    const allRows = document.querySelectorAll<HTMLTableRowElement>('tr')
    for (const row of allRows) {
        const rowText = row.textContent || ''

        // 匹配"标项名称：日用百货"或直接包含类目名
        if (rowText.includes(`标项名称：${rootName}`) ||
            rowText.includes(`标项名称:${rootName}`) ||
            (rowText.includes(rootName) && rowText.includes('标项'))) {

            log(`✓ 找到目标标项行: ${rootName}`)

            // 点击单选框
            const radio = row.querySelector<HTMLInputElement>('input[type="radio"], .el-radio__input')
            if (radio) {
                radio.click()
                log('✓ 点击单选框')
                await sleep(300)
            } else {
                // 尝试点击行中的label或整行
                const label = row.querySelector('label, .el-radio')
                if (label) {
                    clickElement(label as HTMLElement)
                    log('✓ 点击label')
                } else {
                    row.click()
                    log('✓ 点击整行')
                }
            }
            break
        }
    }

    // 点击确定按钮
    await sleep(500)

    const confirmBtns = document.querySelectorAll<HTMLButtonElement>('button')
    for (const btn of confirmBtns) {
        if (btn.textContent?.includes('确定') || btn.textContent?.includes('确认')) {
            // 确保是弹窗内的按钮
            if (btn.closest('.el-dialog') || btn.closest('[class*="modal"]') ||
                btn.classList.contains('el-button--primary')) {
                btn.click()
                log('✓ 点击确定按钮')
                await sleep(1000)
                return true
            }
        }
    }

    log('✗ 未找到确定按钮')
    return false
}

// ========== 步骤3: 在三列类目中选择 ==========

async function step3_selectCategoryTree(pathSegments: string[]): Promise<boolean> {
    log('========== 步骤3: 选择类目树 ==========')
    log(`路径: ${pathSegments.join(' > ')}`)

    if (!pathSegments || pathSegments.length === 0) {
        log('✗ 类目路径为空')
        return false
    }

    // 等待类目树加载
    await sleep(1500)

    // 依次选择每一级类目
    for (let i = 0; i < pathSegments.length; i++) {
        const categoryName = pathSegments[i]
        const level = i + 1

        log(`选择第${level}级类目: ${categoryName}`)
        await sleep(600)

        let found = false

        // 查找所有li元素
        const allItems = document.querySelectorAll<HTMLElement>('li')
        for (const item of allItems) {
            const text = item.textContent?.trim() || ''
            // 精确匹配或去掉数字后缀匹配
            const cleanText = text.replace(/\s*\(\d+\)\s*$/, '').replace(/\s*（\d+）\s*$/, '').trim()

            if (cleanText === categoryName) {
                // 确保点击的是叶子节点，不是容器
                if (!item.querySelector('ul') || item.classList.contains('is-current')) {
                    item.click()
                    item.dispatchEvent(new MouseEvent('click', { bubbles: true }))
                    found = true
                    log(`✓ 点击类目: ${categoryName}`)
                    break
                }
            }
        }

        // 备用策略：查找span元素
        if (!found) {
            const allSpans = document.querySelectorAll<HTMLElement>('span')
            for (const span of allSpans) {
                const text = span.textContent?.trim() || ''
                if (text === categoryName || text.startsWith(categoryName + '(') || text.startsWith(categoryName + '（')) {
                    // 点击span或其父li
                    const li = span.closest('li')
                    if (li) {
                        li.click()
                        li.dispatchEvent(new MouseEvent('click', { bubbles: true }))
                    } else {
                        span.click()
                        span.dispatchEvent(new MouseEvent('click', { bubbles: true }))
                    }
                    found = true
                    log(`✓ 点击span: ${categoryName}`)
                    break
                }
            }
        }

        if (!found) {
            log(`⚠ 未找到类目: ${categoryName}，继续尝试...`)
        }

        // 等待下一级加载
        await sleep(800)
    }

    log('类目选择完成')
    return true
}

// ========== 步骤4: 填写品牌型号 ==========

async function step4_fillAttributes(brand: string, model: string): Promise<boolean> {
    log('========== 步骤4: 填写属性 ==========')
    log(`品牌: ${brand}, 型号: ${model}`)

    await sleep(500)

    // 品牌下拉选择
    if (brand) {
        const brandSelect = document.querySelector<HTMLElement>('[class*="brand"] .el-select, .el-select')
        if (brandSelect) {
            brandSelect.click()
            await sleep(300)

            // 查找匹配的选项
            const options = document.querySelectorAll<HTMLElement>('.el-select-dropdown__item, .el-select-dropdown li')
            for (const opt of options) {
                if (opt.textContent?.includes(brand)) {
                    opt.click()
                    log(`✓ 选择品牌: ${opt.textContent}`)
                    break
                }
            }
        }
    }

    // 型号输入
    if (model) {
        await sleep(300)
        const modelInputs = document.querySelectorAll<HTMLInputElement>('input[placeholder*="型号"], input[name*="model"]')
        for (const input of modelInputs) {
            input.value = model
            input.dispatchEvent(new Event('input', { bubbles: true }))
            input.dispatchEvent(new Event('change', { bubbles: true }))
            log(`✓ 填写型号: ${model}`)
            break
        }
    }

    return true
}

// ========== 步骤5: 点击下一步 ==========

async function step5_clickNext(): Promise<boolean> {
    log('========== 步骤5: 点击下一步 ==========')

    await sleep(500)

    const buttonTexts = ['下一步', '保存并提交', '提交', '发布']

    for (const text of buttonTexts) {
        const btn = findButtonByText(text)
        if (btn && btn.tagName === 'BUTTON') {
            clickElement(btn)
            log(`✓ 点击: ${text}`)
            return true
        }
    }

    // 备用：查找primary按钮
    const primaryBtn = document.querySelector<HTMLButtonElement>('button.el-button--primary')
    if (primaryBtn) {
        primaryBtn.click()
        log('✓ 点击primary按钮')
        return true
    }

    log('⚠ 未找到下一步按钮')
    return false
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
        // 1. 调用后端匹配类目
        const matchResult = await matchCategoryFromBackend(
            options.title,
            options.brand,
            options.model,
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

        // 2. 点击修改按钮
        await step1_clickModifyButton()

        // 3. 选择电子卖场标项
        await step2_selectMarketCategory(rootName)

        // 4. 选择类目树
        await step3_selectCategoryTree(pathSegments)

        // 5. 填写属性
        await step4_fillAttributes(options.brand || '', options.model || '')

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
export { step2_selectMarketCategory as autoSelectMarketDialog }
