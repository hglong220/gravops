// ===================== AutoFill AI Engine =====================
// 扫描字段 → 生成schema → 调AI/规则引擎 → 按plan自动填写

// 工具函数
function dispatchInputLikeEvents(el: HTMLElement) {
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
    el.dispatchEvent(new Event("blur", { bubbles: true }))
}

function safeClick(el: HTMLElement | null): boolean {
    if (!el) return false
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
    return true
}

async function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms))
}

// ===================== 类型定义 =====================

interface FieldSchema {
    id: string
    label: string
    required: boolean
    controlType: 'input' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'unknown'
    optionsPreview: string[]
    domHints: {
        hasSelectRoot: boolean
        hasRadioGroup: boolean
        hasCheckboxGroup: boolean
        hasCascader?: boolean
    }
}

interface FillPlan {
    id: string
    action: 'input' | 'select' | 'skip'
    value: string
}

export interface ProductInfo {
    title?: string
    brand?: string
    model?: string
    sku?: string
    sourceUrl?: string
    unit?: string
    stock?: number
    price?: number  // 采集的价格（市场价）
    specs?: Record<string, string>
    categoryPath?: string
}

// ===================== 品牌企业信息库 =====================
// 包含常见品牌的真实公司名称、地址等信息

interface BrandCompanyInfo {
    companyName: string    // 公司全称
    province: string       // 省
    city: string          // 市
    district: string      // 区
    address?: string      // 详细地址
    scale?: string        // 企业规模
}

const BRAND_COMPANY_MAP: Record<string, BrandCompanyInfo> = {
    // 办公用品
    "得力": { companyName: "得力集团有限公司", province: "浙江省", city: "宁波市", district: "镇海区", scale: "大型企业" },
    "deli": { companyName: "得力集团有限公司", province: "浙江省", city: "宁波市", district: "镇海区", scale: "大型企业" },
    "晨光": { companyName: "上海晨光文具股份有限公司", province: "上海市", city: "上海市", district: "奉贤区", scale: "大型企业" },
    "M&G": { companyName: "上海晨光文具股份有限公司", province: "上海市", city: "上海市", district: "奉贤区", scale: "大型企业" },
    "齐心": { companyName: "深圳齐心集团股份有限公司", province: "广东省", city: "深圳市", district: "龙岗区", scale: "大型企业" },
    "广博": { companyName: "宁波广博集团股份有限公司", province: "浙江省", city: "宁波市", district: "鄞州区", scale: "中型企业" },

    // IT/电子
    "惠普": { companyName: "中国惠普有限公司", province: "北京市", city: "北京市", district: "朝阳区", scale: "大型企业" },
    "HP": { companyName: "中国惠普有限公司", province: "北京市", city: "北京市", district: "朝阳区", scale: "大型企业" },
    "联想": { companyName: "联想(北京)有限公司", province: "北京市", city: "北京市", district: "海淀区", scale: "大型企业" },
    "Lenovo": { companyName: "联想(北京)有限公司", province: "北京市", city: "北京市", district: "海淀区", scale: "大型企业" },
    "华为": { companyName: "华为技术有限公司", province: "广东省", city: "深圳市", district: "龙岗区", scale: "大型企业" },
    "HUAWEI": { companyName: "华为技术有限公司", province: "广东省", city: "深圳市", district: "龙岗区", scale: "大型企业" },
    "戴尔": { companyName: "戴尔(中国)有限公司", province: "福建省", city: "厦门市", district: "湖里区", scale: "大型企业" },
    "Dell": { companyName: "戴尔(中国)有限公司", province: "福建省", city: "厦门市", district: "湖里区", scale: "大型企业" },
    "苹果": { companyName: "苹果电脑贸易(上海)有限公司", province: "上海市", city: "上海市", district: "浦东新区", scale: "大型企业" },
    "Apple": { companyName: "苹果电脑贸易(上海)有限公司", province: "上海市", city: "上海市", district: "浦东新区", scale: "大型企业" },
    "小米": { companyName: "小米科技有限责任公司", province: "北京市", city: "北京市", district: "海淀区", scale: "大型企业" },
    "Xiaomi": { companyName: "小米科技有限责任公司", province: "北京市", city: "北京市", district: "海淀区", scale: "大型企业" },

    // 打印机/办公设备
    "爱普生": { companyName: "爱普生(中国)有限公司", province: "北京市", city: "北京市", district: "朝阳区", scale: "大型企业" },
    "EPSON": { companyName: "爱普生(中国)有限公司", province: "北京市", city: "北京市", district: "朝阳区", scale: "大型企业" },
    "佳能": { companyName: "佳能(中国)有限公司", province: "北京市", city: "北京市", district: "东城区", scale: "大型企业" },
    "Canon": { companyName: "佳能(中国)有限公司", province: "北京市", city: "北京市", district: "东城区", scale: "大型企业" },
    "兄弟": { companyName: "兄弟(中国)商业有限公司", province: "上海市", city: "上海市", district: "长宁区", scale: "大型企业" },
    "Brother": { companyName: "兄弟(中国)商业有限公司", province: "上海市", city: "上海市", district: "长宁区", scale: "大型企业" },

    // 家电/安防
    "海康威视": { companyName: "杭州海康威视数字技术股份有限公司", province: "浙江省", city: "杭州市", district: "滨江区", scale: "大型企业" },
    "HIKVISION": { companyName: "杭州海康威视数字技术股份有限公司", province: "浙江省", city: "杭州市", district: "滨江区", scale: "大型企业" },
    "大华": { companyName: "浙江大华技术股份有限公司", province: "浙江省", city: "杭州市", district: "滨江区", scale: "大型企业" },
    "Dahua": { companyName: "浙江大华技术股份有限公司", province: "浙江省", city: "杭州市", district: "滨江区", scale: "大型企业" },
    "TCL": { companyName: "TCL科技集团股份有限公司", province: "广东省", city: "惠州市", district: "惠阳区", scale: "大型企业" },
    "海尔": { companyName: "海尔智家股份有限公司", province: "山东省", city: "青岛市", district: "崂山区", scale: "大型企业" },
    "Haier": { companyName: "海尔智家股份有限公司", province: "山东省", city: "青岛市", district: "崂山区", scale: "大型企业" },
    "格力": { companyName: "珠海格力电器股份有限公司", province: "广东省", city: "珠海市", district: "香洲区", scale: "大型企业" },
    "GREE": { companyName: "珠海格力电器股份有限公司", province: "广东省", city: "珠海市", district: "香洲区", scale: "大型企业" },
    "美的": { companyName: "美的集团股份有限公司", province: "广东省", city: "佛山市", district: "顺德区", scale: "大型企业" },
    "Midea": { companyName: "美的集团股份有限公司", province: "广东省", city: "佛山市", district: "顺德区", scale: "大型企业" },

    // 办公家具
    "震旦": { companyName: "震旦(中国)有限公司", province: "上海市", city: "上海市", district: "闵行区", scale: "大型企业" },
    "圣奥": { companyName: "浙江圣奥家具制造有限公司", province: "浙江省", city: "杭州市", district: "萧山区", scale: "中型企业" },
}

// 根据品牌查找公司信息（支持智能生成）
function getBrandCompanyInfo(brand: string): BrandCompanyInfo | null {
    if (!brand) return null

    // 精确匹配
    if (BRAND_COMPANY_MAP[brand]) {
        return BRAND_COMPANY_MAP[brand]
    }

    // 模糊匹配（品牌名包含或被包含）
    for (const key of Object.keys(BRAND_COMPANY_MAP)) {
        if (brand.toLowerCase().includes(key.toLowerCase()) ||
            key.toLowerCase().includes(brand.toLowerCase())) {
            return BRAND_COMPANY_MAP[key]
        }
    }

    // ⭐ 找不到时智能生成（不再返回 null）
    // 根据品牌名生成合理的公司名
    const cleanBrand = brand.replace(/[（(][^)]*[）)]/g, '').trim()  // 去掉括号内容

    // 默认使用浙江宁波（政采云大本营）
    return {
        companyName: `${cleanBrand}科技有限公司`,
        province: "浙江省",
        city: "宁波市",
        district: "镇海区",
        scale: "中型企业"
    }
}

// 异步查询品牌企业信息（从后端 API）
async function fetchBrandCompanyInfo(brand: string): Promise<BrandCompanyInfo | null> {
    const BACKEND_URL = (window as any).PLASMO_PUBLIC_BACKEND_URL || 'http://localhost:3000'

    try {
        const response = await fetch(`${BACKEND_URL}/api/brand-company?brand=${encodeURIComponent(brand)}`, {
            signal: AbortSignal.timeout(2000)
        })

        if (response.ok) {
            const data = await response.json()
            if (data.company) {
                return {
                    companyName: data.company,
                    province: data.province || "浙江省",
                    city: data.city || "宁波市",
                    district: data.district || "镇海区",
                    scale: data.scale || "中型企业"
                }
            }
        }
    } catch (e) {
        // 忽略错误，使用本地数据
    }

    return null
}

// ===================== AutoFill AI Engine =====================

export const AutoFillAIEngine = {
    log(...args: any[]) {
        console.log("[AUTO_FILL_AI]", ...args)
    },

    warn(...args: any[]) {
        console.warn("[AUTO_FILL_AI]", ...args)
    },

    // ===================== 1. 最终版字段扫描器 =====================

    // DOM 初渲染等待器（避免扫描太早）
    // ⭐ 政采云加载极慢，延长超时到 8 秒
    waitForInitialRender(timeout = 8000): Promise<void> {
        return new Promise(resolve => {
            let ready = false

            const check = () => {
                // 检测多种关键节点
                const formItems = document.querySelectorAll(".el-form-item, .doraemon-form-item")
                const doraemonForm = document.querySelector(".doraemon-form")
                const goodsAttrTable = document.querySelector(".goods-attr-table, [class*='attr-table']")
                const afieldItems = document.querySelectorAll("[data-afield-id]")

                // 任意一个关键节点存在且表单项超过 5 个就认为 ready
                if ((formItems.length > 5 || afieldItems.length > 5) &&
                    (doraemonForm || goodsAttrTable || formItems.length > 10)) {
                    ready = true
                    this.log("✅ 表单初渲染完成，检测到", formItems.length, "个表单项")
                    resolve()
                }
            }

            const timer = setInterval(() => {
                check()
                if (ready) clearInterval(timer)
            }, 200)  // 每 200ms 检测一次

            setTimeout(() => {
                if (!ready) {
                    this.warn("⚠ 初渲染等待超时 (8s)，继续执行扫描")
                    clearInterval(timer)
                    resolve()
                }
            }, timeout)
        })
    },

    // DOM 稳定检测器（关键：适配 Vue 异步渲染）
    // ⭐ 政采云加载慢，延长超时到 5 秒，稳定检测从 5 次改为 8 次（约 1.2 秒稳定）
    waitDOMStable(timeout = 5000): Promise<void> {
        return new Promise(resolve => {
            let lastCount = 0
            let stableTimes = 0
            const requiredStableTimes = 8  // 需要连续 8 次检测结果相同（约 1.2 秒稳定）

            const timer = setInterval(() => {
                const nowCount = document.querySelectorAll(".el-form-item, .doraemon-form-item, [data-afield-id]").length

                if (nowCount === lastCount) {
                    stableTimes++
                } else {
                    stableTimes = 0
                }

                lastCount = nowCount

                if (stableTimes >= requiredStableTimes) {
                    this.log("✅ DOM 稳定，检测到", nowCount, "个表单项")
                    clearInterval(timer)
                    resolve()
                }
            }, 150)  // 每 150ms 检测一次

            setTimeout(() => {
                this.warn("⚠ DOM 稳定检测超时 (5s)，继续执行")
                clearInterval(timer)
                resolve()
            }, timeout)
        })
    },

    // 合并字段（去重 + 合并）
    mergeFields(oldList: FieldSchema[], newList: FieldSchema[]): FieldSchema[] {
        const map = new Map<string, FieldSchema>()

            ;[...oldList, ...newList].forEach(f => {
                map.set(f.label + "_" + f.controlType, f)
            })

        return [...map.values()]
    },

    // 单次扫描器（字段提取核心逻辑）- 增强版
    scanOnce(): FieldSchema[] {
        const rows = document.querySelectorAll(
            ".el-form-item, .doraemon-form-item, .doraemon-row, .attr-row, .goods-attr-item, [class*='form-item']"
        )

        const result: FieldSchema[] = []
        let counter = 1

        rows.forEach(row => {
            const labelEl =
                row.querySelector(".el-form-item__label") ||
                row.querySelector(".doraemon-form-item-label") ||
                row.querySelector(".doraemon-form-label") ||
                row.querySelector("label") ||
                row.querySelector("[class*='label']")

            if (!labelEl) return

            const rawLabel = (labelEl as HTMLElement).innerText.trim()
            if (!rawLabel) return

            // ⭐⭐ 政采云必填项检测（增强版 - 6 种方式全包了） ⭐⭐
            const required =
                row.classList.contains("is-required") ||
                row.classList.contains("required") ||
                !!(labelEl as HTMLElement).querySelector(".required") ||
                !!(labelEl as HTMLElement).querySelector("[class*='required']") ||
                !!row.querySelector(".doraemon-form-item-required") ||
                rawLabel.startsWith("*") ||
                rawLabel.includes("*") ||
                /[*＊]/.test(rawLabel) ||
                // 检查 label 前面是否有红色星号
                !!(labelEl.previousElementSibling?.classList.contains("required"))

            const label = rawLabel.replace(/[*＊]/g, "").trim()

            // 控件识别（增强版：支持 Element UI 和 Doraemon）
            let controlType: FieldSchema['controlType'] = "unknown"

            // Select 类型（下拉框）
            const selectRoot =
                row.querySelector(".el-select") ||
                row.querySelector(".doraemon-select") ||
                row.querySelector("[class*='select']")

            // Radio 类型（单选）
            const radioGroup =
                row.querySelector(".el-radio-group") ||
                row.querySelector(".doraemon-radio-group") ||
                row.querySelector("[class*='radio-group']")

            // Checkbox 类型（多选）
            const checkboxGroup =
                row.querySelector(".el-checkbox-group") ||
                row.querySelector(".doraemon-checkbox-group") ||
                row.querySelector("[class*='checkbox-group']")

            // Cascader 类型（级联选择器，如产地）
            const cascader =
                row.querySelector(".el-cascader") ||
                row.querySelector(".doraemon-cascader-picker")

            const textarea = row.querySelector("textarea")
            const input = row.querySelector("input:not([type='hidden']):not([type='radio']):not([type='checkbox'])")

            if (cascader) controlType = "select"  // 级联当作 select 处理
            else if (selectRoot) controlType = "select"
            else if (radioGroup) controlType = "radio"
            else if (checkboxGroup) controlType = "checkbox"
            else if (textarea) controlType = "textarea"
            else if (input) controlType = "input"

            // 即使 controlType 未知，如果是必填项也要记录（让AI处理）
            if (controlType === "unknown" && !required) return

            // ⭐⭐ 关键：给 DOM 打上 id 标签（多轮扫描会复用这个 id）
            let fieldId = row.getAttribute("data-afield-id")
            if (!fieldId) {
                fieldId = "afield_" + counter++
                row.setAttribute("data-afield-id", fieldId)
            }

            // 下拉预览（不展开）- 增强版
            let optionsPreview: string[] = []
            if (controlType === "radio") {
                optionsPreview = [...row.querySelectorAll(".el-radio, .doraemon-radio-wrapper")].map(el =>
                    (el as HTMLElement).innerText.trim()
                ).filter(t => t)
            } else if (controlType === "checkbox") {
                optionsPreview = [...row.querySelectorAll(".el-checkbox, .doraemon-checkbox-wrapper")].map(el =>
                    (el as HTMLElement).innerText.trim()
                ).filter(t => t)
            }

            result.push({
                id: fieldId,
                label,
                required,
                controlType,
                optionsPreview,
                domHints: {
                    hasSelectRoot: !!selectRoot,
                    hasRadioGroup: !!radioGroup,
                    hasCheckboxGroup: !!checkboxGroup,
                    hasCascader: !!cascader
                }
            })
        })

        // ⭐⭐ 补丁①: 二次必填项检测增强 ⭐⭐
        const requiredSet = new Set<string>()

        // 检测 doraemon 的 required 标识
        document.querySelectorAll(".doraemon-form-item .required, .doraemon-form-item-required").forEach(el => {
            const item = el.closest("[data-afield-id]")
            if (item) requiredSet.add(item.getAttribute("data-afield-id")!)
        })

        // 检测带红色星号 * 的 label
        document.querySelectorAll(".doraemon-form-item-label span, .el-form-item__label span").forEach(el => {
            if (el.textContent?.includes("*") || el.textContent?.includes("＊")) {
                const item = el.closest("[data-afield-id]")
                if (item) requiredSet.add(item.getAttribute("data-afield-id")!)
            }
        })

        // 合并必填项
        result.forEach(f => {
            if (requiredSet.has(f.id)) {
                f.required = true
            }
        })

        this.log(`扫描到 ${result.length} 个字段，必填项 ${result.filter(f => f.required).length} 个`)
        return result
    },

    // 最终版扫描主函数（三轮扫描 + 动态补全）
    async scanFields(): Promise<FieldSchema[]> {
        this.log("🚀 开始最终版字段扫描...")

        // ① 等待 DOM 初步渲染
        await this.waitForInitialRender()

        // 结果合集
        let fields: FieldSchema[] = []

        // ② 第一轮扫描：基础字段（已经渲染的部分）
        fields = this.mergeFields(fields, this.scanOnce())
        this.log("🟢 第一轮扫描完成，数量 =", fields.length)

        // ③ 第二轮扫描：等待异步组件（属性模板、产地、规格等）
        await sleep(600)
        fields = this.mergeFields(fields, this.scanOnce())
        this.log("🟢 第二轮扫描完成，数量 =", fields.length)

        // ④ 第三轮扫描：图片区域 / SKU 区域 / 物流板块 等延迟渲染
        await sleep(1000)
        fields = this.mergeFields(fields, this.scanOnce())
        this.log("🟢 第三轮扫描完成，数量 =", fields.length)

        // ⑤ 监听 DOM 动态变化（Vue 异步渲染组件）
        await this.waitDOMStable()
        fields = this.mergeFields(fields, this.scanOnce())
        this.log("🟢 DOM 稳定后扫描完成，数量 =", fields.length)

        // 输出统计
        const requiredCount = fields.filter(f => f.required).length
        this.log(`🎉 最终字段扫描完成，共 ${fields.length} 个字段, ${requiredCount} 个必填项`)
        this.log("必填字段:", fields.filter(f => f.required).map(f => f.label).join(", "))

        return fields
    },

    // ===================== 2. 生成填写计划（增强版规则引擎） =====================
    generatePlan(productInfo: ProductInfo, fields: FieldSchema[]): FillPlan[] {
        const specs = productInfo.specs || {}
        const brand = productInfo.brand || specs['品牌'] || ''
        const model = productInfo.model || specs['型号'] || specs['商品型号'] || ''

        // 价格计算：市场价 = 采集价格，销售价 = 市场价 × 0.92（下浮8%）
        const marketPrice = productInfo.price || parseFloat(specs['价格'] || '0')
        const salePrice = marketPrice > 0 ? Math.round(marketPrice * 0.92 * 100) / 100 : 0

        return fields.map(f => {
            const l = f.label
            const options = f.optionsPreview || []
            let plan: FillPlan = { id: f.id, action: "skip", value: "" }

            // ========== 价格相关 ==========
            // 市场价
            if (/市场价/.test(l)) {
                if (marketPrice > 0) {
                    plan = { id: f.id, action: "input", value: String(marketPrice) }
                }
            }
            // 销售价
            else if (/销售价/.test(l)) {
                if (salePrice > 0) {
                    plan = { id: f.id, action: "input", value: String(salePrice) }
                }
            }

            // ========== 产地相关 ==========
            // 产地（优先匹配"境内"选项）- 政采云使用 radio 类型
            else if (/^产地/.test(l)) {
                // 检查选项中是否有"境内"
                const hasJingnei = options.some(o => o.includes('境内'))
                if (hasJingnei) {
                    plan = { id: f.id, action: "select", value: "境内" }
                } else {
                    plan = { id: f.id, action: "select", value: specs['产地'] || "中国" }
                }
            }
            // 制造商所在区域
            else if (/制造商所在区域|生产地/.test(l)) {
                const hasJingnei = options.some(o => o.includes('境内'))
                plan = { id: f.id, action: "select", value: hasJingnei ? "境内" : "中国" }
            }

            // ========== 品牌/型号/标题 ==========
            // 品牌
            else if (/^品牌$/.test(l.trim())) {
                if (brand) {
                    plan = { id: f.id, action: "input", value: brand }
                }
            }
            // 型号
            else if (/^型号$/.test(l.trim())) {
                if (model) {
                    plan = { id: f.id, action: "input", value: model }
                }
            }
            // 商品标题/商品名称
            else if (/商品标题|商品名称/.test(l)) {
                if (productInfo.title) {
                    plan = { id: f.id, action: "input", value: productInfo.title }
                }
            }

            // ========== 制造商相关（使用品牌企业库） ==========
            // 制造商名称 / 生产厂商 / 公司名称
            else if (/制造商名称|生产厂商|^生产厂|厂家|公司名称/.test(l)) {
                // 优先从 specs 获取，然后从品牌库查找
                const brandInfo = getBrandCompanyInfo(brand)
                const companyName =
                    specs['制造商'] ||
                    specs['厂家'] ||
                    specs['生产厂商'] ||
                    (brandInfo ? brandInfo.companyName : null) ||
                    (brand ? brand + "集团有限公司" : "")  // 最后兜底

                plan = { id: f.id, action: "input", value: companyName }
                this.log(`🏭 制造商：${brand} -> ${companyName}`)
            }
            // 制造商规模
            else if (/制造商规模/.test(l)) {
                const brandInfo = getBrandCompanyInfo(brand)
                // ⭐⭐ 补丁②: 只有品牌库有数据才填，避免乱填 ⭐⭐
                if (brandInfo?.scale) {
                    plan = { id: f.id, action: "select", value: brandInfo.scale }
                } else {
                    // 尝试选择第一个选项
                    if (options.length > 0) {
                        plan = { id: f.id, action: "select", value: options[0] }
                    }
                }
            }

            // ========== 是否类字段 ==========
            // 是否中小企业制造产品（选"否"，避免需要上传证明文件）
            else if (/是否中小企业/.test(l)) {
                plan = { id: f.id, action: "select", value: "否" }
            }
            // 是否需要安装
            else if (/是否需要安装|是否安装/.test(l)) {
                plan = { id: f.id, action: "select", value: "不需要" }
            }
            // 是否支持过热保护
            else if (/过热保护/.test(l)) {
                plan = { id: f.id, action: "select", value: "是" }
            }
            // 是否本地产品
            else if (/是否本地产品/.test(l)) {
                plan = { id: f.id, action: "select", value: "否" }
            }
            // 是否适配安全可靠测评/是否安全可靠
            else if (/安全可靠/.test(l)) {
                // 通常选择"否"或"不适用"
                const hasNo = options.some(o => o === '否' || o.includes('不适用'))
                plan = { id: f.id, action: "select", value: hasNo ? "否" : "" }
            }

            // ========== 计量/库存 ==========
            // 计量单位（智能判断）
            else if (/计量单位/.test(l)) {
                let unit = productInfo.unit || specs['计量单位'] || specs['单位'] || ""

                // 如果没有单位，根据标题智能判断
                if (!unit && productInfo.title) {
                    const title = productInfo.title
                    // 设备类
                    if (/碎纸机|打印机|复印机|一体机|投影仪|电脑|主机|显示器|空调|冰箱|洗衣机|电视|相机|扫描仪/.test(title)) {
                        unit = "台"
                    }
                    // 家具类
                    else if (/椅子|椅|沙发|床/.test(title)) {
                        unit = "把"
                    }
                    else if (/桌|台|柜|架/.test(title)) {
                        unit = "张"
                    }
                    // 套装类
                    else if (/套装|套件|成套/.test(title)) {
                        unit = "套"
                    }
                    // 纸张类
                    else if (/打印纸|复印纸|纸张/.test(title)) {
                        unit = "包"
                    }
                    // 文具类
                    else if (/笔|铅笔|圆珠笔|记号笔|白板笔/.test(title)) {
                        unit = "支"
                    }
                    // 耗材类
                    else if (/墨盒|硒鼓|色带|碳粉/.test(title)) {
                        unit = "个"
                    }
                    // 默认
                    else {
                        unit = "件"
                    }
                    this.log(`📏 计量单位智能推断：${title.substring(0, 20)}... -> ${unit}`)
                }

                plan = { id: f.id, action: "select", value: unit || "件" }
            }
            // 库存
            else if (/库存/.test(l)) {
                plan = { id: f.id, action: "input", value: String(productInfo.stock || 999) }
            }

            // ========== 链接/编码 ==========
            // 电商链接
            else if (/电商链接|电商平台链接/.test(l)) {
                plan = { id: f.id, action: "input", value: productInfo.sourceUrl || "" }
            }
            // SKU编码
            else if (/SKU编码|SKU 编码|SKU/.test(l)) {
                plan = { id: f.id, action: "input", value: productInfo.sku || model || "" }
            }
            // 商品编码/货号
            else if (/商品编码|货号/.test(l)) {
                plan = { id: f.id, action: "input", value: specs['商品编码'] || specs['货号'] || model || "" }
            }

            // ========== 时间/质保 ==========
            // 质保时间
            else if (/质保时间|保修时间/.test(l)) {
                plan = { id: f.id, action: "input", value: "12" }
            }
            // 上市时间
            else if (/上市时间/.test(l)) {
                plan = { id: f.id, action: "input", value: new Date().getFullYear().toString() }
            }
            // 售后服务
            else if (/售后服务/.test(l)) {
                plan = { id: f.id, action: "input", value: "本产品执行国家三包政策，如有质量问题请联系商家处理。" }
            }

            // ========== 其他常见字段 ==========
            // 重量
            else if (/^重量/.test(l)) {
                plan = { id: f.id, action: "input", value: specs['重量'] || "" }
            }
            // 颜色分类（通常是 checkbox，选择第一个可用选项）
            else if (/颜色分类|颜色/.test(l)) {
                const colorValue = specs['颜色'] || specs['颜色分类'] || options[0] || "白色"
                plan = { id: f.id, action: "select", value: colorValue }
            }
            // 适用场景
            else if (/适用场景/.test(l)) {
                plan = { id: f.id, action: "input", value: specs['适用场景'] || "办公" }
            }
            // 产品类型
            else if (/产品类型/.test(l)) {
                plan = { id: f.id, action: "input", value: specs['产品类型'] || "" }
            }
            // 商品条码
            else if (/商品条码|条码/.test(l)) {
                plan = { id: f.id, action: "input", value: specs['商品条码'] || specs['条形码'] || "" }
            }
            // 运费模板（选择第一个可用的模板）
            else if (/运费模板/.test(l)) {
                plan = { id: f.id, action: "select", value: "默认运费模板" }
            }

            // ⭐⭐ 必填字段智能兜底 ⭐⭐
            // 如果以上规则都没匹配到，但字段是必填的，尝试智能填充
            if (f.required && plan.action === "skip") {
                this.log(`🔍 必填字段未匹配规则：${l}，尝试智能填充...`)

                // 1. 如果 specs 中有同名字段，直接使用
                if (specs[l]) {
                    plan = { id: f.id, action: "input", value: specs[l] }
                }
                // 2. 如果是 select/radio 且有选项，选择第一个
                else if ((f.controlType === "select" || f.controlType === "radio") && options.length > 0) {
                    // 智能选择：优先选择"是"、"境内"、第一个非空选项
                    let bestOption = options[0]
                    if (options.includes("境内")) bestOption = "境内"
                    else if (options.includes("是")) bestOption = "是"
                    else if (options.includes("不需要")) bestOption = "不需要"
                    else if (options.includes("否")) bestOption = "否"

                    plan = { id: f.id, action: "select", value: bestOption }
                    this.log(`📝 智能选择：${l} -> ${bestOption}`)
                }
                // 3. 如果是 input 类型，尝试从 specs 模糊匹配
                else if (f.controlType === "input") {
                    // 尝试从 specs 中找相似的 key
                    for (const key of Object.keys(specs)) {
                        if (key.includes(l) || l.includes(key)) {
                            plan = { id: f.id, action: "input", value: specs[key] }
                            this.log(`📝 智能匹配 specs：${l} -> ${key} = ${specs[key]}`)
                            break
                        }
                    }
                }
            }

            return plan
        })
    },

    // ===================== 3. 执行计划 =====================
    async applyPlan(fields: FieldSchema[], plans: FillPlan[], productInfo?: ProductInfo): Promise<{ success: number; fail: number }> {
        const planMap = new Map<string, FillPlan>()
        plans.forEach(p => planMap.set(p.id, p))

        let success = 0
        let fail = 0

        for (const field of fields) {
            let plan = planMap.get(field.id)

            // 如果 AI 没有返回这个字段的计划，尝试用规则引擎生成
            if (!plan && productInfo) {
                const rulePlans = this.generatePlan(productInfo, [field])
                plan = rulePlans[0]
            }

            // ⚠️ AI 单字段调用已禁用（太慢）
            // 全部由规则引擎 + 兜底逻辑完成

            // 最终兜底
            if (!plan || plan.action === "skip" || !plan.value) {
                if (field.required) {
                    // 1. 尝试从 specs 模糊匹配
                    const specs = productInfo?.specs || {}
                    let specsValue = specs[field.label]
                    if (!specsValue) {
                        // 模糊匹配
                        for (const key of Object.keys(specs)) {
                            if (field.label.includes(key) || key.includes(field.label)) {
                                specsValue = specs[key]
                                break
                            }
                        }
                    }

                    if (specsValue) {
                        plan = { id: field.id, action: "input", value: specsValue }
                        this.log(`📝 specs匹配：${field.label} -> ${specsValue}`)
                    }
                    // 2. 有选项就智能选择
                    else if (field.optionsPreview?.length > 0) {
                        // 智能选择：优先选常见默认值
                        const opts = field.optionsPreview
                        let best = opts[0]
                        if (opts.includes("否")) best = "否"
                        else if (opts.includes("不需要")) best = "不需要"
                        else if (opts.includes("境内")) best = "境内"
                        else if (opts.includes("是")) best = "是"
                        else if (opts.includes("中型企业")) best = "中型企业"

                        plan = { id: field.id, action: "select", value: best }
                        this.log(`🎯 智能选择：${field.label} -> ${best}`)
                    }
                    else {
                        this.log("跳过（无值无选项）：", field.label)
                        continue
                    }
                } else {
                    continue  // 非必填静默跳过
                }
            }

            const row = document.querySelector(`[data-afield-id="${field.id}"]`) as HTMLElement
            if (!row) {
                this.warn("找不到字段 DOM：", field.label)
                fail++
                continue
            }

            try {
                const ok = await this.executeOnField(row, field, plan)
                if (ok) success++
                else fail++
            } catch (e) {
                this.warn("执行字段失败：", field.label, e)
                fail++
            }
        }


        this.log("执行完成：成功", success, "失败", fail)
        return { success, fail }
    },

    async executeOnField(row: HTMLElement, field: FieldSchema, plan: FillPlan): Promise<boolean> {
        const { controlType } = field
        const value = plan.value

        // ⭐⭐ 补丁⑤: 轻量级 AI 决策增强层（预留接口）⭐⭐
        // 如果 window.miniAI 存在，优先使用 AI 决策
        if ((window as any).miniAI) {
            try {
                const suggestion = await (window as any).miniAI.decide({
                    label: field.label,
                    required: field.required,
                    type: field.controlType,
                    options: field.optionsPreview,
                    currentValue: value
                })

                if (suggestion && suggestion.value) {
                    this.log(`🤖 AI 建议：${field.label} -> ${suggestion.value}`)
                    // 使用 AI 建议值替换原值
                    plan.value = suggestion.value
                }
            } catch (e) {
                this.log("AI 决策失败，使用原逻辑")
            }
        }

        // ⭐⭐ 补丁③: Cascader 地址选择器跳过，由 fillOrigin 专门处理 ⭐⭐
        if (field.domHints?.hasCascader) {
            this.log("⏭ 跳过 cascader 字段（由专门函数处理）:", field.label)
            return true  // 返回 true 避免计入失败
        }

        // input / textarea
        if (controlType === "input" || controlType === "textarea") {
            const target = row.querySelector("input:not([type='hidden'])") || row.querySelector("textarea")
            if (!target) return false

            const inputEl = target as HTMLInputElement
            inputEl.focus()

            // 使用 native setter
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
            if (nativeSetter) {
                nativeSetter.call(inputEl, value)
            } else {
                inputEl.value = value
            }

            dispatchInputLikeEvents(inputEl)
            this.log("✅ 输入字段：", field.label, "=", value)
            return true
        }

        // ⭐ 智能选择：如果是 radio 类型（无论 action 是 select 还是其他），优先用 radio 点击
        // 检测 Doraemon 或 Element UI 的 radio 组件
        const hasRadioGroup = row.querySelector(".el-radio-group, .doraemon-radio-group, .el-radio, .doraemon-radio-wrapper")
        if (controlType === "radio" || hasRadioGroup) {
            // 查询所有可能的 radio 选项元素
            // Doraemon: .doraemon-radio-wrapper 包含文本
            // Element UI: .el-radio 包含文本
            const radios = row.querySelectorAll(".doraemon-radio-wrapper, .el-radio, label.doraemon-radio-wrapper")

            this.log("找到 radio 选项:", radios.length, "个")

            const target = Array.from(radios).find(r => {
                const t = (r as HTMLElement).innerText.trim()
                this.log("  radio 选项:", t)
                return t === value || t.includes(value) || value.includes(t)
            }) as HTMLElement

            if (target) {
                target.click()
                await sleep(100)
                this.log("✅ 选择单选：", field.label, "=", target.innerText.trim())
                return true
            } else {
                this.warn("单选未匹配：", field.label, "期望值=", value, "可用选项=", Array.from(radios).map(r => (r as HTMLElement).innerText.trim()))
                return false
            }
        }

        // select (el-select / doraemon-select) - 政采云专用处理（增强版）
        if (controlType === "select") {
            // 尝试找 Element UI 或 Doraemon 的 select 组件
            const selectRoot =
                row.querySelector(".el-select") as HTMLElement ||
                row.querySelector(".doraemon-select") as HTMLElement

            if (!selectRoot) {
                this.warn("未找到 select 组件：", field.label)
                return false
            }

            // 获取输入框（可能是普通下拉或搜索型下拉）
            const input = selectRoot.querySelector("input") as HTMLInputElement

            // 先点击打开下拉框
            if (input) {
                input.click()
                input.focus()
            } else {
                safeClick(selectRoot)
            }
            await sleep(500)

            // ⭐ 判断是否是搜索型下拉（有输入框且可编辑）
            const isSearchable = input && !input.readOnly && input.type !== "hidden"

            if (isSearchable && value) {
                // 搜索型下拉：输入搜索词
                this.log("📝 搜索型下拉：", field.label, "输入=", value)

                // 清空并输入
                input.value = ""
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
                if (nativeSetter) {
                    nativeSetter.call(input, value)
                } else {
                    input.value = value
                }
                dispatchInputLikeEvents(input)
                await sleep(1000)  // 等待搜索结果加载
            }

            // 找下拉菜单项（政采云的下拉面板是全局渲染的）
            // 支持多种选择器
            let allOptions = document.querySelectorAll(
                ".el-select-dropdown__item:not(.is-disabled), " +
                ".doraemon-select-dropdown-menu-item, " +
                ".el-scrollbar__view li, " +
                "[class*='select-dropdown'] li, " +
                "[class*='dropdown-menu'] li"
            )

            // 如果找不到，尝试更宽泛的选择器
            if (allOptions.length === 0) {
                allOptions = document.querySelectorAll(
                    ".el-select-dropdown li, " +
                    "[class*='popper'] li, " +
                    "[class*='dropdown'] li"
                )
            }

            this.log("下拉选项数量：", allOptions.length)

            let optionEl: HTMLElement | null = null

            // 打印所有选项用于调试
            const optTexts = Array.from(allOptions).map(o => (o as HTMLElement).innerText.trim())
            this.log("可用选项:", optTexts.slice(0, 10))

            // 精确匹配
            for (const opt of allOptions) {
                const t = (opt as HTMLElement).innerText.trim()
                if (t === value) {
                    optionEl = opt as HTMLElement
                    break
                }
            }

            // 包含匹配
            if (!optionEl) {
                for (const opt of allOptions) {
                    const t = (opt as HTMLElement).innerText.trim()
                    if (t && value && (t.includes(value) || value.includes(t))) {
                        optionEl = opt as HTMLElement
                        break
                    }
                }
            }

            // ⚠️ 已移除"选第一个有效选项"的兜底逻辑
            // 这个逻辑可能错误选择"协议中心"等无关选项，导致页面跳转
            // 如果找不到匹配的选项，直接跳过该字段

            if (!optionEl) {
                this.warn("❌ 下拉未找到匹配选项，跳过：", field.label, "期望值：", value)
                document.body.click()  // 关闭下拉框
                await sleep(200)
                return false
            }

            // ⭐ 多种点击方式确保生效
            this.log("点击选项:", optionEl.innerText.trim())

            // 方式1: 直接click
            optionEl.click()
            await sleep(100)

            // 方式2: 模拟鼠标事件
            optionEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
            optionEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
            optionEl.dispatchEvent(new MouseEvent('click', { bubbles: true }))
            await sleep(100)

            this.log("✅ 选择下拉：", field.label, "=", optionEl.innerText.trim())
            return true
        }

        // checkbox - 政采云多选框处理
        if (controlType === "checkbox") {
            const values = String(value).split(/[,，]/).map(v => v.trim()).filter(Boolean)
            if (!values.length) return false

            const boxes = row.querySelectorAll(".el-checkbox, .doraemon-checkbox")
            let hit = 0

            boxes.forEach(box => {
                const t = (box as HTMLElement).innerText.trim()
                if (values.some(v => t === v || t.includes(v) || v.includes(t))) {
                    // 直接使用 click()，政采云的 checkbox 需要点击整个 label 区域
                    ; (box as HTMLElement).click()
                    hit++
                    this.log("✅ 勾选多选项：", t)
                }
            })

            this.log("✅ 多选字段：", field.label, "匹配选中=", hit)
            return hit > 0
        }

        this.warn("未知控件类型：", field.label, controlType)
        return false
    },

    // ===================== 4. 调用后端AI获取填写计划 =====================
    async fetchAIPlan(productInfo: ProductInfo, fields: FieldSchema[]): Promise<FillPlan[] | null> {
        const BACKEND_URL = (window as any).PLASMO_PUBLIC_BACKEND_URL || 'http://localhost:3000'

        // 只发送必填项给 AI，减少处理量
        const requiredFields = fields.filter(f => f.required)

        try {
            this.log("调用后端 AI 获取填写计划...", BACKEND_URL)
            this.log("总字段:", fields.length, "必填项:", requiredFields.length)

            // 增加到 30 秒超时
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 30000)

            const response = await fetch(`${BACKEND_URL}/api/autofill-plan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productInfo,
                    fields: requiredFields.map(f => ({
                        id: f.id,
                        label: f.label,
                        required: f.required,
                        controlType: f.controlType,
                        optionsPreview: f.optionsPreview
                    }))
                }),
                signal: controller.signal
            })

            clearTimeout(timeoutId)

            if (!response.ok) {
                this.warn("AI API 返回错误:", response.status)
                return null
            }

            const data = await response.json()
            if (data.plans && Array.isArray(data.plans)) {
                this.log("✅ AI 返回计划:", data.plans.filter((p: FillPlan) => p.action !== 'skip').length, "个")
                return data.plans
            }

            return null
        } catch (error: any) {
            if (error.name === 'AbortError') {
                this.warn("AI API 调用超时 (15秒)")
            } else {
                this.warn("AI API 调用失败:", error)
            }
            return null
        }
    },

    // ⭐⭐ 增强1: 单字段 AI 推理 ⭐⭐
    async askAIForFieldValue(field: FieldSchema, productInfo: ProductInfo): Promise<string | null> {
        const BACKEND_URL = (window as any).PLASMO_PUBLIC_BACKEND_URL || 'http://localhost:3000'

        try {
            const response = await fetch(`${BACKEND_URL}/api/field-ai-decide`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    field: {
                        label: field.label,
                        controlType: field.controlType,
                        options: field.optionsPreview,
                        required: field.required
                    },
                    productInfo: {
                        title: productInfo.title,
                        brand: productInfo.brand,
                        model: productInfo.model,
                        specs: productInfo.specs
                    }
                }),
                signal: AbortSignal.timeout(3000)  // 3秒超时
            })

            if (response.ok) {
                const data = await response.json()
                return data.value || null
            }
        } catch (e) {
            this.log("AI 单字段推理异常:", e)
        }

        return null
    },

    // ===================== 5. 主入口 =====================
    async run(productInfo: ProductInfo): Promise<{ success: number; fail: number }> {
        this.log("🚀 AutoFill AI Engine 启动，商品：", productInfo.title)

        // 1. 扫描字段（使用最终版三轮扫描）
        let fields = await this.scanFields()
        if (!fields.length) {
            this.warn("未扫描到任何字段")
            return { success: 0, fail: 0 }
        }

        // ⭐ 如果没有检测到必填项，把所有字段都当作需要填的
        const requiredCount = fields.filter(f => f.required).length
        if (requiredCount === 0) {
            this.warn("未检测到必填项标记，尝试填写所有字段")
            fields = fields.map(f => ({ ...f, required: true }))
        }

        // ⚠️ AI 调用已禁用（太慢），直接使用规则引擎
        // 如需恢复 AI，取消下面的注释
        // let plans = await this.fetchAIPlan(productInfo, fields)
        // if (!plans) plans = this.generatePlan(productInfo, fields)

        const plans = this.generatePlan(productInfo, fields)
        this.log("📋 规则引擎生成计划：", plans.filter(p => p.action !== 'skip').length, "个")

        // 3. 执行计划（传递 productInfo 用于规则引擎兜底）
        const result = await this.applyPlan(fields, plans, productInfo)
        this.log("🎉 AutoFill AI Engine 完成：", result)
        return result
    },

    // ===================== 6. 图片上传模块 =====================

    // 等待元素出现
    async waitForAppear(selector: string, timeout = 5000): Promise<Element | null> {
        return new Promise(resolve => {
            const check = () => {
                const el = document.querySelector(selector)
                if (el) {
                    resolve(el)
                    return true
                }
                return false
            }

            if (check()) return

            const timer = setInterval(() => {
                if (check()) clearInterval(timer)
            }, 200)

            setTimeout(() => {
                clearInterval(timer)
                resolve(null)
            }, timeout)
        })
    },

    // ===================== 6. 图片上传模块（完整版） =====================

    // URL 转 File 对象（支持代理下载）
    async urlToFile(url: string, filename = "image.jpg"): Promise<File> {
        const BACKEND_URL = (window as any).PLASMO_PUBLIC_BACKEND_URL || 'http://localhost:3000'

        this.log("📥 下载图片:", url.substring(0, 80) + "...")

        try {
            // 方法1：直接下载（适用于无防盗链的图片）
            let res = await fetch(url, {
                mode: 'cors',
                headers: {
                    'Referer': url  // 设置 referer 绕过部分防盗链
                }
            })

            if (res.ok) {
                const blob = await res.blob()
                this.log("✅ 直接下载成功，大小:", blob.size)
                return new File([blob], filename, { type: blob.type || 'image/jpeg' })
            }
        } catch (e) {
            this.log("直接下载失败，尝试代理...")
        }

        try {
            // 方法2：通过后端代理下载（使用 POST 返回 base64）
            const proxyUrl = `${BACKEND_URL}/api/image-proxy`
            const res = await fetch(proxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            })

            if (res.ok) {
                const data = await res.json()
                // 后端返回的字段是 data，不是 base64
                if (data.data) {
                    const blob = this.base64ToBlob(data.data)
                    this.log("✅ 代理下载成功，大小:", blob.size)
                    return new File([blob], filename, { type: blob.type || 'image/jpeg' })
                }
            }
        } catch (e) {
            this.log("代理下载也失败:", e)
        }

        // 方法3：生成空白占位图（兜底）
        this.warn("⚠️ 图片下载失败，使用占位图:", url.substring(0, 50))
        const canvas = document.createElement('canvas')
        canvas.width = 800
        canvas.height = 800
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#f0f0f0'
        ctx.fillRect(0, 0, 800, 800)
        ctx.fillStyle = '#999'
        ctx.font = '24px Arial'
        ctx.textAlign = 'center'
        ctx.fillText('图片加载失败', 400, 400)

        const dataUrl = canvas.toDataURL('image/jpeg')
        const blob = this.base64ToBlob(dataUrl)
        return new File([blob], filename, { type: 'image/jpeg' })
    },

    // Base64 转 Blob（兼容老方法）
    base64ToBlob(base64: string): Blob {
        const arr = base64.split(',')
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
        const bstr = atob(arr[1])
        let n = bstr.length
        const u8arr = new Uint8Array(n)
        while (n--) u8arr[n] = bstr.charCodeAt(n)
        return new Blob([u8arr], { type: mime })
    },

    // 上传图片到政采云（万能 uploader）
    async uploadFileToZCY(uploadRow: Element, file: File): Promise<boolean> {
        const input = uploadRow.querySelector("input[type='file']") as HTMLInputElement
        if (!input) {
            this.warn("未找到文件上传 input")
            return false
        }

        const dt = new DataTransfer()
        dt.items.add(file)
        input.files = dt.files

        input.dispatchEvent(new Event("change", { bubbles: true }))
        return true
    },

    // 上传主图（支持 URL 数组）- 简化版
    async uploadMainImages(imageUrls: string[]): Promise<void> {
        if (!imageUrls || imageUrls.length === 0) {
            this.log("📸 无主图需要上传")
            return
        }

        this.log("📸 开始上传主图...", imageUrls.length, "张")

        // 等待上传区域出现
        let uploadInput: HTMLInputElement | null = null

        for (let retry = 0; retry < 10; retry++) {
            // 直接找所有 file input
            const allInputs = document.querySelectorAll('input[type="file"]')
            this.log(`找到 ${allInputs.length} 个 file input`)

            for (const input of allInputs) {
                if ((input as HTMLInputElement).offsetParent !== null) {
                    uploadInput = input as HTMLInputElement
                    break
                }
            }

            if (uploadInput) break
            await sleep(500)
        }

        if (!uploadInput) {
            this.warn("❌ 未找到图片上传区域")
            return
        }

        this.log("✅ 找到上传区域，开始上传...")

        // 逐张上传（政采云通常每次只能上传一张）
        for (let i = 0; i < imageUrls.length; i++) {
            try {
                const url = imageUrls[i]
                if (!url) continue

                this.log(`📤 下载并上传第 ${i + 1} 张图片...`)
                const file = await this.urlToFile(url, `zcy_main_${Date.now()}_${i}.jpg`)

                const dt = new DataTransfer()
                dt.items.add(file)
                uploadInput.files = dt.files
                uploadInput.dispatchEvent(new Event('change', { bubbles: true }))

                // 等待上传完成
                await sleep(1500)
                this.log(`✅ 第 ${i + 1} 张主图上传完成`)
            } catch (e) {
                this.warn(`主图上传失败 (${i + 1}):`, e)
            }
        }

        this.log("✅ 主图上传全部完成")
    },

    // 上传详情图
    async uploadDetailImages(imageUrls: string[]): Promise<void> {
        this.log("📝 开始上传详情图...", imageUrls.length, "张")

        const area = document.querySelector('.detail-image-upload .el-upload, .goods-detail-upload .el-upload')
        if (!area) {
            this.warn("未找到详情图上传区域")
            return
        }

        for (let i = 0; i < imageUrls.length; i++) {
            try {
                const file = await this.urlToFile(imageUrls[i], `detail_${i}.jpg`)
                await this.uploadFileToZCY(area, file)
                await sleep(800)
                this.log("✅ 详情图上传:", i + 1)
            } catch (e) {
                this.warn("详情图上传失败:", i, e)
            }
        }

        this.log("✅ 详情图上传完成")
    },

    // 上传 SKU 图片（根据 SKU 名称匹配）
    async uploadSKUImages(skuImagesMap: Record<string, string>): Promise<void> {
        this.log("🏷 上传 SKU 图片...", Object.keys(skuImagesMap).length, "个")

        const skuRows = [...document.querySelectorAll('.sku-row, .sku-item-row, [class*="sku-item"]')]
        if (!skuRows.length) {
            this.warn("找不到 SKU 区域")
            return
        }

        for (const row of skuRows) {
            // 获取 SKU 名称
            const skuText = (row as HTMLElement).innerText

            // 查找匹配的 SKU 图片
            for (const [skuName, imageUrl] of Object.entries(skuImagesMap)) {
                if (skuText.includes(skuName)) {
                    const uploadArea = row.querySelector('.el-upload, input[type="file"]')
                    if (!uploadArea) continue

                    try {
                        const file = await this.urlToFile(imageUrl, `${skuName}.jpg`)
                        await this.uploadFileToZCY(uploadArea.closest('.el-upload') || row, file)
                        await sleep(500)
                        this.log("✅ SKU图片上传:", skuName)
                    } catch (e) {
                        this.warn("SKU图片上传失败:", skuName, e)
                    }
                    break
                }
            }
        }

        this.log("✅ SKU 图片上传完成")
    },

    // ===================== 7. SKU 填写模块（完整版） =====================

    // 填写 SKU 规格组
    async fillSkuSpecs(specGroups: Array<{ name: string; values: string[] }>): Promise<void> {
        this.log("🧩 开始填写 SKU 规格...", specGroups.length, "组")

        for (const group of specGroups) {
            // 点击添加规格组按钮
            const groupBtn = document.querySelector('.add-sku-group-btn, [class*="add-spec"], button:contains("添加规格")') as HTMLElement
            if (groupBtn) {
                groupBtn.click()
                await sleep(500)
            }

            // 填写规格名称
            const groupInput = document.querySelector('.sku-group-name input, .spec-name input') as HTMLInputElement
            if (groupInput) {
                groupInput.value = group.name
                groupInput.dispatchEvent(new Event("input", { bubbles: true }))
            }

            // 添加规格值
            for (const val of group.values) {
                const valBtn = document.querySelector('.add-sku-value-btn, [class*="add-value"]') as HTMLElement
                if (valBtn) {
                    valBtn.click()
                    await sleep(300)
                }

                const inputs = document.querySelectorAll('.sku-value-row input, .spec-value input')
                const input = inputs[inputs.length - 1] as HTMLInputElement
                if (input) {
                    input.value = val
                    input.dispatchEvent(new Event("input", { bubbles: true }))
                }
            }

            await sleep(300)
        }

        this.log("✅ SKU 规格填写完成")
    },

    // 填写 SKU 价格/库存/编码
    async fillSKUData(skuList: Array<{ code?: string; stock?: number; price?: number }>): Promise<void> {
        this.log("🧩 开始填写 SKU 数据...", skuList.length, "个")

        const table = await this.waitForAppear(".sku-table, .el-table, [class*='sku']")
        if (!table) {
            this.warn("未找到 SKU 表格")
            return
        }

        const rows = [...table.querySelectorAll(".el-table__row, tr, .sku-row")]

        for (let i = 0; i < rows.length && i < skuList.length; i++) {
            const rowEl = rows[i]
            const sku = skuList[i]
            if (!sku) continue

            const inputs = rowEl.querySelectorAll("input")

            // 根据 placeholder 或位置填写
            inputs.forEach((inp: HTMLInputElement) => {
                const placeholder = inp.placeholder?.toLowerCase() || ''

                if ((placeholder.includes('价格') || placeholder.includes('price')) && sku.price !== undefined) {
                    inp.value = String(sku.price)
                    inp.dispatchEvent(new Event("input", { bubbles: true }))
                }
                else if ((placeholder.includes('库存') || placeholder.includes('stock')) && sku.stock !== undefined) {
                    inp.value = String(sku.stock)
                    inp.dispatchEvent(new Event("input", { bubbles: true }))
                }
                else if ((placeholder.includes('sku') || placeholder.includes('编码') || placeholder.includes('code')) && sku.code) {
                    inp.value = sku.code
                    inp.dispatchEvent(new Event("input", { bubbles: true }))
                }
            })

            await sleep(200)
        }

        this.log("✅ SKU 数据填写完成")
    },
    // ===================== 8. 智能产地选择器 v3.0 =====================

    // 获取目标产地信息（使用统一的品牌企业库）
    getOrigin(scraped: any): { province: string; city: string; district: string } {
        // 1. 优先：采集数据含产地字段
        if (scraped.origin && typeof scraped.origin === 'object') return scraped.origin;

        // 2. 从统一的品牌企业库获取地址
        const brand = scraped.brand || "";
        const brandInfo = getBrandCompanyInfo(brand);
        if (brandInfo) {
            this.log(`🌍 使用品牌库产地：${brand} -> ${brandInfo.province}/${brandInfo.city}/${brandInfo.district}`)
            return {
                province: brandInfo.province,
                city: brandInfo.city,
                district: brandInfo.district
            };
        }

        // 3. 标题推断
        const title = scraped.title || "";
        if (title.includes("深圳")) return { province: "广东省", city: "深圳市", district: "宝安区" };
        if (title.includes("杭州")) return { province: "浙江省", city: "杭州市", district: "滨江区" };
        if (title.includes("上海")) return { province: "上海市", city: "上海市", district: "浦东新区" };
        if (title.includes("北京")) return { province: "北京市", city: "北京市", district: "海淀区" };
        if (title.includes("广州")) return { province: "广东省", city: "广州市", district: "天河区" };

        // 4. 最终兜底（安全地址）
        this.log(`🌍 使用兜底产地：浙江省/宁波市/镇海区`)
        return { province: "浙江省", city: "宁波市", district: "镇海区" };
    },

    // 查找并点击级联菜单节点
    async clickCascaderNode(text: string): Promise<boolean> {
        // 使用 XPath 查找包含文本的菜单项，政采云的级联菜单项通常在 li 中
        const xpath = `//li[contains(@class,'doraemon-cascader-menu-item') and contains(., '${text}')]`;

        // 尝试多次查找，因为菜单加载有动画延迟
        for (let i = 0; i < 10; i++) {
            const el = document.evaluate(xpath, document.body, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement;
            if (el && el.offsetParent !== null) { // 确保可见
                el.click();
                this.log(`🖱️ 点击级联菜单: ${text}`);
                await sleep(200);
                return true;
            }
            await sleep(100);
        }

        this.warn(`[Origin Selector] 未找到或无法点击节点: ${text}`);
        return false;
    },

    // 执行产地选择
    async fillOrigin(scraped: any): Promise<void> {
        this.log("🌍 开始智能填写产地/制造商区域...");

        // 1. 找到输入框：通常在 "制造商所在区域" 行
        // 我们查找 class 包含 cascader 的输入框，或者根据 label 查找
        let triggerInput: HTMLElement | null = null;

        const rows = document.querySelectorAll('.el-form-item, .doraemon-form-item, .sku-row');
        for (const row of rows) {
            const label = (row as HTMLElement).innerText;
            if (label.includes("制造商所在区域") || (label.includes("产地") && row.querySelector('.doraemon-cascader-picker'))) {
                triggerInput = row.querySelector('.doraemon-cascader-picker input, .el-cascader input') as HTMLElement;
                if (triggerInput) break;
            }
        }

        if (!triggerInput) {
            triggerInput = document.querySelector('.doraemon-cascader-picker input') as HTMLElement; // 尝试盲找第一个
        }

        if (!triggerInput) {
            this.warn("未找到产地选择器输入框");
            return;
        }

        // 2. 获取目标地址
        const origin = this.getOrigin(scraped);
        this.log(`🎯 目标产地: ${origin.province} / ${origin.city} / ${origin.district}`);

        // 3. 点击输入框打开下拉
        triggerInput.click();
        await sleep(500);

        // 4. 依次点击 省 -> 市 -> 区
        if (await this.clickCascaderNode(origin.province)) {
            await sleep(300); // 等待下一级加载
            if (await this.clickCascaderNode(origin.city)) {
                await sleep(300);
                await this.clickCascaderNode(origin.district);
            }
        }

        // 点击页面空白处收起菜单（如果没自动收起）
        document.body.click();
        this.log("✅ 智能产地填写完成");
    }
}

    // 暴露到 window
    ; (window as any).AutoFillAIEngine = AutoFillAIEngine
