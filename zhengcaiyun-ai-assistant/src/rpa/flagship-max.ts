/** 
 * 旗舰 MAX + AI 最终整合版
 * 
 * 唯一入口：FlagshipMax.run()
 * 所有执行逻辑由此引擎统一调度
 */

import { AutoFillAIEngine, type ProductInfo as AutoFillProductInfo } from './autofill-ai-engine'
import { AutoFillEngineV2 } from './autofill-v2'
import { VisionBridge } from '../lib/vision-bridge'
import { fetchWithAuth } from '../utils/api'
import { KnowledgeEngine } from './knowledge-engine'

// ===================== 类型定义 =====================

export interface ScrapedData {
    title: string
    brand?: string
    model?: string
    stock?: number
    price?: number         // 市场价
    salePrice?: number     // 销售价
    specs?: Record<string, string>
    categoryPath?: string[]
    categoryName?: string
    bid?: string                // ⭐ 标项名称 (重要)
    sourceUrl?: string
    // 图片
    images?: string[]           // 主图 URL 列表
    detailImages?: string[]     // 详情图 URL 列表
    skuImages?: Record<string, string>  // SKU 图片 {规格名: URL}
    // SKU 数据
    skuSpecs?: Array<{ name: string; values: string[] }>  // SKU 规格组
    skuData?: Array<{ price?: number; stock?: number; code?: string }>  // SKU 价格库存编码
}

export interface AiCategoryResult {
    categoryPath: string[]
    brand: string
    model: string
    bid?: string
    attrs: Array<{ label: string; value: string }>
}

export interface AiPublishResult {
    requiredFields: string[]
    attrs: Array<{ label: string; value: string }>
}

export interface TaskContext {
    draftId?: string
    pageUrl: string
    scraped: ScrapedData
    licenseKey?: string
    // 异步预判结果缓存
    cachedAttributes?: Record<string, string>
}

// ===================== 日志系统 =====================
import { Logger } from "../lib/logger"

// ===================== 工具函数 =====================

const Util = {
    sleep(ms: number): Promise<void> {
        return new Promise(r => setTimeout(r, ms))
    },
    normalize(t: string | null | undefined): string {
        return (t || "").trim().replace(/[：:*＊]/g, "").replace(/\s+/g, "").toLowerCase()
    },

    // ⭐⭐ 智能表单加载检测器（基于状态判断，不写死等待时间）⭐⭐
    async waitForPublishFormReady(timeout = 60000): Promise<boolean> {
        const start = Date.now()

        return new Promise((resolve) => {
            const timer = setInterval(() => {
                const elapsed = Date.now() - start

                // 超时兜底
                if (elapsed > timeout) {
                    clearInterval(timer)
                    Logger.warn("⏰ 表单加载超时，继续执行...")
                    resolve(false)
                    return
                }

                // 1) 是否出现足够数量的字段（至少 20 个）
                const afields = document.querySelectorAll("[data-afield-id]")
                const formItems = document.querySelectorAll(".el-form-item, .doraemon-form-item")
                const totalFields = Math.max(afields.length, formItems.length)

                if (totalFields >= 20) {
                    // 2) 是否出现关键控件
                    const hasInput = document.querySelector("input[placeholder*='输入'], input[placeholder*='请输入']")
                    const hasSelect = document.querySelector(".doraemon-select, .el-select")
                    const hasCascader = document.querySelector(".doraemon-cascader-picker")
                    const hasRadio = document.querySelector(".el-radio-group, .doraemon-radio-group")

                    if (hasInput || hasSelect || hasCascader || hasRadio) {
                        clearInterval(timer)
                        Logger.log(`✅ 表单加载完成 (${Math.round(elapsed / 1000)}秒)，检测到 ${totalFields} 个字段`)
                        resolve(true)
                        return
                    }
                }

                // 每 5 秒输出一次进度
                if (elapsed % 5000 < 500) {
                    Logger.log(`⏳ 等待表单加载... (${Math.round(elapsed / 1000)}秒, 已检测 ${totalFields} 个字段)`)
                }
            }, 500)
        })
    }
}

// ===================== 页面检测器 =====================

const PageDetector = {
    isCategoryPage(url: string): boolean {
        return url.includes("/goods/category/attr/select") ||
            url.includes("/goods/select/category")
    },
    isPublishPage(url: string): boolean {
        return url.includes("/goods/publish") ||
            url.includes("/goods/edit")
    },

    /** 检测项目类型：一张网 vs 旧版标项 */
    detectProjectType(): 'yizhangwang' | 'legacy' {
        const pageText = document.body.innerText || ''
        if (pageText.includes('一张网') ||
            pageText.includes('承诺式入围') ||
            pageText.includes('"一张网"')) {
            Logger.log('📌 检测到"一张网"项目类型')
            return 'yizhangwang'
        }
        Logger.log('📌 检测到旧版标项项目类型')
        return 'legacy'
    }
}

// ===================== SUPER_SELECTOR 类目选择器 =====================

const CategorySelectorMax = {
    log(...args: any[]) {
        console.log("[SUPER_SELECTOR]", ...args)
    },

    // 获取类目列（政采云有多种布局）
    getColumns(): Element[] {
        // 尝试多种选择器
        const selectors = [
            ".category-list .doraemon-list-items",
            "ul.doraemon-list-items",
            ".category-panel ul",
            ".category-box ul",
            ".cascader-menu",
            ".category-tree ul",
            "[class*='category'] ul",
            "[class*='list-items']"
        ]

        for (const sel of selectors) {
            const cols = document.querySelectorAll(sel)
            if (cols.length >= 1) {
                this.log(`找到 ${cols.length} 个类目列 (选择器: ${sel})`)
                return Array.from(cols)
            }
        }

        this.log("⚠️ 未找到任何类目列")
        return []
    },

    getLevelItems(level: number): HTMLElement[] {
        const cols = this.getColumns()
        this.log(`Level ${level + 1}: 共 ${cols.length} 列`)

        if (!cols.length || level >= cols.length) {
            this.log(`Level ${level + 1}: 列不存在`)
            return []
        }

        // 查找该列中的所有可点击项
        const col = cols[level]
        const items = col.querySelectorAll(
            "li, .category-item, .list-item, span.category-item, [class*='item']"
        )

        // 只返回可见的元素
        const visibleItems = Array.from(items).filter(el => {
            const htmlEl = el as HTMLElement
            const rect = htmlEl.getBoundingClientRect()
            return rect.height > 0 && rect.width > 0 && htmlEl.offsetParent !== null
        }) as HTMLElement[]

        this.log(`Level ${level + 1}: 找到 ${visibleItems.length} 个可见项`)

        // 打印前5个选项供调试
        if (visibleItems.length > 0) {
            this.log(`Level ${level + 1}: 可用选项:`, visibleItems.slice(0, 5).map(el => `"${el.innerText?.trim().substring(0, 20)}"`).join(', '))
        }

        return visibleItems
    },

    findNode(level: number, name: string): HTMLElement | null {
        const items = this.getLevelItems(level)
        if (!items.length) return null

        const targetNorm = Util.normalize(name)
        this.log(`Level ${level + 1}: 搜索 "${name}" (规范化: "${targetNorm}")`)

        // ⭐⭐⭐ 只使用精确匹配，不使用模糊匹配 ⭐⭐⭐
        for (const el of items) {
            const itemText = el.innerText?.trim() || ''
            const itemNorm = Util.normalize(itemText)

            if (itemNorm === targetNorm) {
                this.log(`✓ 精确匹配: "${itemText}"`)
                return el
            }
        }

        // 精确匹配失败，尝试查找包含目标的项（但要更严格）
        for (const el of items) {
            const itemText = el.innerText?.trim() || ''
            if (!itemText) continue

            const itemNorm = Util.normalize(itemText)
            // 只在目标是完整单词时才匹配
            if (itemNorm === targetNorm || itemText === name) {
                this.log(`✓ 文本匹配: "${itemText}"`)
                return el
            }
        }

        // 打印所有可用选项供调试
        this.log(`❌ 未找到 "${name}"，可用选项:`)
        items.slice(0, 10).forEach((el, i) => {
            this.log(`   [${i}] "${el.innerText?.trim().substring(0, 30)}"`)
        })

        return null
    },

    async clickNode(el: HTMLElement): Promise<void> {
        this.log(`点击: "${el.innerText?.trim().substring(0, 30)}"`)
        el.scrollIntoView({ behavior: "smooth", block: "center" })
        await Util.sleep(150)
        el.click()
        await Util.sleep(600) // 等待下一级加载
    },

    async selectPath(path: string[]): Promise<boolean> {
        this.log("════════════════════════════════════════")
        this.log("开始类目选择:", path.join(" > "))
        this.log("════════════════════════════════════════")

        for (let level = 0; level < path.length; level++) {
            const name = path[level]
            this.log(`\nLevel ${level + 1}: 目标 "${name}"`)

            let retry = 20
            let found = false

            while (retry-- > 0 && !found) {
                const node = this.findNode(level, name)
                if (node) {
                    await this.clickNode(node)
                    found = true
                    this.log(`Level ${level + 1}: ✓ 选择成功`)
                } else {
                    this.log(`Level ${level + 1}: 未找到，等待重试... (${retry})`)
                    await Util.sleep(400)
                }
            }

            if (!found) {
                this.log(`⚠️ Level ${level + 1} 选择器失败，尝试视觉补救...`)
                const success = await VisionBridge.performTask(
                    `在第 ${level + 1} 列中点击类目: "${name}"`,
                    `这是类目选择路径的第 ${level + 1} 步，完整路径是: ${path.join(' > ')}`
                )

                if (success) {
                    found = true
                    this.log(`Level ${level + 1}: ✓ 视觉补救成功`)
                    await Util.sleep(1000) // 视觉点击后需要更长的等待
                } else {
                    this.log(`✗ 类目选择失败: "${name}"`)
                    return false
                }
            }
        }

        this.log("════════════════════════════════════════")
        this.log("✓ 类目选择完成:", path.join(" > "))
        this.log("════════════════════════════════════════")
        return true
    },

    getCurrentCategoryId(): string | null {
        // 尝试从 URL 获取
        const urlParams = new URLSearchParams(window.location.search)
        const catId = urlParams.get("categoryId") || urlParams.get("category_id")
        if (catId) return catId

        // 尝试从已经选择的最后一个节点获取
        const columns = this.getColumns()
        if (columns.length > 0) {
            const lastCol = columns[columns.length - 1]
            const activeItem = lastCol.querySelector(".is-active, .active, [class*='active']") as HTMLElement
            if (activeItem) {
                // 有些页面 ID 存在 data-id 属性中
                return activeItem.getAttribute("data-id") || activeItem.getAttribute("id") || activeItem.innerText.trim()
            }
        }
        return null
    }
}

// ===================== 旧版标项前置流程 =====================

const LegacyBidPreflow = {
    async run(targetBidName: string): Promise<boolean> {
        Logger.section("📋 阶段1: 前置流程（弹窗/标项）")
        Logger.log("目标标项:", `"${targetBidName}"`)

        // ⭐ 检测当前页面是否已经显示了正确的标项
        // 如果 URL 或页面内容已经包含目标标项，可能不需要重新选择
        const pageText = document.body.innerText || ''
        const currentBidMatch = pageText.match(/当前标项[:：]\s*(\S+)/) ||
            pageText.match(/标项名称[:：]\s*(\S+)/)

        if (currentBidMatch && currentBidMatch[1].includes(targetBidName.split('/')[0])) {
            Logger.log(`✓ 当前标项已匹配: ${currentBidMatch[1]}`)
            return true
        }

        // 检查是否有"修改"按钮，如果没有说明已经在正确的界面
        const modifyBtn = this.findButton('修改')
        if (!modifyBtn) {
            Logger.log('未找到修改按钮，尝试直接进行类目选择')
            return true
        }

        // 步骤1：打开弹窗
        modifyBtn.click()
        await Util.sleep(1000)
        Logger.log('✓ 已打开弹窗')

        // 步骤2：展开电子卖场
        await this.expandMarket()

        // 步骤3：选择标项
        await this.selectBid(targetBidName)

        // 步骤4：点击确定
        await this.clickConfirm()

        Logger.log('✓ 前置流程完成')
        return true
    },

    findButton(text: string): HTMLElement | null {
        const buttons = document.querySelectorAll('button, .el-button, [role="button"]')
        for (const btn of buttons) {
            if ((btn as HTMLElement).innerText?.includes(text)) {
                return btn as HTMLElement
            }
        }
        return null
    },

    async expandMarket(): Promise<void> {
        const expandIcons = document.querySelectorAll(
            '.el-icon-arrow-right, .el-table__expand-icon, [class*="expand"], .el-icon-plus'
        )
        for (const icon of Array.from(expandIcons)) {
            const row = icon.closest('tr, .el-table__row')
            if (row?.textContent?.includes('网上超市')) {
                (icon as HTMLElement).click()
                await Util.sleep(800)
                Logger.log('✓ 已展开电子卖场')
                return
            }
        }
        if (expandIcons.length > 0) {
            (expandIcons[0] as HTMLElement).click()
            await Util.sleep(800)
        }
    },

    async selectBid(bidName: string): Promise<void> {
        Logger.log(`选择标项: "${bidName}"`)

        // ⭐ 提取标项的简短名称（去掉斜杠后面的内容）
        const simpleBidName = bidName.split('/')[0].trim()
        Logger.log(`简化标项名称: "${simpleBidName}"`)

        // 精确匹配模式
        const exactTexts = [
            `标项名称: ${simpleBidName}`,
            `标项名称：${simpleBidName}`,
            `标项名称:${simpleBidName}`,
        ]

        // ⭐⭐⭐ 方法1: 找到精确包含标项名称的单元格 ⭐⭐⭐
        const allCells = document.querySelectorAll('td, span, div, label')
        Logger.log(`搜索 ${allCells.length} 个单元格...`)

        for (const cell of allCells) {
            const cellText = (cell as HTMLElement).innerText?.trim() || ''

            // 检查单元格文本是否精确匹配任何模式
            const matchedPattern = exactTexts.find(pattern =>
                cellText === pattern ||
                cellText.startsWith(pattern + ' ') ||
                cellText.startsWith(pattern + '\n') ||
                cellText === pattern.replace(/\s/g, '')
            )

            if (matchedPattern) {
                Logger.log(`✓ 找到精确匹配单元格: "${cellText.substring(0, 40)}..."`)

                // 向上找到包含该单元格的表格行
                const parentRow = (cell as HTMLElement).closest('tr, .el-table__row, [class*="row"]')

                if (parentRow) {
                    // 在该行中找 radio
                    const radio = parentRow.querySelector(
                        'input[type="radio"], .el-radio__input, .el-radio__inner, .el-radio, .el-radio__original'
                    ) as HTMLElement

                    if (radio) {
                        // 检查是否已选中
                        const radioContainer = radio.closest('.el-radio')
                        const isAlreadyChecked =
                            (radio as HTMLInputElement).checked ||
                            radio.classList.contains('is-checked') ||
                            radioContainer?.classList.contains('is-checked')

                        if (isAlreadyChecked) {
                            Logger.log(`标项 "${simpleBidName}" 已经是选中状态`)
                        } else {
                            Logger.log(`点击 radio...`)
                            radio.click()
                        }

                        await Util.sleep(1000)
                        Logger.log(`✅ 已选择标项: ${simpleBidName}`)
                        return
                    } else {
                        // 没找到 radio，尝试点击行本身
                        Logger.log('未找到 radio，尝试点击整行...');
                        (parentRow as HTMLElement).click()
                        await Util.sleep(1000)
                        return
                    }
                }
            }
        }

        // ⭐⭐⭐ 方法2: 备用 - 直接遍历所有 radio，检查相邻文本 ⭐⭐⭐
        Logger.log('单元格搜索失败，尝试遍历所有 radio...')
        const allRadios = document.querySelectorAll('input[type="radio"], .el-radio')

        for (const radio of allRadios) {
            const parentRow = (radio as HTMLElement).closest('tr, [class*="row"]')
            if (!parentRow) continue

            const rowText = (parentRow as HTMLElement).innerText || ''

            // 检查这一行是否包含目标标项
            const containsTarget = exactTexts.some(pattern => rowText.includes(pattern))

            if (containsTarget) {
                // 额外验证：确保这一行不包含其他标项名称
                const otherBids = ['办公用品', '办公设备', '日用百货', '计算机设备', '劳动保护用品', '灯具商品', '五金工具']
                const otherBidsInRow = otherBids.filter(bid =>
                    bid !== simpleBidName && rowText.includes(`标项名称: ${bid}`)
                )

                if (otherBidsInRow.length === 0) {
                    Logger.log(`✓ 通过 radio 找到标项行: "${rowText.substring(0, 50)}..."`)
                        ; (radio as HTMLElement).click()
                    await Util.sleep(1000)
                    Logger.log(`✅ 已选择标项: ${simpleBidName}`)
                    return
                }
            }
        }

        Logger.warn(`❌ 未找到标项: ${simpleBidName}`)
    },

    async clickConfirm(): Promise<void> {
        const confirmBtn = this.findButton('确定') || this.findButton('确认')
        if (confirmBtn) {
            confirmBtn.click()
            await Util.sleep(1500)
            Logger.log('✓ 已点击确定')
        }
    }
}

// ===================== 品牌/型号选择器 =====================

const BrandModelFiller = {
    async selectBrand(brand: string): Promise<boolean> {
        Logger.log("🏷️ 选择品牌:", `"${brand}"`)

        const brandRow = this.findFieldRow('品牌')
        if (!brandRow) {
            Logger.warn("未找到品牌字段")
            return false
        }

        const input = brandRow.querySelector('input, .el-input__inner') as HTMLInputElement
        if (!input) {
            Logger.warn("未找到品牌输入框")
            return false
        }

        // 滚动到可见区域
        input.scrollIntoView({ behavior: 'smooth', block: 'center' })
        await Util.sleep(200)

        // 点击激活输入框
        input.click()
        input.focus()
        await Util.sleep(300)

        // 清空并输入品牌名称
        input.value = ''
        this.setInputValue(input, brand)
        Logger.log(`  已输入: "${brand}"，等待下拉选项...`)
        await Util.sleep(1200)  // 等待搜索结果加载

        // 查找并点击匹配的选项
        const selected = await this.selectDropdownOption(brand)
        if (selected) {
            Logger.log(`✓ 品牌选择成功: ${brand}`)
            return true
        }

        // 如果没找到精确匹配，尝试只用英文品牌名搜索
        const englishBrand = brand.match(/[A-Za-z]+/)?.[0]
        if (englishBrand && englishBrand !== brand) {
            Logger.log(`  尝试英文品牌名: "${englishBrand}"`)
            input.value = ''
            this.setInputValue(input, englishBrand)
            await Util.sleep(1200)
            const selected2 = await this.selectDropdownOption(englishBrand)
            if (selected2) {
                Logger.log(`✓ 品牌选择成功: ${englishBrand}`)
                return true
            }
        }

        Logger.warn(`⚠️ 未找到品牌选项，保留输入值: ${brand}`)
        input.blur()
        return false
    },

    async selectModel(model: string): Promise<boolean> {
        Logger.log("📦 填写型号:", `"${model}"`)

        const modelRow = this.findFieldRow('型号')
        if (!modelRow) {
            Logger.warn("未找到型号字段")
            return false
        }

        const input = modelRow.querySelector('input, .el-input__inner') as HTMLInputElement
        if (!input) {
            Logger.warn("未找到型号输入框")
            return false
        }

        // 滚动到可见区域
        input.scrollIntoView({ behavior: 'smooth', block: 'center' })
        await Util.sleep(200)

        input.click()
        input.focus()
        await Util.sleep(300)

        // 清空并输入型号
        input.value = ''
        this.setInputValue(input, model)
        Logger.log(`  已输入: "${model}"，等待下拉选项...`)
        await Util.sleep(1200)

        const selected = await this.selectDropdownOption(model)
        if (selected) {
            Logger.log(`✓ 型号选择成功: ${model}`)
            return true
        }

        // 型号没有匹配时保留输入值即可
        Logger.log(`📝 型号无匹配选项，保留输入值: ${model}`)
        input.blur()
        return true
    },

    findFieldRow(label: string): HTMLElement | null {
        const labels = document.querySelectorAll('label, .el-form-item__label, [class*="label"]')
        for (const el of labels) {
            const text = Util.normalize((el as HTMLElement).innerText)
            if (text === Util.normalize(label) || text.includes(Util.normalize(label))) {
                const row = (el as HTMLElement).closest('.el-form-item, .form-item, tr, [class*="row"]')
                if (row) return row as HTMLElement
            }
        }
        return null
    },

    setInputValue(input: HTMLInputElement, value: string): void {
        const nativeSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
        )?.set
        if (nativeSetter) {
            nativeSetter.call(input, value)
        } else {
            input.value = value
        }
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
    },

    async selectDropdownOption(target: string): Promise<boolean> {
        Logger.log(`🔍 搜索下拉选项: "${target}"`)
        const targetNorm = Util.normalize(target)

        // 等待下拉选项出现（最多 3 秒）
        for (let wait = 0; wait < 15; wait++) {
            // 政采云的下拉选项选择器（更全面）
            const dropdownSelectors = [
                ".el-select-dropdown:not([style*='display: none'])",
                ".el-autocomplete-suggestion:not([style*='display: none'])",
                ".doraemon-select-dropdown-menu",
                ".el-scrollbar__view",
                "[class*='dropdown']:not([style*='display: none'])",
                "[class*='suggestion']:not([style*='display: none'])",
                ".el-popper[role='tooltip']"
            ]

            for (const selector of dropdownSelectors) {
                const dropdowns = document.querySelectorAll<HTMLElement>(selector)

                for (const dropdown of Array.from(dropdowns)) {
                    const rect = dropdown.getBoundingClientRect()
                    // 确保下拉框可见
                    if (rect.height === 0 || rect.width === 0) continue

                    // 查找所有选项
                    const options = dropdown.querySelectorAll<HTMLElement>(
                        "li:not(.el-select-dropdown__empty), " +
                        ".el-select-dropdown__item, " +
                        ".doraemon-select-dropdown-menu-item, " +
                        "[class*='item']:not(:empty), " +
                        "[class*='option']:not(:empty)"
                    )

                    Logger.log(`  发现 ${options.length} 个选项 (选择器: ${selector})`)

                    for (const opt of Array.from(options)) {
                        const optText = opt.innerText?.trim()
                        if (!optText || optText === '无匹配数据') continue

                        const optNorm = Util.normalize(optText)
                        const parts = optText.split('/').map(p => Util.normalize(p.trim()))

                        // 匹配逻辑：精确匹配 > 包含匹配
                        const isMatch =
                            optNorm === targetNorm ||
                            optNorm.includes(targetNorm) ||
                            targetNorm.includes(optNorm) ||
                            parts.includes(targetNorm) ||
                            parts.some(p => p.includes(targetNorm) || targetNorm.includes(p))

                        if (isMatch) {
                            Logger.log(`  ✓ 找到匹配项: "${optText}"`)
                            opt.scrollIntoView({ behavior: 'smooth', block: 'center' })
                            await Util.sleep(100)
                            opt.click()
                            await Util.sleep(300)
                            return true
                        }
                    }
                }
            }

            await Util.sleep(200)
        }

        Logger.warn(`  ✗ 未找到匹配 "${target}" 的选项`)
        return false
    }
}

// ===================== Super Engine V8（属性页智能填写引擎） =====================

// 字段语义映射
const FIELD_SEMANTIC_MAP = [
    { keywords: ["库存", "数量"], type: "stock" },
    { keywords: ["产地", "原产地"], type: "origin" },
    { keywords: ["单位", "计量单位"], type: "unit" },
    { keywords: ["是否需要安装", "是否安装"], type: "needInstall" },
    { keywords: ["售后服务", "质保", "保修"], type: "afterSale" },
    { keywords: ["链接", "来源链接", "电商平台"], type: "sourceUrl" },
    { keywords: ["商品编码", "编码", "SKU", "货号"], type: "productCode" },
    { keywords: ["品牌"], type: "brand" },
    { keywords: ["型号"], type: "model" }
]

function detectFieldType(label: string): string {
    label = (label || "").trim()
    for (const item of FIELD_SEMANTIC_MAP) {
        if (item.keywords.some(kw => label.includes(kw))) return item.type
    }
    return "unknown"
}

// 产品信息类型
interface ProductInfo {
    title?: string
    brand?: string
    model?: string
    sku?: string
    origin?: string
    unit?: string
    sourceUrl?: string
    stock?: number
    specs?: Record<string, string>
}

// 根据字段类型获取默认值
function getDefaultValueByType(type: string, product: ProductInfo): string {
    const specs = product.specs || {}
    switch (type) {
        case "stock":
            return String(product.stock || 999)
        case "origin":
            return specs['产地'] || product.origin || "中国"
        case "unit":
            return specs['计量单位'] || product.unit || "件"
        case "needInstall":
            return "否"
        case "brand":
            return product.brand || ""
        case "model":
            return product.model || product.sku || ""
        case "sourceUrl":
            return product.sourceUrl || ""
        case "productCode":
            return specs['商品编码'] || specs['货号'] || product.model || product.sku || ""
        case "afterSale":
            return "本产品执行国家三包政策，如有质量问题请联系商家处理。"
        default:
            return ""
    }
}

const SuperEngineV8 = {
    log(...args: any[]) {
        console.log("[SUPER_ENGINE]", ...args)
    },

    // 扫描属性字段
    scanAttributeFields(): Array<{ label: string; input: HTMLElement; type: string }> {
        const rows = document.querySelectorAll(
            ".doraemon-form-item, .el-form-item, .attr-row, .goods-attr-item"
        )

        this.log("扫描字段行数量：", rows.length)

        const fields: Array<{ label: string; input: HTMLElement; type: string }> = []

        rows.forEach(row => {
            const labelEl =
                row.querySelector(".el-form-item__label") ||
                row.querySelector(".doraemon-form-label") ||
                row.querySelector("label")

            const label = labelEl ? (labelEl as HTMLElement).innerText.trim() : ""
            if (!label) return

            const input =
                row.querySelector("input") ||
                row.querySelector("textarea") ||
                row.querySelector("select")

            if (!input) return

            const type = detectFieldType(label)
            fields.push({ label, input: input as HTMLElement, type })
        })

        this.log("识别到可处理字段：", fields.length)
        return fields
    },

    // 填写单个字段
    async fillField(field: { label: string; input: HTMLElement; type: string }, product: ProductInfo): Promise<boolean> {
        const { label, input, type } = field

        let value = getDefaultValueByType(type, product)

        // 从 specs 中获取额外的值
        const specs = product.specs || {}
        if (!value && specs[label]) {
            value = specs[label]
        }

        if (!value) {
            this.log("跳过字段（无可用值）：", label)
            return false
        }

        const tagName = input.tagName.toUpperCase()

        // 写入 input / textarea
        if (tagName === "INPUT" || tagName === "TEXTAREA") {
            const inputEl = input as HTMLInputElement
            inputEl.focus()

            // 使用 native setter
            const nativeSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype, 'value'
            )?.set
            if (nativeSetter) {
                nativeSetter.call(inputEl, value)
            } else {
                inputEl.value = value
            }

            inputEl.dispatchEvent(new Event("input", { bubbles: true }))
            inputEl.dispatchEvent(new Event("change", { bubbles: true }))
            this.log(`✅ 填写字段：${label} = ${value}`)
            return true
        }

        // 选择 select 下拉
        if (tagName === "SELECT") {
            const selectEl = input as HTMLSelectElement
            const opts = Array.from(selectEl.options)
            const match = opts.find(o =>
                o.text.trim() === value ||
                o.value.trim() === value ||
                o.text.includes(value)
            )
            if (match) {
                selectEl.value = match.value
                selectEl.dispatchEvent(new Event("change", { bubbles: true }))
                this.log(`✅ 选择下拉：${label} = ${match.text}`)
                return true
            }
            this.log(`❌ 下拉字段未匹配：${label}（值：${value}）`)
            return false
        }

        this.log(`⚠️ 未知控件类型，跳过字段：${label}`)
        return false
    },

    // 主引擎入口
    async run(product: ProductInfo): Promise<{ success: number; fail: number }> {
        this.log("🚀 Super Engine V8 启动")
        this.log("产品信息：", product.title, "| 品牌:", product.brand, "| 型号:", product.model)

        const fields = this.scanAttributeFields()
        if (!fields.length) {
            this.log("未识别到任何字段，请检查选择器。")
            return { success: 0, fail: 0 }
        }

        let success = 0
        let fail = 0

        for (const f of fields) {
            try {
                const ok = await this.fillField(f, product)
                if (ok) success++
                else fail++
                await Util.sleep(100)
            } catch (err) {
                fail++
                this.log("字段填写异常：", f.label, err)
            }
        }

        this.log("🎉 Super Engine V8 完成：成功", success, "失败", fail)
        return { success, fail }
    },

    // 兼容旧接口
    async runOnAttrPage(payload: { scraped: ScrapedData; ai: AiCategoryResult }): Promise<void> {
        const product: ProductInfo = {
            title: payload.scraped.title,
            brand: payload.scraped.brand,
            model: payload.scraped.model,
            sourceUrl: payload.scraped.sourceUrl,
            stock: payload.scraped.stock,
            specs: payload.scraped.specs
        }
        await this.run(product)
    },

    async runOnPublishPage(payload: { scraped: ScrapedData; ai: AiPublishResult }): Promise<void> {
        const product: ProductInfo = {
            title: payload.scraped.title,
            brand: payload.scraped.brand,
            model: payload.scraped.model,
            sourceUrl: payload.scraped.sourceUrl,
            stock: payload.scraped.stock,
            specs: payload.scraped.specs
        }
        await this.run(product)
    }
}

    // 暴露到 window
    ; (window as any).SuperEngineV8 = SuperEngineV8

// ===================== 按钮点击器 =====================

const Clicker = {
    async clickButton(label: string): Promise<boolean> {
        Logger.log("点击按钮:", label)
        const selectors = ["button", ".el-button", ".doraemon-btn span", "[role='button']"]

        for (const sel of selectors) {
            const nodes = document.querySelectorAll<HTMLElement>(sel)
            for (const node of Array.from(nodes)) {
                const txt = node.innerText?.trim()
                if (!txt) continue
                if (txt === label || txt.includes(label)) {
                    const btn = sel.endsWith("span") && node.parentElement
                        ? node.parentElement as HTMLElement
                        : node
                    btn.scrollIntoView({ behavior: "smooth", block: "center" })
                    await Util.sleep(100)
                    btn.click()
                    await Util.sleep(500)
                    Logger.log("✓ 按钮已点击:", txt)
                    return true
                }
            }
        }
        Logger.warn("⚠️ 未找到按钮:", label)
        return false
    }
}

// ===================== 旗舰 MAX 主流程 =====================

export const FlagshipMax = {
    async run(ctx: TaskContext): Promise<void> {
        (window as any).scraped = ctx.scraped;
        Logger.section("🚀 RPA 旗舰 MAX 引擎启动")
        Logger.log("当前页面:", ctx.pageUrl)
        Logger.log("草稿标题:", ctx.scraped.title)
        try {
            if (PageDetector.isCategoryPage(ctx.pageUrl)) {
                await this.runOnCategoryPage(ctx)
            } else if (PageDetector.isPublishPage(ctx.pageUrl)) {
                await this.runOnPublishPage(ctx)
            }
        } catch (error) {
            Logger.error("执行异常:", error)
        }
    },

    async runOnCategoryPage(ctx: TaskContext): Promise<void> {
        Logger.log("📍 runOnCategoryPage 开始")

        const projectType = PageDetector.detectProjectType()
        Logger.log("📍 项目类型:", projectType)

        // 1. 初始化基础状态
        const ai: AiCategoryResult = {
            categoryPath: ctx.scraped.categoryPath || [],
            brand: ctx.scraped.brand || '',
            model: ctx.scraped.model || '',
            bid: ctx.scraped.bid || ctx.scraped.categoryPath?.[0] || '办公设备',
            attrs: []
        }

        Logger.log("📍 类目路径:", ai.categoryPath)
        Logger.log("📍 标项(Bid):", ai.bid)
        Logger.log("📍 品牌:", ai.brand, "型号:", ai.model)

        if (projectType === 'legacy') {
            await LegacyBidPreflow.run(ai.bid)
        }

        Logger.log("📍 开始选择类目...")
        const catOk = await CategorySelectorMax.selectPath(ai.categoryPath)
        Logger.log("📍 类目选择结果:", catOk)

        if (!catOk) {
            Logger.warn("❌ 类目选择失败，停止执行")
            return
        }

        // ⭐ 极致提速：异步预判机制
        // 在类目确认后，立即去服务器查找是否有该商品的填写记录
        try {
            const categoryId = CategorySelectorMax.getCurrentCategoryId();
            if (categoryId && ai.brand && ai.model) {
                Logger.log(`🔍 [提速预判] 正在检查记录: ${ai.brand} / ${ai.model} ...`)
                const knowledge = await KnowledgeEngine.queryProductKnowledge(categoryId, ai.brand, ai.model);
                if (knowledge) {
                    ctx.cachedAttributes = knowledge;
                    Logger.log("🚀 [提速预判] 发现历史记录，进入发布页后将开启 [RPA 闪速模式]")
                } else {
                    Logger.log("ℹ️ [提速预判] 无历史记录，进入发布页后将开启 [AI 探索模式]")
                }
            }
        } catch (e) {
            Logger.warn("[提速预判] 异常:", e)
        }

        await Util.sleep(2000)

        // ⚠️ 重要：判断是否进入真正的"属性填写页"（发布页）
        // 类目选择页也有 .doraemon-form-item 等元素，不能仅靠这些判断
        // 必须使用 URL 作为主要判断依据
        const isRealAttrPage = () => {
            const path = location.pathname;
            const search = location.search;

            // 核心判断：URL 包含 /goods/publish
            if (path.includes("/goods/publish")) {
                return true;
            }

            // 备用判断：URL 包含 categoryId 参数 + 有大量表单项
            if (search.includes("categoryId=")) {
                const formItems = document.querySelectorAll('.doraemon-form-item, .el-form-item');
                // 发布页通常有很多表单项（超过20个），而类目选择页只有品牌/型号两个
                if (formItems.length > 15) {
                    return true;
                }
            }

            return false;
        }
        Logger.log("📍 当前 pathname:", location.pathname)

        if (ai.brand) {
            Logger.log("📍 填写品牌:", ai.brand)
            await BrandModelFiller.selectBrand(ai.brand)
        }
        if (ai.model) {
            Logger.log("📍 填写型号:", ai.model)
            await BrandModelFiller.selectModel(ai.model)
        }

        // ⭐ 关键修复：品牌型号填写后，必须点击"下一步"进入发布页
        let clickCount = 0
        const maxClicks = 5

        // 先等待一下让页面稳定
        await Util.sleep(1000)

        while (!isRealAttrPage() && clickCount < maxClicks) {
            Logger.log("📍 点击下一步 (", clickCount + 1, "/", maxClicks, ")")
            const clicked = await Clicker.clickButton("下一步")
            if (!clicked) {
                Logger.warn("⚠️ 未找到下一步按钮，尝试其他方式...")
                // 尝试直接查找按钮
                const nextBtn = document.querySelector('button.doraemon-btn-primary, .btn-next, [class*="next"]') as HTMLElement;
                if (nextBtn && nextBtn.innerText.includes('下一步')) {
                    nextBtn.click();
                }
            }
            await Util.sleep(2500)
            clickCount++
            Logger.log("📍 点击后 pathname:", location.pathname, "search:", location.search)
            if (isRealAttrPage()) break
        }

        if (!isRealAttrPage()) {
            Logger.warn("❌ 未进入属性编辑页，尝试视觉补救点击[下一步]")
            const moved = await VisionBridge.performTask(
                "点击页面上的蓝色[下一步]按钮",
                "当前处于类目确认页，由于常规脚本无法进到下一页，需要通过视觉寻找下一步按钮进行跳转"
            )

            if (moved) {
                await Util.sleep(3000)
                if (!isRealAttrPage()) {
                    Logger.error("❌ 视觉补救后仍未进入属性页，停止执行")
                    return
                }
            } else {
                Logger.error("❌ 未进入属性编辑页，且视觉补救失败，停止执行")
                return
            }
        }

        Logger.log("⏳ 等待表单加载...")
        await Util.sleep(3000)
        await this.fillPublishPage(ctx)
    },

    /**
     * 进入发布页后的核心填写逻辑
     * 实现一键填表、上传主图、详情图、SKU等
     */
    async fillPublishPage(ctx: TaskContext): Promise<void> {
        (window as any).scraped = ctx.scraped;
        Logger.log("⏳ 等待表单加载...")
        await Util.sleep(3000)
        Logger.log("✅ 开始填写发布信息")

        let imgs = ctx.scraped.images || []
        Logger.log("📸 图片数组:", imgs.length, "张")
        if (imgs.length > 15) imgs = imgs.slice(0, 15)

        const productInfo: AutoFillProductInfo = {
            title: ctx.scraped.title,
            brand: ctx.scraped.brand,
            model: ctx.scraped.model,
            sku: ctx.scraped.model,
            sourceUrl: ctx.scraped.sourceUrl,
            unit: ctx.scraped.specs?.['计量单位'],
            stock: ctx.scraped.stock,
            price: ctx.scraped.price,
            specs: ctx.scraped.specs
        }

        // 1️⃣ 一键上传全部图片 (先行，且必须物理隔离)
        // 理由：图片上传是最高失败率模块 (JD 404、切图失效)，绝不允许其阻塞主流程
        try {
            Logger.log("📸 步骤1: 启动图片上传模块 [隔离运行]...")

            // 构造图片列表
            const imgs = ctx.scraped.images || [];
            const detailImgs = ctx.scraped.detailImages || []
            const finalDetailImages = detailImgs.length > 0 ? detailImgs : imgs;

            const { mainCount, detailCount } = await AutoFillAIEngine.uploadAllImages(imgs, finalDetailImages);
            Logger.log(`[IMG] 图片上传结束: 主图 ${mainCount}, 详情图 ${detailCount}`);

            // 附件图片 (SKU)
            if (ctx.scraped.skuImages && Object.keys(ctx.scraped.skuImages).length) {
                await AutoFillAIEngine.uploadSKUImages(ctx.scraped.skuImages);
            }
        } catch (e) {
            Logger.warn("⚠️ [IMG] 图片上传模块异常，已自动熔断隔离，主流程继续执行。", e);
        }

        // ⭐ 关键：等待 DOM 稳定 (图片弹窗关闭后需要呼吸时间)
        await Util.sleep(1500);

        // 2️⃣ 填写表单属性 (V2 引擎启动)
        Logger.log("═══════════════════════════════════════════════════════")
        Logger.log("📝 步骤2: 🔥🔥🔥 V2 引擎即将启动 🔥🔥🔥")
        Logger.log("═══════════════════════════════════════════════════════")

        // 销售价默认策略：如果未采集到销售价，使用市场价
        const finalSalePrice = ctx.scraped.salePrice?.toString() || ctx.scraped.price?.toString();

        const productDataV2 = {
            title: ctx.scraped.title,
            brand: ctx.scraped.brand,
            model: ctx.scraped.model,
            origin: '中国',
            manufacturer: ctx.scraped.brand,
            platform_link: ctx.scraped.sourceUrl,
            unit: ctx.scraped.specs?.['计量单位'] || '件',
            stock: ctx.scraped.stock?.toString() || '9999',
            price: ctx.scraped.price?.toString(),
            salePrice: finalSalePrice,  // 销售价（默认使用市场价）
            warranty: '12个月',
            is_sme_product: '否' as const,
            is_energy_saving: '否' as const,
            is_env_certified: '否' as const,
            specs: ctx.scraped.specs
        };

        const v2Result = await AutoFillEngineV2.run(productDataV2);
        Logger.log("═══════════════════════════════════════════════════════")
        Logger.log("✅ V2 引擎执行完毕", {
            ok: v2Result.success,
            filled: v2Result.filledCount,
            failed: v2Result.failedCount,
            list: v2Result.failedFields
        });
        Logger.log("═══════════════════════════════════════════════════════")

        // 3️⃣ SKU 规格与数据 (放在最后，因为依赖表单选项生成)
        if (ctx.scraped.skuSpecs?.length) {
            Logger.log("🧩 步骤3: 填写 SKU 规格...")
            await AutoFillAIEngine.fillSkuSpecs(ctx.scraped.skuSpecs)
        }
        if (ctx.scraped.skuData?.length) {
            Logger.log("🧩 步骤4: 填写 SKU 数据...")
            await AutoFillAIEngine.fillSKUData(ctx.scraped.skuData)
        }

        Logger.section("✅ 旗舰 MAX：全部信息填写完成")
    },

    async runOnPublishPage(ctx: TaskContext): Promise<void> {
        await this.fillPublishPage(ctx)
    }
}

    // 暴露到 window，方便调试
    ; (window as any).FlagshipMax = FlagshipMax
    ; (window as any).Logger_MAX = Logger

    // 暴露内部模块到 window，供调度中心调用
    ; (window as any).LegacyBidPreflow = LegacyBidPreflow
    ; (window as any).CategorySelectorMax = CategorySelectorMax
    ; (window as any).BrandModelFiller = BrandModelFiller
    ; (window as any).SuperEngineV8 = SuperEngineV8
    ; (window as any).Clicker = Clicker
    ; (window as any).PageDetector = PageDetector

    // 暴露 V2 引擎（已通过静态导入）
    ; (window as any).AutoFillEngineV2 = AutoFillEngineV2

