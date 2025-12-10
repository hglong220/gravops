/**
 * 政采云自动发布RPA V4 - 框架版
 * 使用 rpa-framework 提供的封装函数
 */

import { getStoredLicense } from './license'
import {
    log, sleep, simulateClick, highlightElement, removeHighlight,
    waitForElement, waitForCondition,
    findRowByText, findButtonByText, selectCategoryPath, selectBidItem,
    clickExpandAndWait, rpaConfig as config
} from './rpa-framework'

const BACKEND_URL = 'http://localhost:3000'

// ========== 步骤1: 打开电子卖场弹窗 ==========

async function step1_openMarketDialog(): Promise<Element> {
    log('========== 步骤1: 点击修改按钮 ==========')

    // 找"修改"按钮
    const modifyBtn = await waitForElement(
        () => findButtonByText(document, config.texts.modifyButton),
        { timeout: 8000, label: '修改按钮' }
    )

    highlightElement(modifyBtn, '点击: 修改')
    simulateClick(modifyBtn)
    removeHighlight()

    await sleep(config.timing.longWait)

    // 等待弹窗出现
    const dialog = await waitForElement(() => {
        const dialogs = document.querySelectorAll(config.selectors.dialog.wrapper)
        for (const d of dialogs) {
            const style = window.getComputedStyle(d)
            if (style.display !== 'none' && style.visibility !== 'hidden') {
                const text = d.textContent || ''
                if (text.includes('电子卖场') || text.includes('网上超市')) {
                    return d
                }
            }
        }
        return null
    }, { timeout: 8000, label: '电子卖场弹窗' })

    log('弹窗已打开', 'success')
    return dialog
}

// ========== 步骤2: 选择标项 ==========

async function step2_selectMarketAndBid(dialog: Element, targetBidName: string): Promise<boolean> {
    log('========== 步骤2: 选择电子卖场标项 ==========')
    log(`目标标项: ${targetBidName}`)

    await sleep(config.timing.mediumWait)

    // 1. 找到"网上超市"行
    const marketRow = findRowByText(dialog, config.texts.marketRowKeyword)
    if (!marketRow) {
        log('未找到网上超市行', 'error')
        return false
    }

    // 2. 必须成功展开才能继续！
    log('点击展开网上超市（必须成功）...')
    const expanded = await clickExpandAndWait(marketRow, dialog)

    if (!expanded) {
        log('展开失败！无法继续', 'error')
        log('请手动点击"+"展开后重试')
        return false  // 停止！不继续！
    }

    await sleep(config.timing.animationWait)

    // 3. 查找弹窗中所有标项行，找到目标标项
    log('查找标项行...')
    const allRows = dialog.querySelectorAll('tr')
    log(`弹窗中共 ${allRows.length} 行`)

    let bidRow: HTMLElement | null = null

    for (const tr of allRows) {
        const rowText = tr.textContent || ''

        // 调试：打印每行内容
        if (rowText.includes(config.texts.bidItemPrefix)) {
            log(`  发现标项: ${rowText.substring(0, 40)}...`)
        }

        if (rowText.includes(config.texts.bidItemPrefix) && rowText.includes(targetBidName)) {
            log(`找到目标标项行: ${targetBidName}`, 'success')
            bidRow = tr as HTMLElement
            break
        }
    }

    if (!bidRow) {
        log(`未找到标项: ${targetBidName}`, 'error')
        log('请检查标项名称是否正确')
        return false
    }

    // 4. 高亮并选中标项
    highlightElement(bidRow, `选择: ${targetBidName}`)
    await sleep(config.timing.shortWait)

    await selectBidItem(bidRow)
    log(`已选中标项: ${targetBidName}`, 'success')
    removeHighlight()

    await sleep(config.timing.shortWait)

    // 5. 点击确定
    const okBtn = findButtonByText(dialog, config.texts.confirmButton)
    if (okBtn) {
        highlightElement(okBtn, '点击: 确定')
        await sleep(config.timing.shortWait)
        simulateClick(okBtn)
        removeHighlight()
        log('点击确定按钮', 'success')
        await sleep(config.timing.longWait)
        return true
    }

    log('未找到确定按钮', 'error')
    return false
}

// ========== 步骤3: 选择类目树 ==========

async function step3_selectCategoryTree(categoryPath: string[]): Promise<boolean> {
    log('========== 步骤3: 选择类目树 ==========')
    log(`路径: ${categoryPath.join(' > ')}`)

    // 等待页面更新（对话框关闭后页面需要时间加载新的类目树）
    log('等待类目树加载...')
    await sleep(2000)  // 增加等待时间

    // 等待类目区域出现
    try {
        await waitForElement(() => {
            // 查找类目列表容器
            const containers = document.querySelectorAll('.category-list, .el-scrollbar, [class*="category"], .tree-container')
            for (const c of containers) {
                const rect = (c as HTMLElement).getBoundingClientRect()
                if (rect.width > 100 && rect.height > 100) {
                    const items = c.querySelectorAll('li, [class*="item"]')
                    if (items.length > 3) {
                        log(`找到类目容器: ${items.length} 个类目项`, 'success')
                        return c
                    }
                }
            }
            return null
        }, { timeout: 8000, label: '类目列表容器' })
    } catch (e) {
        log('等待类目容器超时，尝试继续...', 'warn')
    }

    await sleep(500)

    return await selectCategoryPath(categoryPath)
}

// ========== 步骤4: 填写属性 ==========

async function step4_fillAttributes(brand: string, model: string): Promise<boolean> {
    log('========== 步骤4: 填写属性 ==========')
    log(`品牌: ${brand || '无'}, 型号: ${model || '无'}`)

    // 简化版：只记录，具体填写逻辑保持原有
    if (brand) log(`待填写品牌: ${brand}`)
    if (model) log(`待填写型号: ${model}`)

    return true
}

// ========== 步骤5: 点击下一步 ==========

async function step5_clickNext(): Promise<boolean> {
    log('========== 步骤5: 点击下一步 ==========')

    await sleep(config.timing.mediumWait)

    const nextBtn = findButtonByText(document, config.texts.nextButton)
    if (nextBtn) {
        highlightElement(nextBtn, '点击: 下一步')
        nextBtn.scrollIntoView({ block: 'center' })
        await sleep(200)
        simulateClick(nextBtn)
        removeHighlight()
        log('点击下一步', 'success')
        return true
    }

    log('未找到下一步按钮', 'warn')
    return false
}

// ========== API 调用 ==========

async function matchCategoryFromBackend(productTitle: string): Promise<{
    path: string[]
    rootName: string
} | null> {
    log(`调用类目匹配API: ${productTitle}`)

    try {
        const stored = await getStoredLicense()
        const licenseKey = stored?.licenseKey || ''

        if (!licenseKey) {
            log('licenseKey为空', 'error')
            return null
        }

        const response = await fetch(`${BACKEND_URL}/api/category-match`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ licenseKey, productTitle, mode: 'full' })
        })

        if (!response.ok) {
            log(`API请求失败: ${response.status}`, 'error')
            return null
        }

        const data = await response.json()

        if (data.rejected) {
            log(`类目匹配被拒绝: ${data.reason}`, 'error')
            return null
        }

        if (data.success && data.data?.categoryPath) {
            const path = data.data.categoryPath as string[]
            log(`匹配结果: ${path.join(' > ')}`, 'success')
            return { path, rootName: path[0] }
        }

        return null
    } catch (error) {
        log(`API调用错误: ${error}`, 'error')
        return null
    }
}

// ========== 主流程 ==========

export interface AutoPublishOptionsV4 {
    title: string
    brand?: string
    model?: string
}

export async function executeAutoPublishV4(options: AutoPublishOptionsV4): Promise<{
    success: boolean
    error?: string
}> {
    log('═══════════════════════════════════════')
    log('开始自动发布流程 V4')
    log(`商品: ${options.title}`)
    log('═══════════════════════════════════════')

    try {
        // 1. 调用API匹配类目
        const matchResult = await matchCategoryFromBackend(options.title)
        if (!matchResult) {
            return { success: false, error: '类目匹配失败' }
        }

        const { path, rootName } = matchResult
        log(`一级类目(标项): ${rootName}`)
        log(`完整路径: ${path.join(' > ')}`)

        // 2. 打开弹窗
        let dialog: Element
        try {
            dialog = await step1_openMarketDialog()
        } catch (e) {
            return { success: false, error: '无法打开电子卖场弹窗' }
        }

        // 3. 选择标项（必须成功）
        const step2Success = await step2_selectMarketAndBid(dialog, rootName)
        if (!step2Success) {
            return { success: false, error: `未能选中标项"${rootName}"` }
        }

        // 4. 选择类目树（跳过第一级）
        const categoryPathForTree = path.slice(1)
        log(`类目树路径（跳过标项）: ${categoryPathForTree.join(' > ')}`)

        const step3Success = await step3_selectCategoryTree(categoryPathForTree)
        if (!step3Success) {
            return { success: false, error: '类目选择失败' }
        }

        // 5. 填写属性
        await step4_fillAttributes(options.brand || '', options.model || '')

        // 6. 点击下一步
        await step5_clickNext()

        log('═══════════════════════════════════════')
        log('自动发布流程完成', 'success')
        log('═══════════════════════════════════════')

        return { success: true }

    } catch (error) {
        log(`发布失败: ${error}`, 'error')
        return { success: false, error: String(error) }
    }
}

export { step1_openMarketDialog, step2_selectMarketAndBid, step3_selectCategoryTree }
