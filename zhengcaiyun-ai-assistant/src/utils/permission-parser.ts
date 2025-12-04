/**
 * Permission Parser - 从政采云DOM解析商家开通的一级类目
 */

/**
 * 解析"选择上架的电子卖场"弹窗中的标项列表
 * @returns 商家开通的一级类目名称列表
 */
export function parseAllowedRootCategories(): string[] {
    const roots: string[] = []

    // 方式1: 从弹窗表格中解析
    const tableRows = document.querySelectorAll('table tbody tr, .ant-table-tbody tr, [class*="table"] tr')
    for (const row of tableRows) {
        // 查找标项名称列
        const cells = row.querySelectorAll('td')
        for (const cell of cells) {
            const text = cell.textContent?.trim()
            if (text && isValidCategoryName(text)) {
                roots.push(text)
            }
        }
    }

    // 方式2: 从列表中解析
    if (roots.length === 0) {
        const listItems = document.querySelectorAll('li, [class*="list-item"], [class*="category-item"]')
        for (const item of listItems) {
            const text = item.textContent?.trim()
            if (text && isValidCategoryName(text)) {
                roots.push(text)
            }
        }
    }

    // 方式3: 从弹窗内容中解析
    if (roots.length === 0) {
        const modal = document.querySelector('.ant-modal, [class*="modal"], [class*="dialog"]')
        if (modal) {
            const text = modal.textContent || ''
            const matches = text.match(/(办公用品|办公设备|日用百货|计算机设备|劳动保护用品|灯具商品|五金工具|家具|文化用品|电气设备|环卫清洁设备|专用设备|通用设备)/g)
            if (matches) {
                roots.push(...new Set(matches))
            }
        }
    }

    // 去重
    const unique = [...new Set(roots)]
    console.log('[Permission Parser] 解析到的一级类目:', unique)
    return unique
}

/**
 * 从类目选择页面解析左侧的一级类目列表
 */
export function parseCategoryListFromPage(): string[] {
    const roots: string[] = []

    // 查找类目列表容器
    const selectors = [
        '.category-list li',
        '.category-level-1 li',
        '[class*="category"] li',
        '.tree-node-level-1',
        '[data-level="1"]'
    ]

    for (const selector of selectors) {
        const items = document.querySelectorAll(selector)
        if (items.length > 0) {
            for (const item of items) {
                const text = item.textContent?.trim().split('\n')[0].trim()
                if (text && isValidCategoryName(text)) {
                    roots.push(text)
                }
            }
            break
        }
    }

    // 兜底：查找所有看起来像类目的文本
    if (roots.length === 0) {
        const allElements = document.querySelectorAll('span, div, a')
        for (const el of allElements) {
            const text = el.textContent?.trim()
            if (text && isValidCategoryName(text) && !el.closest('header') && !el.closest('nav')) {
                roots.push(text)
            }
        }
    }

    const unique = [...new Set(roots)]
    console.log('[Permission Parser] 页面类目列表:', unique)
    return unique
}

/**
 * 检查是否为有效的类目名称
 */
function isValidCategoryName(text: string): boolean {
    // 排除无效文本
    if (!text || text.length < 2 || text.length > 20) return false
    if (/^[\d\.]+$/.test(text)) return false // 纯数字
    if (/选择|确定|取消|下一步|保存|提交/.test(text)) return false // 按钮文本
    if (/标题|品牌|型号|价格|库存/.test(text)) return false // 表单标签

    // 常见的一级类目关键词
    const validPatterns = [
        '办公', '设备', '用品', '百货', '计算机', '电脑',
        '灯具', '五金', '工具', '家具', '劳保', '防护',
        '文化', '电气', '环卫', '清洁', '专用', '通用',
        '橡胶', '塑料', '金属', '纺织', '化工', '建材'
    ]

    return validPatterns.some(p => text.includes(p))
}

/**
 * 等待弹窗出现并解析
 */
export function waitForModalAndParse(timeout = 5000): Promise<string[]> {
    return new Promise((resolve) => {
        const startTime = Date.now()

        const check = () => {
            const modal = document.querySelector('.ant-modal, [class*="modal"], [class*="dialog"]')
            if (modal && modal.textContent && modal.textContent.length > 50) {
                const roots = parseAllowedRootCategories()
                if (roots.length > 0) {
                    resolve(roots)
                    return
                }
            }

            if (Date.now() - startTime < timeout) {
                setTimeout(check, 200)
            } else {
                resolve([])
            }
        }

        check()
    })
}
