/************************************************************
 * ZCY Super Engine · AI + RPA 超级旗舰版
 * 目标：统一的表单引擎，AI只负责语义，引擎负责DOM操作
 ************************************************************/

// --------- 1. 数据结构定义 --------------------------------

/** 抓取结果（采集的商品数据） */
export interface ScrapedProduct {
    title: string
    brand?: string
    model?: string
    skuCode?: string
    originUrl?: string
    price?: number
    stock?: number
    images?: string[]
    detailHtml?: string
    specs?: Record<string, string>   // 参数表：{ "品牌": "得力", "货号": "33302S" ... }
}

/** AI 总决策结果 */
export interface AiDecision {
    categoryPath: string[]          // ["办公设备","点钞机/收款机及配件","点钞机"]
    categoryName?: string           // 末级类目名
    // 语义字段：不依赖页面、只描述"业务含义"
    semanticFields: Record<string, any>
    // 图片 / 详情
    mainImages?: string[]
    detailImages?: string[]
    detailHtml?: string
}

/** 单个字段的"业务定义" */
export interface FieldSchema {
    key: string                     // engine 内部 key
    label: string                   // 页面常见中文名
    altLabels?: string[]            // 其它可能 label
    type: "input" | "textarea" | "select" | "radio" | "checkbox" | "number" | "image" | "richtext" | "search-select"
    required?: boolean
    defaultValue?: any              // 默认值
    // 从 AI 语义字段里取值的方法
    valueFrom?: (semantic: Record<string, any>, product: ScrapedProduct) => any
}

/** 页面上的运行时绑定结果 */
export interface FieldBinding {
    schema: FieldSchema
    element: HTMLElement
    fill: (value: any) => Promise<boolean>
}

// --------- 2. 全局字段配置表 -----------------

/** 通用字段定义（适用于大多数类目） */
export const CommonFields: FieldSchema[] = [
    {
        key: "brand",
        label: "品牌",
        altLabels: ["品牌名称", "商品品牌"],
        type: "search-select",
        required: true,
        valueFrom: (s, p) => s.brand ?? p.brand ?? p.specs?.["品牌"],
    },
    {
        key: "model",
        label: "型号",
        altLabels: ["商品型号", "规格型号"],
        type: "search-select",
        required: true,
        valueFrom: (s, p) => s.model ?? p.model ?? p.specs?.["型号"] ?? p.specs?.["商品型号"],
    },
    {
        key: "stock",
        label: "库存",
        altLabels: ["库存数量", "可售数量"],
        type: "number",
        required: true,
        defaultValue: 999,
        valueFrom: (s, p) => s.stock ?? p.stock ?? 999,
    },
    {
        key: "price",
        label: "供价",
        altLabels: ["售价", "销售价", "单价", "价格"],
        type: "number",
        required: true,
        valueFrom: (s, p) => s.price ?? p.price,
    },
    {
        key: "unit",
        label: "计量单位",
        altLabels: ["单位", "销售单位", "基本单位"],
        type: "select",
        defaultValue: "台",
        valueFrom: (s) => s.unit ?? "台",
    },
    {
        key: "originPlace",
        label: "产地",
        altLabels: ["产地(国别)", "生产产地", "产地省市区", "原产地"],
        type: "input",
        defaultValue: "浙江省宁波市宁海县",
        valueFrom: (s, p) => s.originPlace ?? p.specs?.["产地"] ?? "浙江省宁波市宁海县",
    },
    {
        key: "needInstall",
        label: "是否需要安装",
        altLabels: ["需要安装", "安装服务"],
        type: "select",
        defaultValue: "否",
        valueFrom: () => "否",
    },
    {
        key: "overheatProtect",
        label: "是否支持过热保护",
        altLabels: ["过热保护", "支持过热保护"],
        type: "select",
        defaultValue: "否",
        valueFrom: () => "否",
    },
    {
        key: "afterService",
        label: "售后服务",
        altLabels: ["售后", "售后保障"],
        type: "input",
        defaultValue: "全国联保",
        valueFrom: () => "全国联保",
    },
    {
        key: "jdLink",
        label: "电商平台链接",
        altLabels: ["电商链接", "商品链接", "原链接", "来源链接"],
        type: "input",
        valueFrom: (s, p) => s.jdLink ?? s.sourceUrl ?? p.originUrl,
    },
    {
        key: "goodsCode",
        label: "货号",
        altLabels: ["商品货号"],
        type: "input",
        valueFrom: (s, p) => s.goodsCode ?? p.skuCode ?? p.specs?.["货号"],
    },
    {
        key: "productCode",
        label: "商品编码",
        altLabels: ["商品编号"],
        type: "input",
        valueFrom: (s, p) => s.productCode ?? p.specs?.["商品编码"] ?? p.specs?.["商品编号"],
    },
    {
        key: "manufacturer",
        label: "生产厂商",
        altLabels: ["生产商", "制造商", "厂商", "厂家"],
        type: "input",
        valueFrom: (s, p) => s.manufacturer ?? p.specs?.["生产厂商"] ?? p.specs?.["厂家"],
    },
]

/** 类目特定字段扩展 */
const CategorySpecificFields: Record<string, FieldSchema[]> = {
    "点钞机": [
        { key: "detectMethod", label: "鉴伪方式", type: "input", valueFrom: (s, p) => s.detectMethod ?? p.specs?.["鉴伪方式"] },
    ],
    "保险柜": [
        { key: "lockType", label: "锁具类型", type: "select", valueFrom: (s, p) => s.lockType ?? p.specs?.["锁具类型"] },
    ],
    "碎纸机": [
        { key: "shredType", label: "碎纸方式", type: "select", valueFrom: (s, p) => s.shredType ?? p.specs?.["碎纸方式"] },
    ],
}

/** 根据类目解析字段配置 */
export function resolveFieldSchema(decision: AiDecision): FieldSchema[] {
    const categoryName = decision.categoryName || decision.categoryPath[decision.categoryPath.length - 1] || ""

    // 通用字段 + 类目特定字段
    let fields = [...CommonFields]

    for (const [key, specificFields] of Object.entries(CategorySpecificFields)) {
        if (categoryName.includes(key)) {
            fields = [...fields, ...specificFields]
            break
        }
    }

    return fields
}

// --------- 3. 核心 DOM 工具层 ----------------------------------

export const DomUtil = {
    log(...args: any[]) {
        console.log("[SUPER ENGINE]", ...args)
    },

    sleep(ms: number) {
        return new Promise((r) => setTimeout(r, ms))
    },

    normalizeLabel(t: string | null | undefined): string {
        return t?.trim().replace(/[\s：:*＊]/g, "") ?? ""
    },

    /** 根据 label 文本在表单中找"那一行" */
    findFormRowByLabel(label: string, altLabels: string[] = []): HTMLElement | null {
        const targetNames = [label, ...altLabels].map((name) => this.normalizeLabel(name))

        // 更全面的标签选择器
        const labelSelectors = [
            ".el-form-item__label",
            "label",
            ".doraemon-form-item__label",
            ".doraemon-form-item-label",
            "th",
            "td:first-child",
            "[class*='label']",
        ]

        const labelNodes = document.querySelectorAll<HTMLElement>(labelSelectors.join(", "))

        for (const node of Array.from(labelNodes)) {
            const txt = this.normalizeLabel(node.innerText)
            if (!txt || txt.length > 20) continue

            // 检查是否匹配任何目标名称
            const isMatch = targetNames.some(target =>
                txt === target || txt.includes(target) || target.includes(txt)
            )

            if (!isMatch) continue

            // 取包含整个控件的行
            const rowSelectors = [
                ".el-form-item",
                ".form-item",
                "tr",
                ".doraemon-form-item",
                "[class*='form-group']",
                "[class*='row']",
            ]

            let row: HTMLElement | null = null
            for (const sel of rowSelectors) {
                row = node.closest(sel) as HTMLElement
                if (row) break
            }

            if (!row) row = node.parentElement?.parentElement as HTMLElement

            if (row) {
                this.log(`📍 找到字段 "${label}":`, row.className.substring(0, 50))
                return row
            }
        }

        return null
    },

    /** 使用 nativeInputValueSetter 设置输入框值 */
    setInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
            'value'
        )?.set

        if (nativeInputValueSetter) {
            nativeInputValueSetter.call(input, value)
        } else {
            input.value = value
        }

        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
        input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }))
    },

    /** 在一行里找适合的控件并返回填充函数 */
    buildFiller(schema: FieldSchema, row: HTMLElement): ((value: any) => Promise<boolean>) | null {
        switch (schema.type) {
            case "input":
            case "number": {
                const input = row.querySelector<HTMLInputElement>(
                    "input:not([type='radio']):not([type='checkbox']):not([readonly]), .el-input__inner:not([readonly])"
                )
                if (!input) return null

                return async (val: any) => {
                    const v = String(val ?? "").trim()
                    if (!v) return false

                    input.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    await this.sleep(100)
                    input.focus()
                    input.click()
                    this.setInputValue(input, v)
                    input.blur()
                    return true
                }
            }

            case "textarea": {
                const ta = row.querySelector<HTMLTextAreaElement>("textarea")
                if (!ta) return null

                return async (val: any) => {
                    const v = String(val ?? "").trim()
                    if (!v) return false

                    ta.focus()
                    this.setInputValue(ta, v)
                    ta.blur()
                    return true
                }
            }

            case "search-select": {
                // 品牌/型号这种带搜索的下拉
                const input = row.querySelector<HTMLInputElement>("input, .el-input__inner")
                if (!input) return null

                return async (val: any) => {
                    const text = String(val ?? "").trim()
                    if (!text) return false

                    input.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    await this.sleep(100)
                    input.focus()
                    input.click()

                    // 清空并输入
                    input.value = ''
                    this.setInputValue(input, text)

                    // 等待下拉出现
                    await this.sleep(600)

                    // 查找匹配的选项
                    const dropdowns = document.querySelectorAll<HTMLElement>(
                        ".el-select-dropdown, .el-autocomplete-suggestion, .el-scrollbar, [class*='dropdown'], [class*='suggestion']"
                    )

                    for (const dropdown of Array.from(dropdowns)) {
                        const rect = dropdown.getBoundingClientRect()
                        if (rect.height === 0 || rect.width === 0) continue

                        const options = dropdown.querySelectorAll<HTMLElement>("li, [class*='item'], [class*='option']")
                        const targetNorm = this.normalizeLabel(text)

                        for (const opt of Array.from(options)) {
                            const optText = opt.innerText?.trim()
                            if (!optText) continue

                            const norm = this.normalizeLabel(optText)
                            // 检查品牌格式如 "虎牌/TIGER"
                            const parts = optText.split('/').map(p => this.normalizeLabel(p))

                            if (norm === targetNorm || norm.includes(targetNorm) || parts.includes(targetNorm)) {
                                this.log(`  → 选择: "${optText}"`)
                                opt.click()
                                await this.sleep(200)
                                return true
                            }
                        }
                    }

                    // 没有匹配的选项，直接使用输入值
                    this.log(`  📝 无匹配选项，使用输入值: "${text}"`)
                    input.blur()
                    return true
                }
            }

            case "select": {
                // 普通下拉框
                const trigger = row.querySelector<HTMLElement>(
                    ".el-select, .doraemon-select, [role='combobox'], input[readonly]"
                )
                if (!trigger) return null

                return async (val: any) => {
                    const text = String(val ?? "").trim()
                    if (!text) return false

                    trigger.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    await this.sleep(100)
                    trigger.click()
                    await this.sleep(300)

                    // 查找下拉面板
                    const panels = document.querySelectorAll<HTMLElement>(
                        ".el-select-dropdown, .doraemon-select-dropdown, .el-scrollbar, .el-popper"
                    )

                    const targetNorm = this.normalizeLabel(text)
                    const valueMap: Record<string, string[]> = {
                        '否': ['否', '不需要', 'no', '无'],
                        '是': ['是', '需要', 'yes', '有'],
                    }
                    const matchTargets = [text, ...(valueMap[text] || [])]

                    for (const panel of Array.from(panels)) {
                        const rect = panel.getBoundingClientRect()
                        if (rect.height === 0 || rect.width === 0) continue

                        const options = panel.querySelectorAll<HTMLElement>(".el-select-dropdown__item, li, [class*='option']")

                        for (const opt of Array.from(options)) {
                            const optText = opt.innerText?.trim()
                            if (!optText) continue

                            const norm = this.normalizeLabel(optText)

                            for (const target of matchTargets) {
                                const targetN = this.normalizeLabel(target)
                                if (norm === targetN || norm.includes(targetN)) {
                                    this.log(`  → 选择: "${optText}"`)
                                    opt.click()
                                    await this.sleep(200)
                                    return true
                                }
                            }
                        }
                    }

                    document.body.click()
                    return false
                }
            }

            case "radio": {
                const radios = row.querySelectorAll<HTMLElement>(
                    ".el-radio, .doraemon-radio, label.el-radio, [type='radio']"
                )
                if (!radios.length) return null

                return async (val: any) => {
                    const text = String(val ?? "否").trim()
                    const normTarget = this.normalizeLabel(text)

                    for (const r of Array.from(radios)) {
                        const norm = this.normalizeLabel(r.innerText)
                        if (norm === normTarget || norm.includes(normTarget)) {
                            (r as HTMLElement).click()
                            await this.sleep(100)
                            return true
                        }
                    }
                    return false
                }
            }

            case "checkbox": {
                const checkboxes = row.querySelectorAll<HTMLElement>(
                    ".el-checkbox, .doraemon-checkbox, [type='checkbox']"
                )
                if (!checkboxes.length) return null

                return async (val: any) => {
                    const text = String(val ?? "").trim()
                    const normTarget = this.normalizeLabel(text)

                    for (const cb of Array.from(checkboxes)) {
                        const norm = this.normalizeLabel(cb.innerText)
                        if (norm === normTarget || norm.includes(normTarget) || !text) {
                            (cb as HTMLElement).click()
                            await this.sleep(100)
                            return true
                        }
                    }
                    return false
                }
            }

            default:
                return null
        }
    },
}

// --------- 4. 表单引擎核心类 -------------------------------

export class ZcyFormEngine {
    scraped: ScrapedProduct
    decision: AiDecision
    fieldSchemas: FieldSchema[] = []
    bindings: FieldBinding[] = []

    constructor(scraped: ScrapedProduct, decision: AiDecision) {
        this.scraped = scraped
        this.decision = decision
        this.fieldSchemas = resolveFieldSchema(decision)
    }

    /** 步骤 1：为每个 FieldSchema 在页面上建立绑定 */
    buildBindings() {
        this.bindings = []

        for (const schema of this.fieldSchemas) {
            const row = DomUtil.findFormRowByLabel(schema.label, schema.altLabels ?? [])
            if (!row) {
                DomUtil.log(`⚠️ 未找到字段: ${schema.label}`)
                continue
            }

            const filler = DomUtil.buildFiller(schema, row)
            if (!filler) {
                DomUtil.log(`⚠️ 无法构造填充器: ${schema.label} (类型:${schema.type})`)
                continue
            }

            this.bindings.push({
                schema,
                element: row,
                fill: filler,
            })
        }

        DomUtil.log(`📋 字段绑定完成: ${this.bindings.length}/${this.fieldSchemas.length}`)
        DomUtil.log(`   已绑定:`, this.bindings.map(b => b.schema.label).join(', '))
    }

    /** 步骤 2：执行填写 */
    async fillAll(): Promise<{ success: number; fail: number; skipped: number }> {
        DomUtil.log(`\n📝 开始智能填表，共 ${this.bindings.length} 个字段`)

        let success = 0
        let fail = 0
        let skipped = 0
        const filled = new Set<string>()

        for (const b of this.bindings) {
            // 防止重复填写
            if (filled.has(b.schema.key)) {
                DomUtil.log(`⏭️ 跳过重复: ${b.schema.label}`)
                skipped++
                continue
            }

            // 获取值
            let value = b.schema.valueFrom?.(this.decision.semanticFields, this.scraped)

            // 如果没有值，尝试使用默认值
            if (value == null || value === "") {
                value = b.schema.defaultValue
            }

            if (value == null || value === "") {
                DomUtil.log(`⚠️ 无可用值: ${b.schema.label}`)
                skipped++
                continue
            }

            try {
                const ok = await b.fill(value)
                filled.add(b.schema.key)

                if (ok) {
                    DomUtil.log(`✅ 成功: ${b.schema.label} = ${value}`)
                    success++
                } else {
                    DomUtil.log(`❌ 失败: ${b.schema.label} = ${value}`)
                    fail++
                }
            } catch (e) {
                DomUtil.log(`❌ 异常: ${b.schema.label}`, e)
                fail++
            }

            // 每个字段之间稍微等待
            await DomUtil.sleep(100)
        }

        DomUtil.log(`\n📊 填表统计: 成功 ${success}, 失败 ${fail}, 跳过 ${skipped}`)
        return { success, fail, skipped }
    }

    /** 图片区域处理 */
    async fillImages() {
        const images = this.decision.mainImages ?? this.scraped.images ?? []
        if (!images.length) {
            DomUtil.log("⚠️ 没有可用主图")
            return
        }
        DomUtil.log(`📸 图片待填充: ${images.length} 张`)
        // TODO: 调用图片上传逻辑
    }

    /** 统一入口 */
    async run(): Promise<{ success: number; fail: number; skipped: number }> {
        DomUtil.log("\n══════════════════════════════════════")
        DomUtil.log("🚀 Super Engine 启动")
        DomUtil.log(`   商品: ${this.scraped.title?.substring(0, 30)}...`)
        DomUtil.log(`   类目: ${this.decision.categoryPath.join(' > ')}`)
        DomUtil.log("══════════════════════════════════════\n")

        this.buildBindings()
        const result = await this.fillAll()
        await this.fillImages()

        DomUtil.log("\n✅ Super Engine 完成\n")
        return result
    }
}

// --------- 5. 便捷工厂函数 ----------------

/**
 * 从 FullAIResult 创建引擎需要的数据结构
 */
export function createFromFullAIResult(aiResult: {
    title?: string
    brand?: string
    model?: string
    price?: number
    stock?: number
    specs?: Record<string, string>
    categoryPath: string[]
    categoryName?: string
    sourceUrl?: string
    images?: string[]
}): { scraped: ScrapedProduct; decision: AiDecision } {

    // ⭐⭐⭐ 品牌清洗：优先使用 specs 中的品牌 ⭐⭐⭐
    let cleanBrand = ''
    if (aiResult.specs?.['品牌']) {
        cleanBrand = aiResult.specs['品牌']
        DomUtil.log(`📌 从 specs 获取品牌: "${cleanBrand}"`)
    } else if (aiResult.brand && aiResult.brand.length <= 10) {
        cleanBrand = aiResult.brand
    } else if (aiResult.brand) {
        // 品牌太长，尝试从标题提取
        const knownBrands = [
            '得力', 'deli', '齐心', '晨光', '惠普', 'HP', '佳能', 'Canon',
            '爱普生', 'Epson', '联想', 'Lenovo', '华为', 'HUAWEI', '小米',
            '虎牌', 'TIGER', '永发', '全能', '大一', '艾谱', 'AIPU', '科密',
            '三星', 'Samsung', '戴尔', 'Dell', '华硕', 'ASUS',
            '兄弟', 'Brother', '理光', 'Ricoh', '京瓷', 'Kyocera',
            '美的', 'Midea', '格力', 'GREE', '海尔', 'Haier',
        ]
        const text = (aiResult.title || aiResult.brand).toLowerCase()
        for (const brand of knownBrands) {
            if (text.includes(brand.toLowerCase())) {
                cleanBrand = brand
                DomUtil.log(`📌 从标题提取品牌: "${cleanBrand}"`)
                break
            }
        }
    }

    // ⭐⭐⭐ 型号清洗：优先使用 specs 中的型号 ⭐⭐⭐
    let cleanModel = ''
    if (aiResult.specs?.['型号'] || aiResult.specs?.['商品型号']) {
        cleanModel = aiResult.specs['型号'] || aiResult.specs['商品型号']
        DomUtil.log(`📌 从 specs 获取型号: "${cleanModel}"`)
    } else if (aiResult.model) {
        cleanModel = aiResult.model
    } else if (aiResult.title) {
        const modelMatch = aiResult.title.match(/[A-Za-z]+[-]?[0-9]+[A-Za-z0-9-]*/)
        if (modelMatch) {
            cleanModel = modelMatch[0]
            DomUtil.log(`📌 从标题提取型号: "${cleanModel}"`)
        }
    }

    const scraped: ScrapedProduct = {
        title: aiResult.title || '',
        brand: cleanBrand,
        model: cleanModel,
        price: aiResult.price,
        stock: aiResult.stock,
        specs: aiResult.specs,
        originUrl: aiResult.sourceUrl,
        images: aiResult.images,
    }

    const decision: AiDecision = {
        categoryPath: aiResult.categoryPath,
        categoryName: aiResult.categoryName,
        semanticFields: {
            brand: cleanBrand,
            model: cleanModel,
            price: aiResult.price,
            stock: aiResult.stock || 999,
            sourceUrl: aiResult.sourceUrl,
            ...aiResult.specs,  // 把 specs 展开到语义字段
        },
        mainImages: aiResult.images,
    }

    return { scraped, decision }
}

/**
 * 对外统一入口
 */
export async function runZcySuperEngine(aiResult: {
    title?: string
    brand?: string
    model?: string
    price?: number
    stock?: number
    specs?: Record<string, string>
    categoryPath: string[]
    categoryName?: string
    sourceUrl?: string
    images?: string[]
}): Promise<{ success: number; fail: number; skipped: number }> {
    const { scraped, decision } = createFromFullAIResult(aiResult)
    const engine = new ZcyFormEngine(scraped, decision)
    return await engine.run()
}

// 暴露到 window，方便控制台调试
; (window as any).ZcySuperEngine = { run: runZcySuperEngine, ZcyFormEngine, DomUtil }
