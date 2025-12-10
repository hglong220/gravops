/**
 * ZCY Auto Publish Executor - 模板驱动的自动发布执行器
 * 
 * 完整流程：
 * 1. 点击"修改"按钮打开选择卖场弹窗
 * 2. 展开卖场（如"网上超市(青海网超)"）并选择标项
 * 3. 点击"确定"关闭弹窗
 * 4. 在三列类目树中选择：一级 → 二级 → 三级
 * 5. 填写商品关键属性
 * 6. 点击"下一步"
 */

import type { ZcyPublishTemplate, ProductData, ZcyPublishMessage } from './zcy-publish-types'
import { waitFor, sleep, findElementByText, fillInputByLabel, clickElement, resolveAttrValue } from './zcy-publish-types'

// ========== 状态通知 ==========

function sendStatus(type: 'info' | 'success' | 'error', title: string, message: string, details?: string) {
    chrome.runtime.sendMessage({
        type: 'PUBLISH_STATUS_UPDATE',
        status: { type, title, message, details, timestamp: Date.now() }
    }).catch(err => console.warn('[ZCY Executor] Status send failed:', err))

    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : '🤖'
    console.log(`[ZCY Executor] ${icon} ${title}: ${message}`)
}

// ========== 步骤1: 点击"修改"按钮 ==========

async function step1_clickModify(): Promise<boolean> {
    sendStatus('info', '自动发布', '正在打开卖场选择...')

    // 查找"修改"按钮
    const modifyBtn = findElementByText<HTMLButtonElement>('button, a, span', '修改')

    if (!modifyBtn) {
        // 尝试其他选择器
        const altBtn = document.querySelector<HTMLButtonElement>('.modify-btn, [class*="modify"], .btn-edit')
        if (altBtn) {
            clickElement(altBtn)
            await sleep(500)
            return true
        }
        console.warn('[ZCY Executor] 未找到修改按钮')
        return false
    }

    clickElement(modifyBtn)
    await sleep(500)
    return true
}

// ========== 步骤2: 选择电子卖场和标项 ==========

async function step2_selectMarket(template: ZcyPublishTemplate): Promise<boolean> {
    sendStatus('info', '自动发布', `正在选择卖场: ${template.market}...`)

    try {
        // 等待弹窗出现
        const dialog = await waitFor(() =>
            document.querySelector('.ant-modal, .el-dialog, [class*="dialog"], [class*="modal"]') as HTMLElement
            , 5000)

        if (!dialog) {
            console.warn('[ZCY Executor] 弹窗未出现')
            return false
        }

        await sleep(500)

        // 查找包含卖场名称的行并点击展开
        const marketText = template.market // 如 "青海网超"
        const rows = dialog.querySelectorAll('tr, .list-item, [class*="row"]')

        let marketFound = false
        for (const row of rows) {
            if (row.textContent?.includes(marketText) || row.textContent?.includes('网上超市')) {
                // 点击 + 号展开
                const expandBtn = row.querySelector('.ant-table-row-expand-icon, .el-icon-plus, [class*="expand"], [class*="plus"], button') as HTMLElement
                if (expandBtn) {
                    clickElement(expandBtn)
                    await sleep(800)
                    marketFound = true
                    break
                }
            }
        }

        if (!marketFound) {
            console.warn('[ZCY Executor] 未找到卖场:', marketText)
        }

        // 选择标项（如果模板中指定了）
        if (template.bidItemName) {
            await sleep(300)
            const bidItemText = template.bidItemName

            // 查找标项单选按钮
            const allRows = dialog.querySelectorAll('tr, .list-item, [class*="row"]')
            for (const row of allRows) {
                if (row.textContent?.includes(bidItemText) || row.textContent?.includes(`标项名称：${bidItemText}`)) {
                    const radio = row.querySelector('input[type="radio"], .ant-radio-input, .el-radio__input') as HTMLInputElement
                    if (radio) {
                        radio.click()
                        await sleep(200)
                        break
                    }
                }
            }
        }

        // 点击确定按钮
        await sleep(300)
        const confirmBtn = findElementByText<HTMLButtonElement>('button', '确定', dialog)
            || dialog.querySelector('.ant-btn-primary, .el-button--primary') as HTMLButtonElement

        if (confirmBtn) {
            clickElement(confirmBtn)
            await sleep(800)
        }

        return true
    } catch (error) {
        console.error('[ZCY Executor] 选择卖场失败:', error)
        return false
    }
}

// ========== 步骤3: 选择三级类目 ==========

async function step3_selectCategory(template: ZcyPublishTemplate): Promise<boolean> {
    const categoryPath = template.categoryPath
    if (!categoryPath || categoryPath.length === 0) {
        console.error('[ZCY Executor] 类目路径为空')
        return false
    }

    sendStatus('info', '自动发布', `正在选择类目: ${categoryPath.join(' > ')}...`)

    try {
        // 等待类目选择区域出现
        await waitFor(() =>
            document.querySelector('.category-container, .category-list, [class*="category"], .tree-container') as HTMLElement
            , 5000)

        await sleep(500)

        // 动态遍历每一级类目
        for (let level = 0; level < categoryPath.length; level++) {
            const categoryName = categoryPath[level]
            const levelNum = level + 1

            await sleep(300)

            // 尝试多种选择器定位对应级别的类目列表
            const columnSelectors = [
                `.category-list-${levelNum}`,
                `.level-${levelNum}`,
                `.column-${levelNum}`,
                `[class*="column"]:nth-child(${levelNum})`,
                `.category-column:nth-child(${levelNum})`
            ]

            let column: HTMLElement | null = null

            // 尝试找到对应级别的列
            for (const selector of columnSelectors) {
                column = document.querySelector(selector) as HTMLElement
                if (column) break
            }

            // 备用方案：获取所有列，取第N个
            if (!column) {
                const allColumns = document.querySelectorAll('.category-container ul, .category-list, .list, .column')
                if (allColumns.length >= levelNum) {
                    column = allColumns[level] as HTMLElement
                }
            }

            // 如果还找不到，使用通用容器
            if (!column) {
                column = document.querySelector('.category-container') as HTMLElement
            }

            if (!column) {
                console.warn(`[ZCY Executor] 未找到第${levelNum}级类目列`)
                continue
            }

            // 在该列中查找类目项
            const item = findElementByText<HTMLElement>('li, .item, .node, span, .category-item', categoryName, column)

            if (item) {
                clickElement(item)
                console.log(`[ZCY Executor] 选中第${levelNum}级类目: ${categoryName}`)
                await sleep(600) // 等待下一级加载

                // 如果有categoryIds，可以用ID进行更精确的校验
                if (template.categoryIds && template.categoryIds[level]) {
                    const expectedId = template.categoryIds[level]
                    const itemId = item.getAttribute('data-id') || item.getAttribute('data-category-id')
                    if (itemId && parseInt(itemId) !== expectedId) {
                        console.warn(`[ZCY Executor] 类目ID不匹配: 期望${expectedId}, 实际${itemId}`)
                    }
                }
            } else {
                console.warn(`[ZCY Executor] 未找到第${levelNum}级类目: ${categoryName}`)
                // 不立即返回false，继续尝试后续级别（某些情况下可能是UI延迟）
            }
        }

        console.log(`[ZCY Executor] 类目选择完成: ${categoryPath.join(' > ')}`)
        return true
    } catch (error) {
        console.error('[ZCY Executor] 选择类目失败:', error)
        return false
    }
}

// ========== 步骤4: 填写关键属性 ==========

async function step4_fillAttrs(template: ZcyPublishTemplate, product: ProductData): Promise<boolean> {
    sendStatus('info', '自动发布', '正在填写商品属性...')

    try {
        // 等待属性表单出现
        await waitFor(() =>
            document.querySelector('.attr-form, .goods-attr, .form-container, form') as HTMLElement
            , 5000)

        await sleep(500)

        // 根据模板规则填写每个属性
        for (const [fieldName, rule] of Object.entries(template.keyAttrs)) {
            const value = resolveAttrValue(rule, product)

            if (value) {
                fillInputByLabel(fieldName, value)
                await sleep(200)
            }
        }

        // 额外：尝试直接填写品牌和型号（如果模板没有指定）
        if (product.brand && !template.keyAttrs['品牌']) {
            fillInputByLabel('品牌', product.brand)
            await sleep(200)
        }

        if (product.model && !template.keyAttrs['型号']) {
            fillInputByLabel('型号', product.model)
            await sleep(200)
        }

        return true
    } catch (error) {
        console.error('[ZCY Executor] 填写属性失败:', error)
        return false
    }
}

// ========== 步骤5: 点击下一步 ==========

async function step5_clickNext(): Promise<boolean> {
    sendStatus('info', '自动发布', '正在点击下一步...')

    const nextBtn = findElementByText<HTMLButtonElement>('button', '下一步')
        || findElementByText<HTMLButtonElement>('button', '下一页')
        || document.querySelector('.btn-next, [class*="next-step"]') as HTMLButtonElement

    if (nextBtn) {
        clickElement(nextBtn)
        await sleep(500)
        return true
    }

    console.warn('[ZCY Executor] 未找到下一步按钮')
    return false
}

// ========== 主执行函数 ==========

export async function executeTemplatePublish(
    template: ZcyPublishTemplate,
    product: ProductData
): Promise<{ success: boolean; error?: string }> {
    console.log('[ZCY Executor] 开始模板发布:', template.name)

    try {
        // Step 1: 点击修改按钮
        const step1Result = await step1_clickModify()
        if (!step1Result) {
            // 可能已经在正确的页面，继续
            console.log('[ZCY Executor] 跳过步骤1')
        }

        // Step 2: 选择卖场和标项
        await sleep(500)
        await step2_selectMarket(template)

        // Step 3: 选择类目
        await sleep(500)
        await step3_selectCategory(template)

        // Step 4: 填写属性
        await sleep(500)
        await step4_fillAttrs(template, product)

        // Step 5: 点击下一步
        await sleep(500)
        const nextResult = await step5_clickNext()

        if (nextResult) {
            sendStatus('success', '第一阶段完成', '类目选择和属性填写完成', '请继续填写其他信息')
            return { success: true }
        } else {
            sendStatus('error', '操作失败', '无法点击下一步', '请手动操作')
            return { success: false, error: '无法点击下一步' }
        }

    } catch (error) {
        const msg = (error as Error).message
        sendStatus('error', '发布失败', msg)
        return { success: false, error: msg }
    }
}

// ========== 无模板时的降级执行 ==========

export async function executeWithoutTemplate(product: ProductData): Promise<{ success: boolean; error?: string }> {
    console.log('[ZCY Executor] 无模板发布，将尝试智能匹配')

    sendStatus('info', '自动发布', '未找到模板，将尝试智能匹配...', `商品: ${product.title.substring(0, 30)}...`)

    // 这里可以调用现有的 matchCategoryFromBackend 逻辑
    // 或者提示用户手动选择

    return { success: false, error: '请先创建发布模板' }
}

// ========== 导出 ==========

export { step1_clickModify, step2_selectMarket, step3_selectCategory, step4_fillAttrs, step5_clickNext }
