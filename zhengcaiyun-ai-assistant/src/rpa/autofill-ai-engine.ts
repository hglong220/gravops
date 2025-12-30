// ===================== AutoFill AI Engine =====================
// 扫描字段 → 生成schema → 调AI/规则引擎 → 按plan自动填写
import { VisionBridge } from "../lib/vision-bridge"
import { apiProxy } from "../utils/api-proxy"
import { getStoredLicense } from "../utils/license"

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

// UI 状态检测
function isModalOpen(): boolean {
    return !!document.querySelector('.doraemon-modal');
}

async function waitForUIIdle(timeout = 5000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const detailLock = (window as any)._detailUploading;
        if (!isModalOpen() && !detailLock) return true;
        await sleep(120);
    }
    return false;
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
    action: 'input' | 'select' | 'skip' | 'searchAndClick'  // searchAndClick: 品牌/型号专用
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
        companyName: `${cleanBrand} 科技有限公司`,
        province: "浙江省",
        city: "宁波市",
        district: "镇海区",
        scale: "中型企业"
    }
}

// 异步查询品牌企业信息（从后端 API）
async function fetchBrandCompanyInfo(brand: string): Promise<BrandCompanyInfo | null> {
    const BACKEND_URL =
        (window as any).PLASMO_PUBLIC_BACKEND_URL ||
        localStorage.getItem('BACKEND_URL') ||
        'http://localhost:3000'

    if (!BACKEND_URL) return null

    try {
        const response = await fetch(`${BACKEND_URL} /api/brand - company ? brand = ${encodeURIComponent(brand)} `, {
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
    /** 
     * 获取后端 URL（支持缓存）
     */
    async getBackendUrl(): Promise<string> {
        // 优先从 window 获取（如果由 content script 注入过）
        if ((window as any).PLASMO_PUBLIC_BACKEND_URL) {
            return (window as any).PLASMO_PUBLIC_BACKEND_URL;
        }

        // 其次尝试从 chrome.storage 获取
        return new Promise(resolve => {
            chrome.storage.local.get(['apiUrl'], result => {
                const url = result.apiUrl || process.env.PLASMO_PUBLIC_BACKEND_URL || 'http://localhost:3000';
                // 存入 window 下次直取
                (window as any).PLASMO_PUBLIC_BACKEND_URL = url;
                resolve(url);
            });
        });
    },

    log(...args: any[]) {
        console.log("[AUTO_FILL_AI]", ...args)
    },

    warn(...args: any[]) {
        console.warn("[AUTO_FILL_AI]", ...args)
    },

    // 从字符串中提取关键词（用于模糊匹配）
    extractKeywords(value: string): string[] {
        if (!value) return []

        const keywords: string[] = []

        // 常见品牌关键词
        const brandPatterns = [
            /惠普|HP/gi, /联想|Lenovo/gi, /戴尔|Dell/gi,
            /华为|Huawei/gi, /小米|Xiaomi/gi, /三星|Samsung/gi,
            /佳能|Canon/gi, /爱普生|Epson/gi, /兄弟|Brother/gi,
            /华硕|ASUS/gi, /宏碁|Acer/gi, /索尼|Sony/gi,
            /松下|Panasonic/gi, /理光|Ricoh/gi, /柯尼卡|Konica/gi,
            /东芝|Toshiba/gi, /希捷|Seagate/gi, /西数|WD/gi,
            /奔图|Pantum/gi, /得力|Deli/gi, /震旦|Aurora/gi
        ]

        for (const pattern of brandPatterns) {
            const match = value.match(pattern)
            if (match) {
                keywords.push(match[0])
            }
        }

        // 提取中文词汇（2-4个字的词）
        const chineseWords = value.match(/[\u4e00-\u9fa5]{2,4}/g) || []
        // 过滤掉常见无意义词
        const stopWords = ['中国', '有限', '公司', '股份', '集团', '科技', '电子', '信息', '技术']
        for (const word of chineseWords) {
            if (!stopWords.includes(word) && !keywords.includes(word)) {
                keywords.push(word)
            }
        }

        // 提取英文品牌词（全大写或首字母大写）
        const englishWords = value.match(/[A-Z][A-Za-z]+|[A-Z]{2,}/g) || []
        for (const word of englishWords) {
            if (!keywords.includes(word)) {
                keywords.push(word)
            }
        }

        return keywords.slice(0, 5) // 最多返回5个关键词
    },

    // ===================== 品牌/型号专用选择器 =====================
    // 输入 → 等待下拉 → 点击选择（确保 100% 正确）

    /**
     * 填写品牌（带搜索的下拉框）
     * @param brandValue 品牌名称，如 "惠普/HP"
     */
    async fillBrand(brandValue: string): Promise<boolean> {
        this.log("🏷️ [品牌选择] 开始填写品牌:", brandValue)
        return await this.fillSearchableDropdown("品牌", brandValue)
    },

    /**
     * 填写型号（带搜索的下拉框）
     * @param modelValue 型号名称，如 "M233dw"
     */
    async fillModel(modelValue: string): Promise<boolean> {
        this.log("🔖 [型号选择] 开始填写型号:", modelValue)
        return await this.fillSearchableDropdown("型号", modelValue)
    },

    /**
     * 通用的带搜索下拉框填写
     * @param fieldLabel 字段标签（品牌/型号）
     * @param value 要填写的值
     */
    async fillSearchableDropdown(fieldLabel: string, value: string): Promise<boolean> {
        if (!value) {
            this.warn(`[${fieldLabel}]值为空，跳过`)
            return false
        }

        // 1. 找到字段的输入框
        const labelEls = document.querySelectorAll('.doraemon-form-item-label, .el-form-item__label, label')
        let targetRow: HTMLElement | null = null

        for (const label of labelEls) {
            if (label.textContent?.includes(fieldLabel)) {
                targetRow = label.closest('.doraemon-form-item, .el-form-item, .doraemon-row') as HTMLElement
                break
            }
        }

        if (!targetRow) {
            this.warn(`[${fieldLabel}]未找到字段，尝试全局搜索...`)
            // 尝试用 placeholder 搜索
            const input = document.querySelector(`input[placeholder *= "${fieldLabel}"], input[placeholder *= "${fieldLabel === '品牌' ? '请选择' : '请输入'}"]`) as HTMLInputElement
            if (input) {
                targetRow = input.closest('.doraemon-form-item, .el-form-item') as HTMLElement
            }
        }

        if (!targetRow) {
            this.warn(`[${fieldLabel}]未找到字段行`)
            return false
        }

        // 2. 找到输入框
        const input = targetRow.querySelector('input:not([type="hidden"]):not([type="file"])') as HTMLInputElement
        if (!input) {
            this.warn(`[${fieldLabel}]未找到输入框`)
            return false
        }

        this.log(`[${fieldLabel}]找到输入框: `, input.placeholder)

        // 3. 点击激活输入框
        input.scrollIntoView({ behavior: 'smooth', block: 'center' })
        await sleep(200)
        input.click()
        input.focus()
        await sleep(200)

        // 4. 清空并输入值
        input.value = ''
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
        if (nativeSetter) {
            nativeSetter.call(input, value)
        } else {
            input.value = value
        }
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
        input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }))

        this.log(`[${fieldLabel}]已输入: ${value}，等待下拉列表...`)
        await sleep(800)  // 等待搜索结果加载

        // 5. 等待下拉列表出现并点击匹配项
        let clicked = false
        for (let attempt = 0; attempt < 10; attempt++) {
            // 查找下拉列表选项
            const dropdownItems = document.querySelectorAll(
                '.el-select-dropdown__item, ' +
                '.doraemon-select-dropdown-menu-item, ' +
                '.el-autocomplete-suggestion li, ' +
                '.el-scrollbar__view li'
            )

            for (const item of dropdownItems) {
                const itemText = (item as HTMLElement).innerText.trim()
                // 模糊匹配：选项包含输入值，或输入值包含选项
                if (itemText && (itemText.includes(value) || value.includes(itemText) ||
                    itemText.toUpperCase().includes(value.toUpperCase()))) {
                    this.log(`[${fieldLabel}] ✓ 找到匹配项: ${itemText} `)
                        ; (item as HTMLElement).click()
                    clicked = true
                    break
                }
            }

            if (clicked) break
            await sleep(300)
        }

        if (!clicked) {
            // 尝试直接选择第一个有效选项
            const firstOption = document.querySelector(
                '.el-select-dropdown__item:not(.is-disabled), ' +
                '.doraemon-select-dropdown-menu-item:not(.is-disabled)'
            ) as HTMLElement

            if (firstOption && firstOption.innerText.trim()) {
                this.log(`[${fieldLabel}] ⚠️ 未找到精确匹配，选择第一个选项: ${firstOption.innerText.trim()} `)
                firstOption.click()
                clicked = true
            }
        }

        if (!clicked) {
            this.warn(`[${fieldLabel}] ✗ 未找到下拉选项，可能需要手动选择`)
            // 关闭下拉框
            document.body.click()
            return false
        }

        await sleep(300)
        this.log(`[${fieldLabel}] ✓ 选择完成`)
        return true
    },

    /**
     * 填写品牌和型号（一键完成）
     */
    async fillBrandAndModel(brand: string, model: string): Promise<{ brandOk: boolean; modelOk: boolean }> {
        this.log("🎯 ========== 开始填写品牌和型号 ==========")

        const brandOk = await this.fillBrand(brand)
        await sleep(500)
        const modelOk = await this.fillModel(model)

        this.log("🎯 ========== 品牌/型号填写完成 ==========")
        this.log(`   品牌: ${brandOk ? '✓' : '✗'} | 型号: ${modelOk ? '✓' : '✗'} `)

        return { brandOk, modelOk }
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
                row.querySelector("[class*='select']") ||
                row.querySelector(".ant-select")

            // Radio 类型（单选）
            const radioGroup =
                row.querySelector(".el-radio-group") ||
                row.querySelector(".doraemon-radio-group") ||
                row.querySelector("[class*='radio-group']") ||
                row.querySelector(".ant-radio-group") ||
                row.querySelector(".el-radio") || // 直接有 radio 也可以
                row.querySelector(".doraemon-radio")

            // Checkbox 类型（多选）
            const checkboxGroup =
                row.querySelector(".el-checkbox-group") ||
                row.querySelector(".doraemon-checkbox-group") ||
                row.querySelector("[class*='checkbox-group']") ||
                row.querySelector(".ant-checkbox-group")

            // Cascader 类型（级联选择器，如产地）
            const cascader =
                row.querySelector(".el-cascader") ||
                row.querySelector(".doraemon-cascader-picker") ||
                row.querySelector(".ant-cascader-picker")

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

        // ⭐⭐ 输出所有必填字段详情（调试用）⭐⭐
        this.log("📋 必填字段列表:")
        fields.filter(f => f.required).forEach((f, i) => {
            this.log(`  [${i + 1}] ${f.label} (${f.controlType})${f.optionsPreview.length ? ' 选项:' + f.optionsPreview.slice(0, 3).join('/') : ''} `)
        })

        return fields
    },

    // ===================== 2. 生成填写计划（增强版规则引擎） =====================
    generatePlan(productInfo: ProductInfo, fields: FieldSchema[]): FillPlan[] {
        const specs = productInfo.specs || {}
        const brand = productInfo.brand || specs['品牌'] || ''
        const model = productInfo.model || specs['型号'] || specs['商品型号'] || ''

        // 价格计算：市场价 = 采集价（或 SKU 价），销售价 = 市场价 × 0.92（下浮 8%）
        let basePrice =
            productInfo.price ||
            parseFloat(specs['价格'] || specs['市场价'] || specs['销售价'] || '0') ||
            (productInfo as any).skuData?.[0]?.price ||
            0
        if (Number.isNaN(basePrice)) basePrice = 0
        const marketPrice = basePrice > 0 ? Math.round(basePrice * 100) / 100 : 0
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
                this.log(`🏭 制造商：${brand} -> ${companyName} `)
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
                    this.log(`📏 计量单位智能推断：${title.substring(0, 20)}... -> ${unit} `)
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
                    this.log(`📝 智能选择：${l} -> ${bestOption} `)
                }
                // 3. 如果是 input 类型，尝试从 specs 模糊匹配
                else if (f.controlType === "input") {
                    // 尝试从 specs 中找相似的 key
                    for (const key of Object.keys(specs)) {
                        if (key.includes(l) || l.includes(key)) {
                            plan = { id: f.id, action: "input", value: specs[key] }
                            this.log(`📝 智能匹配 specs：${l} -> ${key} = ${specs[key]} `)
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
                        this.log(`📝 specs匹配：${field.label} -> ${specsValue} `)
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
                        this.log(`🎯 智能选择：${field.label} -> ${best} `)
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
                // ⭐ searchAndClick: 品牌/型号等带搜索的下拉框（AI 返回的 action）
                if (plan.action === 'searchAndClick' && plan.value) {
                    this.log(`🔍 执行 searchAndClick: ${field.label} = ${plan.value} `)
                    const ok = await this.fillSearchableDropdown(field.label, plan.value)
                    if (ok) success++
                    else fail++
                    continue
                }

                // ⭐ 兼容旧逻辑：品牌/型号字段即使 AI 返回 input/select，也使用 searchAndClick
                if ((/^品牌$/.test(field.label) || /^型号$/.test(field.label)) && plan.value) {
                    this.log(`🏷️ 检测到 ${field.label} 字段，强制使用 searchAndClick`)
                    const ok = await this.fillSearchableDropdown(field.label, plan.value)
                    if (ok) success++
                    else fail++
                    continue
                }

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
                    this.log(`🤖 AI 建议：${field.label} -> ${suggestion.value} `)
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
            // 支持多种选择器 - 但要避免选到导航菜单
            let allOptions = document.querySelectorAll(
                ".el-select-dropdown__item:not(.is-disabled), " +
                ".doraemon-select-dropdown-menu-item:not(.is-disabled), " +
                ".el-scrollbar__view li:not([class*='nav']):not([class*='menu-item'])"
            )

            // 如果找不到，尝试更宽泛但仍然安全的选择器
            if (allOptions.length === 0) {
                allOptions = document.querySelectorAll(
                    ".el-select-dropdown li, " +
                    ".el-popper li, " +
                    ".doraemon-select-dropdown li"
                )
            }

            // ⚠️ 过滤掉可能是链接的选项
            allOptions = Array.from(allOptions).filter(opt => {
                const el = opt as HTMLElement
                const text = el.innerText.trim()
                // 排除包含"中心"、"管理"等可能是导航链接的选项
                const dangerousKeywords = ['中心', '管理', '面板', '概览', '首页', 'dashboard']
                const isDangerous = dangerousKeywords.some(k => text.toLowerCase().includes(k))
                // 排除包含链接的选项
                const hasLink = el.querySelector('a') !== null
                return !isDangerous && !hasLink
            }) as unknown as NodeListOf<Element>

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

            // 包含匹配（双向）
            if (!optionEl) {
                for (const opt of allOptions) {
                    const t = (opt as HTMLElement).innerText.trim()
                    if (t && value && (t.includes(value) || value.includes(t))) {
                        optionEl = opt as HTMLElement
                        break
                    }
                }
            }

            // ⭐⭐ 增强：关键词匹配 ⭐⭐
            // 提取 value 中的关键词进行匹配
            if (!optionEl && value) {
                // 提取品牌关键词（如"中国惠普有限公司" -> "惠普"）
                const keywords = this.extractKeywords(value)
                this.log("关键词提取:", value, "->", keywords)

                for (const keyword of keywords) {
                    for (const opt of allOptions) {
                        const t = (opt as HTMLElement).innerText.trim()
                        if (t.includes(keyword)) {
                            optionEl = opt as HTMLElement
                            this.log("关键词匹配成功:", keyword, "->", t)
                            break
                        }
                    }
                    if (optionEl) break
                }
            }

            // ⭐⭐ 增强：智能选择第一个非空选项（仅限必填字段） ⭐⭐
            if (!optionEl && field.required && optTexts.length > 0) {
                // 对于制造商/生产厂商类字段，尝试智能匹配
                if (/制造商|生产厂商|厂商|供应商/.test(field.label)) {
                    // 优先选择包含品牌关键词的选项
                    const brandKeywords = ['惠普', 'HP', '联想', 'Lenovo', '戴尔', 'Dell', '华为', '小米', '三星', '佳能', '爱普生', '兄弟', 'Brother']
                    for (const keyword of brandKeywords) {
                        if (value.includes(keyword)) {
                            for (const opt of allOptions) {
                                const t = (opt as HTMLElement).innerText.trim()
                                if (t.includes(keyword)) {
                                    optionEl = opt as HTMLElement
                                    this.log("品牌匹配:", keyword, "->", t)
                                    break
                                }
                            }
                            if (optionEl) break
                        }
                    }
                }

                // ⚠️ 禁用兜底选择 - 之前这里选到了链接导致页面跳转
                // 如果没有匹配到任何选项，直接跳过该字段，不要随意选择
                // if (!optionEl) {
                //     for (const opt of allOptions) {
                //         const t = (opt as HTMLElement).innerText.trim()
                //         if (t && t !== '请选择' && t !== '--' && t !== '' && !t.includes('协议中心')) {
                //             optionEl = opt as HTMLElement
                //             this.log("兜底选择第一个有效选项:", t)
                //             break
                //         }
                //     }
                // }
            }

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

        // 如果到这里还是未知，最后兜底尝试
        const firstInput = row.querySelector("input:not([type='hidden'])") as HTMLInputElement
        if (firstInput) {
            this.log("⚠️ 未知类型但找到输入框，尝试填写:", field.label)
            firstInput.value = value
            dispatchInputLikeEvents(firstInput)
            return true
        }

        const firstRadio = row.querySelector(".el-radio, .doraemon-radio-wrapper, .ant-radio-wrapper") as HTMLElement
        if (firstRadio) {
            this.log("⚠️ 未知类型但找到 Radio，尝试点击第一个匹配项:", field.label)
            const radios = row.querySelectorAll(".el-radio, .doraemon-radio-wrapper, .ant-radio-wrapper")
            const target = Array.from(radios).find(r => (r as HTMLElement).innerText.includes(value)) as HTMLElement
            if (target) {
                target.click()
                return true
            }
        }

        this.warn("未知控件类型且无法兜底：", field.label, controlType)
        return false
    },

    // ===================== 4. 调用后端AI获取填写计划 =====================
    async fetchAIPlan(productInfo: ProductInfo, fields: FieldSchema[]): Promise<FillPlan[] | null> {
        const BACKEND_URL = await this.getBackendUrl();

        if (!BACKEND_URL) {
            this.warn("⚠️ [AI] 无法获取 BACKEND_URL，跳过 AI 分析");
            return null
        }

        // 只发送必填项给 AI，减少处理量
        const requiredFields = fields.filter(f => f.required)

        try {
            this.log("调用后端 AI 获取填写计划...", BACKEND_URL)
            this.log("总字段:", fields.length, "必填项:", requiredFields.length)

            const license = await getStoredLicense();
            const response = await apiProxy(`${BACKEND_URL}/api/autofill-plan`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${license?.licenseKey || ''}`
                },
                body: {
                    productInfo,
                    fields: requiredFields.map(f => ({
                        id: f.id,
                        label: f.label,
                        required: f.required,
                        controlType: f.controlType,
                        optionsPreview: f.optionsPreview
                    }))
                }
            })

            if (!response.ok) {
                this.warn("AI API 返回错误:", response.status, response.error)
                return null
            }

            const data = response.data
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
        const BACKEND_URL = (window as any).PLASMO_PUBLIC_BACKEND_URL || ''

        if (!BACKEND_URL) return null

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

    // ===================== 5. 主入口（混合模式） =====================
    // ===================== 5. 主入口（混合模式） =====================
    async run(productInfo: ProductInfo, cachedAttributes?: Record<string, string>): Promise<{ success: number; fail: number; attributes?: Record<string, string> }> {
        this.log("🚀 AutoFill AI Engine 启动，商品：", productInfo.title)
        const BACKEND_URL = await this.getBackendUrl();
        this.log("🛰️ 后端地址:", BACKEND_URL);

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

        // 结果字典，用于返回本次填写的最终内容
        const filledAttributes: Record<string, string> = {}

        // ========== 情况一：RPA 闪速模式 (如果有缓存记录) ==========
        let plans: FillPlan[] = []
        if (cachedAttributes) {
            this.log("🚀 [RPA 闪速模式] 正在应用缓存数据...")
            for (const field of fields) {
                // 根据 label 精确匹配缓存中的键
                if (cachedAttributes[field.label]) {
                    plans.push({
                        id: field.id,
                        action: field.controlType === 'input' ? 'input' : 'select',
                        value: cachedAttributes[field.label]
                    })
                    filledAttributes[field.label] = cachedAttributes[field.label]
                }
            }
            this.log(`🚀[RPA 闪速模式] 已从缓存加载 ${plans.length} 个字段方案`)
        }

        // ========== 情况二：混合模式 (如果缓存没覆盖全部必填项) ==========
        const coveredIds = new Set(plans.map(p => p.id))
        const remainingFields = fields.filter(f => f.required && !coveredIds.has(f.id))

        if (remainingFields.length > 0) {
            this.log(`📋 处理 ${remainingFields.length} 个非缓存 / 剩余必填字段`)

            let unmatchedFields: FieldSchema[] = remainingFields

            // 1. 如果有规则库，尝试查询
            if (BACKEND_URL) {
                try {
                    this.log("📚 查询规则库...")
                    const matchResult = await this.matchFieldRules(remainingFields)
                    if (matchResult) {
                        for (const result of matchResult.results) {
                            if (result.matched && result.rule) {
                                plans.push({
                                    id: result.fieldId,
                                    action: result.rule.action,
                                    value: result.rule.value
                                })
                                // 提取 label 供沉淀使用
                                const f = fields.find(i => i.id === result.fieldId)
                                if (f) filledAttributes[f.label] = result.rule.value
                            }
                        }
                        unmatchedFields = remainingFields.filter(f =>
                            matchResult.unmatchedFields.some((u: { id: string }) => u.id === f.id)
                        )
                    }
                } catch (e) {
                    this.warn("规则库查询失败:", e)
                }
            }

            // 2. 如果还有未知字段，调用 AI (Browser-use 视觉模式的核心：智能补全)
            if (unmatchedFields.length > 0 && BACKEND_URL) {
                this.log(`🤖 调用 AI 处理 ${unmatchedFields.length} 个未知字段...`)
                try {
                    const aiPlans = await this.fetchAIPlan(productInfo, unmatchedFields)
                    if (aiPlans && aiPlans.length > 0) {
                        plans = [...plans, ...aiPlans]
                        // 将 AI 的决定加入已填充列表
                        for (const p of aiPlans) {
                            const f = fields.find(i => i.id === p.id)
                            if (f) filledAttributes[f.label] = p.value
                        }
                        await this.saveAIRulesToLibrary(unmatchedFields, aiPlans)
                    }
                } catch (e) {
                    this.warn("AI 分析失败:", e)
                }
            }

            // 3. 兜底：本地规则引擎
            const finalCoveredIds = new Set(plans.map(p => p.id))
            const lastFields = remainingFields.filter(f => !finalCoveredIds.has(f.id))
            if (lastFields.length > 0) {
                const localPlans = this.generatePlan(productInfo, lastFields)
                plans = [...plans, ...localPlans]
                for (const p of localPlans) {
                    const f = fields.find(i => i.id === p.id)
                    if (f) filledAttributes[f.label] = p.value
                }
            }
        }

        this.log("📋 最终执行计划：", plans.filter(p => p.action !== 'skip').length, "个")

        // 3. 执行物理点击/填写
        const fillResult = await this.applyPlan(fields, plans, productInfo)

        this.log("🎉 AutoFill AI Engine 完成：", fillResult)

        return {
            ...fillResult,
            attributes: filledAttributes // 返回本次实际填充的属性字典，供 KnowledgeEngine 沉淀
        }
    },

    // ===================== 5.1 查询规则库 =====================
    async matchFieldRules(fields: FieldSchema[]): Promise<any | null> {
        const BACKEND_URL = await this.getBackendUrl();
        if (!BACKEND_URL) return null;

        try {
            const license = await getStoredLicense();
            const response = await apiProxy(`${BACKEND_URL}/api/field-rules/match`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${license?.licenseKey || ''}`
                },
                body: {
                    fields: fields.map(f => ({
                        id: f.id,
                        label: f.label,
                        controlType: f.controlType,
                        required: f.required,
                        optionsPreview: f.optionsPreview
                    }))
                }
            })

            if (!response.ok) {
                this.warn("规则库 API 返回错误:", response.status, response.error)
                return null
            }

            return response.data
        } catch (error) {
            this.warn("规则库 API 调用失败:", error)
            return null
        }
    },

    async saveAIRulesToLibrary(fields: FieldSchema[], plans: FillPlan[]): Promise<void> {
        const BACKEND_URL = await this.getBackendUrl();
        if (!BACKEND_URL) return

        try {
            const license = await getStoredLicense();
            await apiProxy(`${BACKEND_URL}/api/field-rules/save-ai`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${license?.licenseKey || ''}`
                },
                body: { fields, plans }
            });
            this.log(`✅ 已向后端同步 ${plans.length} 条 AI 填写建议`)
        } catch (e) {
            this.warn("沉淀 AI 规则失败:", e)
        }
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

    // 缩略图 URL → 原图 URL（京东/天猫/苏宁/政采云）
    normalizeImageUrl(url: string): string {
        if (!url) return url;

        let u = url.split('?')[0];

        // ===== 京东 JD =====
        if (u.includes('360buyimg.com') || u.includes('jdcdn.com')) {
            u = u.replace(/s\d+x\d+_/g, '')
                .replace(/!\d{2,}x\d{2,}\w*/g, '')
                .replace(/n\d+\/jfs/g, 'jfs')
                .replace(/\/mobile\//g, '/');
        }

        // ===== 天猫 / 淘宝 =====
        if (u.includes('alicdn.com')) {
            u = u.replace(/_(\d+x\d+).*\.jpg$/, '.jpg')
                .replace(/_(\d+x\d+).*\.png$/, '.png')
                .replace(/\.(jpg|png)_\d+x\d+q\d+\.jpg$/, '.$1');
        }

        // ===== 苏宁 =====
        if (u.includes('suning') || u.includes('suningcdn')) {
            u = u.replace(/_\d+w_\d+h\.jpg$/, '.jpg')
                .replace(/@.*$/, '');
        }

        // ===== 政采云（pcpubliccms 缩略图）=====
        if (u.includes('pcpubliccms')) {
            u = u.replace(/s\d+x\d+_/g, '');
        }

        // ===== doraemon 静态资源 =====
        if (u.includes('doraemon')) {
            u = u.replace(/_\d+x\d+/, '');
        }

        return u;
    },

    // URL 转 File 对象（支持代理下载）
    async urlToFile(url: string, filename = "image.jpg"): Promise<File> {
        const BACKEND_URL = (window as any).PLASMO_PUBLIC_BACKEND_URL || ''

        // 先转换为原图 URL
        const normalizedUrl = this.normalizeImageUrl(url);
        if (normalizedUrl !== url) {
            this.log("🔄 缩略图转原图:", url.substring(0, 50), "→", normalizedUrl.substring(0, 50));
        }

        this.log("📥 下载图片:", normalizedUrl.substring(0, 80) + "...")

        try {
            // 方法1：直接下载（适用于无防盗链的图片）
            let res = await fetch(normalizedUrl, {
                mode: 'cors',
                headers: {
                    'Referer': normalizedUrl  // 设置 referer 绕过部分防盗链
                }
            })

            if (res.ok) {
                const blob = await res.blob()
                this.log("✅ 直接下载成功，大小:", blob.size)
                const file = new File([blob], filename, { type: blob.type || 'image/jpeg' })
                // 确保图片至少 800x800（政采云要求）
                return await this.resizeImageToMinSize(file)
            }
        } catch (e) {
            this.log("直接下载失败，尝试代理...")
        }

        try {
            // 方法2：通过后端代理下载（使用 POST 返回 base64）
            if (!BACKEND_URL) throw new Error("无后端代理，跳过")
            const proxyUrl = `${BACKEND_URL}/api/image-proxy`
            const res = await fetch(proxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: normalizedUrl })
            })

            if (res.ok) {
                const data = await res.json()
                // 后端返回的字段是 data，不是 base64
                if (data.data) {
                    const blob = this.base64ToBlob(data.data)
                    this.log("✅ 代理下载成功，大小:", blob.size)
                    const file = new File([blob], filename, { type: blob.type || 'image/jpeg' })
                    // 确保图片至少 800x800（政采云要求）
                    return await this.resizeImageToMinSize(file)
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

    // 确保图片至少是 800x800（政采云要求）
    // 同时强制重新编码为纯 JPEG 格式，解决政采云"无法解析该文件"问题
    async resizeImageToMinSize(file: File, minWidth = 800, minHeight = 800): Promise<File> {
        return new Promise((resolve) => {
            const img = new Image()
            const url = URL.createObjectURL(file)

            img.onload = () => {
                URL.revokeObjectURL(url)

                const { width, height } = img

                // 计算需要放大的比例（保持宽高比）
                let newWidth = width
                let newHeight = height

                if (width < minWidth || height < minHeight) {
                    const scaleX = minWidth / width
                    const scaleY = minHeight / height
                    const scale = Math.max(scaleX, scaleY)
                    newWidth = Math.ceil(width * scale)
                    newHeight = Math.ceil(height * scale)
                    this.log(`📐 图片放大: ${width}x${height} → ${newWidth}x${newHeight} `)
                } else {
                    // 即使尺寸达标，也强制重新编码（解决格式问题）
                    this.log(`🔄 图片重新编码: ${width}x${height} (强制转换为标准JPEG)`)
                }

                // 使用 canvas 重新编码图片（关键！）
                const canvas = document.createElement('canvas')
                canvas.width = newWidth
                canvas.height = newHeight

                const ctx = canvas.getContext('2d')!
                // 使用高质量缩放
                ctx.imageSmoothingEnabled = true
                ctx.imageSmoothingQuality = 'high'
                // 填充白色背景（防止透明PNG问题）
                ctx.fillStyle = '#FFFFFF'
                ctx.fillRect(0, 0, newWidth, newHeight)
                ctx.drawImage(img, 0, 0, newWidth, newHeight)

                // 转换为纯 JPEG（政采云最可靠的格式）
                canvas.toBlob((blob) => {
                    if (blob) {
                        // 确保文件名以 .jpg 结尾
                        const fileName = file.name.replace(/\.[^.]+$/, '') + '.jpg'
                        const newFile = new File([blob], fileName, { type: 'image/jpeg' })
                        this.log(`✅ 转换完成: ${newFile.size} bytes`)
                        resolve(newFile)
                    } else {
                        this.warn('图片转换失败，使用原图')
                        resolve(file)
                    }
                }, 'image/jpeg', 0.92)  // 92% 质量
            }

            img.onerror = () => {
                URL.revokeObjectURL(url)
                this.warn('图片加载失败，使用原图')
                resolve(file)
            }

            img.src = url
        })
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

    // ===================== 完整版：图片上传与选择 =====================

    // 记录已上传的图片总数（用于主图/副图分配）
    _uploadedImageCount: 0,

    // 上传单张图片到素材库（弹窗必须已打开）
    async uploadSingleImageToMaterial(url: string, index: number): Promise<boolean> {
        this.log(`[IMG] 上传图片 ${index + 1}: `, url.substring(0, 60));

        try {
            // 找弹窗
            const modal = document.querySelector('.doraemon-modal') as HTMLElement | null;
            if (!modal) {
                this.warn("[IMG] 弹窗未找到");
                return false;
            }

            // 找文件上传 input
            let inp: HTMLInputElement | null = null;
            for (let r = 0; r < 30; r++) {
                inp = modal.querySelector('input[type="file"]') as HTMLInputElement | null;
                if (inp) break;
                await sleep(100);
            }
            if (!inp) {
                this.warn("[IMG] 未找到上传 input");
                return false;
            }

            // URL → File → 注入
            const file = await this.urlToFile(url, `img_${index}.jpg`);
            const dt = new DataTransfer();
            dt.items.add(file);
            inp.files = dt.files;
            inp.dispatchEvent(new Event('change', { bubbles: true }));

            this.log(`[IMG] 已注入文件 ${index + 1} `);

            // 等待上传完成（缩短超时：10次 x 400ms = 4秒）
            for (let wait = 0; wait < 10; wait++) {
                await sleep(400);
                // 检测图片数量是否增加
                const imgCards = modal.querySelectorAll('.item-img, .image-card, .img-wrapper, .doraemon-image-card');
                if (imgCards.length > index) {
                    this.log(`[IMG] 上传成功 ${index + 1}, 当前素材库共 ${imgCards.length} 张`);
                    return true;
                }
                // 检测错误
                const errorTip = document.querySelector('.ant-message-error, .doraemon-message-error');
                if (errorTip) {
                    this.warn(`[IMG] 上传出错 ${index + 1}: ${errorTip.textContent} `);
                    return false;
                }
            }

            this.warn(`[IMG] 上传超时 ${index + 1} `);
            return false;
        } catch (e) {
            this.warn(`[IMG] 上传异常 ${index + 1}: `, e);
            return false;
        }
    },

    // 选择素材库中指定范围的图片（多选）
    async selectImagesInRange(startIndex: number, endIndex: number, useTail = false): Promise<number> {
        this.log(`[IMG] 选择图片范围: ${startIndex + 1} ~${endIndex}${useTail ? " (尾部优先)" : ""} `);

        const modal = document.querySelector('.doraemon-modal') || document;
        const items = modal.querySelectorAll(
            '.img-border .item-img, .material-img-item, .img-wrapper, .doraemon-image-card'
        );

        this.log("[IMG] 素材库总图片数:", items.length);

        if (!items.length) {
            this.warn("[IMG] 素材库无图");
            return 0;
        }

        let selectedCount = 0;
        const total = items.length;
        let from = startIndex;
        let to = Math.min(endIndex, total);

        if (useTail) {
            to = total;
            from = Math.max(total - (endIndex - startIndex), 0);
        }

        for (let i = from; i < to; i++) {
            const target = items[i] as HTMLElement;
            if (!target) continue;

            (target.querySelector('img') as HTMLElement || target).click();
            this.log(`[IMG] 选中第 ${i + 1} 张`);
            selectedCount++;
            await sleep(150);
        }

        this.log(`[IMG] 共选中 ${selectedCount} 张`);
        return selectedCount;
    },

    // 点击确定按钮
    async clickConfirmButton(): Promise<boolean> {
        await sleep(300);
        const okBtn = (
            document.querySelector('.doraemon-modal-footer .doraemon-btn-primary') ||
            document.querySelector('.modal-footer .btn-primary') ||
            document.querySelector('button.doraemon-btn-primary')
        ) as HTMLElement;

        if (!okBtn) {
            this.warn("[IMG] 未找到确定按钮");
            return false;
        }

        okBtn.click();
        this.log("[IMG] 点击确定");
        await sleep(500);
        return true;
    },

    // 关闭弹窗
    async closeModal(): Promise<void> {
        const closeBtn = document.querySelector('.doraemon-modal-close, .modal-close') as HTMLElement;
        if (closeBtn) {
            closeBtn.click();
            await sleep(300);
        }
    },

    // 打开素材库弹窗（通过任意上传入口）
    async openMaterialModal(): Promise<boolean> {
        // 只用主图入口（第一个上传格）
        const mainSlot = document.querySelector('.upload-contain .image-upload .image-box') as HTMLElement;
        if (!mainSlot) {
            this.warn("[IMG] 找不到主图上传入口");
            return false;
        }

        mainSlot.click();
        this.log("[IMG] 点击主图上传入口，等待弹窗...");

        // 等待弹窗出现
        for (let i = 0; i < 50; i++) {
            const modal = document.querySelector('.doraemon-modal');
            if (modal) {
                this.log("[IMG] 弹窗已打开");
                await sleep(300);
                // 点击第一个文件夹（素材库列表里的第一个卡片或标题）
                const folderCard = modal.querySelector('.item-img, .folder-title') as HTMLElement;
                folderCard?.click();
                await sleep(300);
                return true;
            }
            await sleep(100);
        }

        this.warn("[IMG] 弹窗打开超时");
        return false;
    },

    // ========== 核心：一次性上传所有图片到素材库 ==========
    async uploadAllImagesToMaterial(imageUrls: string[]): Promise<number> {
        const MAX_TOTAL = 14;  // 最多上传14张（5主图+9副图）
        const urls = imageUrls.slice(0, MAX_TOTAL);

        this.log("[IMG] ========== 开始上传图片到素材库 ==========");
        this.log("[IMG] 待上传数量:", urls.length);

        // 打开弹窗
        if (!await this.openMaterialModal()) {
            return 0;
        }

        // 逐张上传
        let uploadedCount = 0;
        for (let i = 0; i < urls.length; i++) {
            const success = await this.uploadSingleImageToMaterial(urls[i], i);
            if (success) {
                uploadedCount++;
            }
            await sleep(300);
        }

        this.log(`[IMG] 上传完成: ${uploadedCount}/${urls.length} 张`);

        // 关闭弹窗（不选择图片，只是上传）
        await this.closeModal();

        // 记录已上传数量
        this._uploadedImageCount = uploadedCount;

        return uploadedCount;
    },

    // ========== 主图上传：使用主图入口一次性上传并选择全部 ==========
    async uploadMainImages(imageUrls: string[]): Promise<number> {
        this.log("[IMG] === 主图上传开始 ===");
        this.log("[IMG] 收到图片:", imageUrls?.length || 0, "张");

        if (!imageUrls || imageUrls.length === 0) {
            this.log("[IMG] 无主图需要上传");
            return 0;
        }

        // 取前 8 张（按需上传，不再区分主/副）
        const MAX_TOTAL = 8;
        const urls = imageUrls.slice(0, MAX_TOTAL);

        // 打开素材库弹窗（主图入口）
        if (!await this.openMaterialModal()) {
            this.warn("[IMG] 无法打开素材库");
            return 0;
        }

        // 逐张上传图片到素材库
        let uploadedCount = 0;
        for (let i = 0; i < urls.length; i++) {
            const success = await this.uploadSingleImageToMaterial(urls[i], i);
            if (success) uploadedCount++;
            await sleep(300);
        }

        this.log(`[IMG] 主图上传完成: ${uploadedCount}/${urls.length} 张`);

        if (uploadedCount === 0) {
            await this.closeModal();
            return 0;
        }

        // 选择第一页前 8 张（新上传默认在前面）
        const selectCount = Math.min(uploadedCount, 8);
        const selected = await this.selectImagesInRange(0, selectCount, false);
        await this.clickConfirmButton();

        // 记录数量
        this._uploadedImageCount = uploadedCount;
        this.log(`[IMG] === 主图上传结束: ${selected} 张已选 ===`);
        return selected;
    },

    // 打开富文本详情图上传弹窗（简化版 - 不依赖视觉AI）
    async openDetailUploadModal(): Promise<HTMLElement | null> {
        this.log("[DETAIL_IMG] 尝试打开详情图上传弹窗...");

        // 🔥 政采云 UEditor 的图片上传按钮选择器
        // 按钮结构通常是: div.edui-for-simpleuploadgoodsdetail > div.edui-button-body
        const buttonSelectors = [
            // 政采云专用的详情图上传按钮
            ".edui-for-simpleuploadgoodsdetail .edui-button-body",
            ".edui-for-simpleuploadgoodsdetail",
            // 通用图片上传按钮
            ".edui-for-simpleupload .edui-button-body",
            ".edui-for-simpleupload",
            ".edui-for-insertimage .edui-button-body",
            ".edui-for-insertimage",
            // 按 title 查找
            "[title='单图上传']",
            "[title='图片']",
            "[title='插入图片']",
        ];

        // 第一步：尝试用精确选择器找到并点击按钮
        let clicked = false;
        for (const selector of buttonSelectors) {
            const btn = document.querySelector(selector) as HTMLElement;
            if (btn && btn.offsetParent !== null) {
                this.log(`[DETAIL_IMG] 找到上传按钮: ${selector}`);
                btn.scrollIntoView({ behavior: "smooth", block: "center" });
                await sleep(200);
                btn.click();
                clicked = true;
                break;
            }
        }

        // 第二步：如果精确选择器失败，遍历所有 edui-box（工具栏按钮容器）
        if (!clicked) {
            this.log("[DETAIL_IMG] 精确选择器未命中，遍历工具栏按钮...");
            const allBoxes = document.querySelectorAll('.edui-box[id^="edui"]');
            for (const box of allBoxes) {
                const className = box.className || '';
                // 查找包含 simpleupload、insertimage、image 关键字的按钮
                if (className.includes('simpleupload') || className.includes('insertimage')) {
                    this.log(`[DETAIL_IMG] 遍历命中: ${className}`);
                    const body = box.querySelector('.edui-button-body') as HTMLElement || box as HTMLElement;
                    body.click();
                    clicked = true;
                    break;
                }
            }
        }

        if (!clicked) {
            this.warn("[DETAIL_IMG] 选择器未命中，启动视觉AI定位...");
            // 视觉AI作为备选方案
            try {
                const visionOk = await VisionBridge.performTask(
                    "点击编辑器工具栏上的'图片'或'单图上传'图标",
                    "当前处于详情图编辑区，需要点击工具栏上的上传图标（通常是一个山峰太阳或相框图标）"
                );
                if (visionOk) {
                    clicked = true;
                    this.log("[DETAIL_IMG] 视觉AI点击成功");
                }
            } catch (e) {
                this.warn("[DETAIL_IMG] 视觉AI调用失败:", e);
            }
        }

        if (!clicked) {
            this.warn("[DETAIL_IMG] 所有方法都未能找到上传按钮");
            return null;
        }

        // 等待弹窗出现
        this.log("[DETAIL_IMG] 已点击按钮，等待弹窗...");
        for (let i = 0; i < 40; i++) {
            const modal = document.querySelector(".doraemon-modal, .ant-modal, .edui-dialog") as HTMLElement | null;
            if (modal) {
                const hasUploadInput = modal.querySelector("input[type='file'], #goodsDetail-picture");
                const hasUploadText = modal.innerText?.includes('本地上传') ||
                    modal.innerText?.includes('图片上传') ||
                    modal.innerText?.includes('选择文件');
                if (hasUploadInput || hasUploadText) {
                    this.log("[DETAIL_IMG] 弹窗已打开");
                    await sleep(300);
                    return modal;
                }
            }
            await sleep(100);
        }

        this.warn("[DETAIL_IMG] 点击后弹窗未出现");
        return null;
    },

    // ========== 详情图上传到富文本（上传全部详情图）==========
    async uploadDetailImages(imageUrls: string[], skipCount = 0): Promise<number> {
        this.log("[DETAIL_IMG] 开始上传详情图...");

        // 确保 imageUrls 是数组
        if (!imageUrls || !Array.isArray(imageUrls)) {
            this.warn("[DETAIL_IMG] imageUrls 不是有效数组:", typeof imageUrls);
            return 0;
        }

        // 过滤图片：确保是有效的 URL 且不是超长字符串（除非是 data:image）
        const detailUrls = imageUrls.slice(skipCount).filter(url => {
            if (typeof url !== 'string') return false;
            if (url.startsWith('data:image')) return url.length < 5000000; // 5MB 限制
            if (url.length > 1000) return false; // 排除超长的普通 URL
            if (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('//')) {
                return true;
            }
            return false;
        });

        this.log(`[DETAIL_IMG] 详情图数量: ${detailUrls.length} 张（跳过主图 ${skipCount} 张，原始总计 ${imageUrls.length}）`);
        if (!detailUrls.length) {
            this.log("[DETAIL_IMG] 无有效详情图需要上传");
            return 0;
        }

        // 加锁，防止并发点击表单其他区域
        (this as any)._detailUploading = true;

        const modal = await this.openDetailUploadModal();
        if (!modal) {
            (this as any)._detailUploading = false;
            return 0;
        }

        // 文件 input
        let input: HTMLInputElement | null = null;
        for (let r = 0; r < 30; r++) {
            input = modal.querySelector("#goodsDetail-picture, input[type='file']") as HTMLInputElement | null;
            if (input) break;
            await sleep(100);
        }
        if (!input) {
            this.warn("[DETAIL_IMG] 未找到上传 input");
            return 0;
        }

        // 上传前的图片数量（使用上传列表中的缩略图）
        const countThumbs = () =>
            modal.querySelectorAll(
                ".doraemon-upload-list-item, .ant-upload-list-item, .img-border .item-img, .upload img"
            ).length;
        const beforeCount = countThumbs();

        // 一次性注入图片
        const dt = new DataTransfer();
        for (let i = 0; i < detailUrls.length; i++) {
            const file = await this.urlToFile(detailUrls[i], `detail_${i + 1}.jpg`);
            dt.items.add(file);
        }
        input.files = dt.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        this.log(`[DETAIL_IMG] 已一次性注入 ${detailUrls.length} 张`);

        // 等待上传完成（缩略图数量增加）
        for (let w = 0; w < 40; w++) {
            if (countThumbs() >= beforeCount + detailUrls.length) break;
            await sleep(300);
        }

        // 直接点击确定（列表中新增的都会插入富文本）
        // 先在弹窗内查找，如果找不到就全局查找
        let okBtn: HTMLElement | null = null;

        // 选择器列表（从精确到模糊）
        const okBtnSelectors = [
            'button.doraemon-btn.doraemon-btn-primary',
            '.doraemon-btn-primary',
            'button[type="button"].doraemon-btn-primary',
            '.ant-btn-primary',
            'button:contains("确定")',
        ];

        // 先在 modal 内查找
        for (const sel of okBtnSelectors) {
            okBtn = modal.querySelector(sel) as HTMLElement | null;
            if (okBtn && okBtn.innerText.includes('确定')) break;
        }

        // 如果 modal 内找不到，全局查找（某些弹窗确定按钮在 modal 外层）
        if (!okBtn) {
            this.log("[DETAIL_IMG] 弹窗内未找到确定按钮，尝试全局查找...");
            const allModals = document.querySelectorAll('.doraemon-modal, .ant-modal');
            for (const m of allModals) {
                for (const sel of okBtnSelectors) {
                    const btn = m.querySelector(sel) as HTMLElement;
                    if (btn && btn.innerText.includes('确定')) {
                        okBtn = btn;
                        break;
                    }
                }
                if (okBtn) break;
            }
        }

        // 最后兜底：直接在 document 中查找包含"确定"的蓝色按钮
        if (!okBtn) {
            const allBtns = document.querySelectorAll('button.doraemon-btn-primary, .ant-btn-primary');
            for (const btn of allBtns) {
                if ((btn as HTMLElement).innerText.includes('确定')) {
                    okBtn = btn as HTMLElement;
                    break;
                }
            }
        }

        if (okBtn) {
            this.log(`[DETAIL_IMG] 找到确定按钮: ${okBtn.className}`);

            // ⭐ 重要：等待按钮从 loading 状态恢复后再点击
            // 如果按钮有 doraemon-btn-loading 类，说明正在上传中，点击无效
            for (let wait = 0; wait < 60; wait++) {  // 最多等 30 秒
                if (!okBtn.classList.contains('doraemon-btn-loading') &&
                    !okBtn.classList.contains('is-loading') &&
                    !okBtn.hasAttribute('disabled')) {
                    break;
                }
                this.log(`[DETAIL_IMG] 等待按钮 loading 结束... (${wait + 1})`);
                await sleep(500);
            }

            // 再次确认按钮不是 loading 状态
            if (okBtn.classList.contains('doraemon-btn-loading')) {
                this.warn("[DETAIL_IMG] ⚠️ 按钮仍在 loading 状态，强制点击可能无效");
            }

            okBtn.scrollIntoView({ behavior: "smooth", block: "center" });
            await sleep(300);
            okBtn.click();
            this.log("[DETAIL_IMG] ✅ 点击确定按钮");

            // 等待弹窗关闭
            for (let i = 0; i < 30; i++) {
                const stillThere = document.contains(modal);
                if (!stillThere || modal.style.display === "none") {
                    this.log("[DETAIL_IMG] 弹窗已关闭");
                    break;
                }
                await sleep(300);
            }
        } else {
            this.warn("[DETAIL_IMG] ⚠️ 未找到确定按钮！");
        }

        this.log(`[DETAIL_IMG] 详情图上传完成: ${detailUrls.length} 张`);
        (this as any)._detailUploading = false;
        return detailUrls.length;
    },

    // ========== 一键上传+选择（统一入口：增加隔离与健壮性）==========
    async uploadAllImages(mainUrls: string[], detailUrls: string[]): Promise<{ mainCount: number; detailCount: number }> {
        this.log("[IMG] ==========================================");
        this.log("[IMG]   启动隔离上传模式...");
        this.log("[IMG] ==========================================");

        let mainCount = 0;
        let detailCount = 0;

        // 隔离执行主图上传
        try {
            if (mainUrls && Array.isArray(mainUrls) && mainUrls.length > 0) {
                mainCount = await this.uploadMainImages(mainUrls);
            }
        } catch (e) {
            this.warn("[IMG] 主图模块崩溃，已自动剥离:", e);
        }

        // 隔离执行详情图上传
        try {
            // 数据清洗：确保是数组，否则回退到主图
            const safeDetailUrls = (detailUrls && Array.isArray(detailUrls) && detailUrls.length > 0)
                ? detailUrls
                : (mainUrls && Array.isArray(mainUrls) ? mainUrls : []);

            if (safeDetailUrls.length > 0) {
                detailCount = await this.uploadDetailImages(safeDetailUrls, 0);
            }
        } catch (e) {
            this.warn("[IMG] 详情图模块崩溃，已自动剥离:", e);
        }

        this.log(`[IMG] 隔离上传结束。主图: ${mainCount}，详情图: ${detailCount}`);
        return { mainCount, detailCount };
    },

    // ===================== 7. SKU 填写模块（完整版） =====================

    // 填写 SKU 规格组
    async fillSkuSpecs(specGroups: Array<{ name: string; values: string[] }>): Promise<void> {
        this.log("[SKU] 开始填写 SKU 规格...", specGroups.length, "组")
        for (const group of specGroups) {
            const groupBtn = document.querySelector('.add-sku-group-btn, [class*="add-spec"], button:contains("添加规格")') as HTMLElement
            if (groupBtn) {
                groupBtn.click()
                await sleep(500)
            }
            const groupInput = document.querySelector('.sku-group-name input, .spec-name input') as HTMLInputElement
            if (groupInput) {
                groupInput.value = group.name
                groupInput.dispatchEvent(new Event("input", { bubbles: true }))
            }
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
        this.log("[SKU] 规格填写完成")
    },

    // 填写 SKU 价格/库存/编码
    async fillSKUData(skuList: Array<{ code?: string; stock?: number; price?: number }>): Promise<void> {
        this.log("🧩 开始填写 SKU 数据...", skuList.length, "个")

        const table = await this.waitForAppear(".sku-table, .el-table, [class*='sku']")
        if (!table) {
            this.warn("未找到 SKU 表格")
            return
        }

        // 获取表头，用于定位列
        const headers = [...table.querySelectorAll("th, .el-table__header th")].map(th => th.innerText.trim());
        this.log("SKU 表头:", headers.join(" | "));

        const rows = [...table.querySelectorAll(".el-table__row, tr, .sku-row")].filter(row => row.querySelector("input"));

        for (let i = 0; i < rows.length && i < skuList.length; i++) {
            const rowEl = rows[i]
            const sku = skuList[i]
            if (!sku) continue

            const cells = rowEl.querySelectorAll("td, .el-table__cell");
            const inputs = rowEl.querySelectorAll("input");

            // 策略1: 基于表头索引定位 (更准确)
            if (headers.length > 0 && cells.length === headers.length) {
                headers.forEach((h, idx) => {
                    const input = cells[idx]?.querySelector("input");
                    if (!input) return;

                    if ((h.includes("价格") || h.includes("单价") || h.includes("price")) && sku.price !== undefined) {
                        this.setVal(input, String(sku.price), `SKU价格(${h})`);
                    } else if ((h.includes("库存") || h.includes("stock")) && sku.stock !== undefined) {
                        this.setVal(input, String(sku.stock), `SKU库存(${h})`);
                    } else if ((h.includes("编码") || h.includes("SKU") || h.includes("code")) && sku.code) {
                        this.setVal(input, sku.code, `SKU编码(${h})`);
                    }
                });
            }
            // 策略2: 兜底基于 placeholder
            else {
                inputs.forEach((inp: HTMLInputElement) => {
                    const ph = (inp.placeholder || "").toLowerCase();
                    if ((ph.includes("价格") || ph.includes("price")) && sku.price !== undefined) {
                        this.setVal(inp, String(sku.price), "SKU价格(PH)");
                    } else if ((ph.includes("库存") || ph.includes("stock")) && sku.stock !== undefined) {
                        this.setVal(inp, String(sku.stock), "SKU库存(PH)");
                    }
                });
            }

            await sleep(200)
        }

        this.log("✅ SKU 数据填写完成")
    },

    // 辅助方法：设置输入框值
    setVal(input: HTMLInputElement, val: string, debugName: string) {
        input.value = val;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.dispatchEvent(new Event("blur", { bubbles: true }));
        this.log(`   [SKU] 填写 ${debugName} = ${val}`);
    },

    // 上传 SKU 规格图
    async uploadSKUImages(skuImages: Record<string, string>): Promise<void> {
        if (!skuImages || Object.keys(skuImages).length === 0) {
            this.log("[SKU-IMG] 无 SKU 图片需要上传");
            return;
        }

        this.log("[SKU-IMG] 开始上传 SKU 图片...", Object.keys(skuImages).length);

        const skuRows = document.querySelectorAll(
            '.sku-spec-row, .spec-option-row, [class*="sku-item"], [class*="spec-item"]'
        );

        for (const [specValue, imageUrl] of Object.entries(skuImages)) {
            if (!imageUrl) continue;

            try {
                let targetRow: Element | null = null;
                for (const row of skuRows) {
                    const rowText = (row as HTMLElement).innerText || "";
                    if (rowText.includes(specValue)) {
                        targetRow = row;
                        break;
                    }
                }

                if (!targetRow) {
                    this.log(`[SKU-IMG] 未找到规格 "${specValue}" 的行，跳过`);
                    continue;
                }

                const input = targetRow.querySelector(
                    'input[type="file"], .el-upload input[type="file"], [class*="upload"] input[type="file"]'
                ) as HTMLInputElement | null;

                if (!input) {
                    this.log(`[SKU-IMG] 规格 "${specValue}" 无 input 上传区域，跳过`);
                    continue;
                }

                const file = await this.urlToFile(imageUrl, `sku_${specValue}_${Date.now()}.jpg`);
                const dt = new DataTransfer();
                dt.items.add(file);
                input.files = dt.files;
                input.dispatchEvent(new Event("change", { bubbles: true }));

                this.log(`[SKU-IMG] 规格 "${specValue}" 上传完成`);

                await sleep(600);
            } catch (e) {
                this.warn(`[SKU-IMG] 规格 "${specValue}" 上传失败`, e);
            }
        }

        this.log("[SKU-IMG] SKU 图片上传完成");
    },

    // ===================== 8. 智能产地选择器 v3.0 =====================

    // 获取目标产地信息（使用统一的品牌企业库）
    // ⭐ 注意：直辖市在级联菜单中显示为"北京"而非"北京市"，需要特殊处理
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
        if (title.includes("上海")) return { province: "上海", city: "上海市", district: "浦东新区" };  // 直辖市
        if (title.includes("北京")) return { province: "北京", city: "北京市", district: "海淀区" };    // 直辖市
        if (title.includes("天津")) return { province: "天津", city: "天津市", district: "和平区" };    // 直辖市
        if (title.includes("重庆")) return { province: "重庆", city: "重庆市", district: "渝中区" };    // 直辖市
        if (title.includes("广州")) return { province: "广东省", city: "广州市", district: "天河区" };

        // 4. 最终兜底（安全地址）
        this.log(`🌍 使用兜底产地：浙江省/宁波市/镇海区`)
        return { province: "浙江省", city: "宁波市", district: "镇海区" };
    },

    // 查找并点击级联菜单节点
    // ⭐ 支持模糊匹配："北京市" 可以匹配 "北京"，"浙江省" 可以匹配 "浙江"
    async clickCascaderNode(text: string): Promise<boolean> {
        // 生成多个可能的匹配文本（去掉省/市/区后缀）
        const textVariants = [
            text,
            text.replace(/省$/, ''),
            text.replace(/市$/, ''),
            text.replace(/区$/, ''),
            text.replace(/(省|市|区)$/, '')
        ];
        // 去重
        const uniqueVariants = [...new Set(textVariants)];

        // 尝试多次查找，因为菜单加载有动画延迟
        for (let i = 0; i < 15; i++) {
            // 遍历所有可能的文本变体
            for (const variant of uniqueVariants) {
                // 使用 XPath 查找包含文本的菜单项
                const xpath = `//li[contains(@class,'doraemon-cascader-menu-item') and contains(., '${variant}')]`;
                const el = document.evaluate(xpath, document.body, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement;

                if (el && el.offsetParent !== null) { // 确保可见
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                    await sleep(80);
                    el.click();
                    this.log(`🖱️ 点击级联菜单: ${variant} (原始: ${text})`);
                    await sleep(180);
                    return true;
                }
            }

            // 如果 XPath 找不到，尝试用 querySelectorAll 遍历查找
            const allItems = document.querySelectorAll('.doraemon-cascader-menu-item, .el-cascader-node');
            for (const item of allItems) {
                const itemText = (item as HTMLElement).innerText?.trim() || '';
                for (const variant of uniqueVariants) {
                    if (itemText === variant || itemText.includes(variant) || variant.includes(itemText)) {
                        if ((item as HTMLElement).offsetParent !== null) {
                            (item as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
                            await sleep(80);
                            (item as HTMLElement).click();
                            this.log(`🖱️ 点击级联菜单(备选): ${itemText} (原始: ${text})`);
                            await sleep(180);
                            return true;
                        }
                    }
                }
            }

            await sleep(100);
        }

        this.warn(`[Origin Selector] 未找到或无法点击节点: ${text}`);
        return false;
    },

    // 执行产地选择
    async fillOrigin(scraped: any): Promise<void> {
        this.log("🌍 开始智能填写产地/制造商区域...");

        // 等待 UI 空闲，避免与上传/其他弹窗抢焦点
        await waitForUIIdle();

        // =============================================
        // 第一步：直接全局搜索"境内"单选框并点击
        // 这是最简单直接的方法，不依赖特定的表单结构
        // =============================================
        let simpleRadioHandled = false;

        // 🔥 方法1：直接查找所有 doraemon-radio-wrapper 中包含"境内"文字的元素
        const allRadioWrappers = document.querySelectorAll('.doraemon-radio-wrapper, .el-radio, .ant-radio-wrapper');
        this.log(`📍 全局搜索：找到 ${allRadioWrappers.length} 个 radio wrapper`);

        for (const wrapper of allRadioWrappers) {
            const wrapperText = (wrapper as HTMLElement).innerText?.trim() || '';
            if (wrapperText === '境内') {
                this.log(`🎯 直接命中境内选项: "${wrapperText}"`);
                // 尝试点击内部的 input 或 wrapper 本身
                const input = wrapper.querySelector('input[type="radio"]') as HTMLInputElement;
                if (input && !input.checked) {
                    input.click();
                    this.log('✅ 点击了 radio input');
                }
                (wrapper as HTMLElement).click();
                this.log('✅ 点击了 radio wrapper');
                simpleRadioHandled = true;
                await sleep(300);
                break;
            }
        }

        // 🔥 方法2：如果方法1失败，遍历表单行查找产地字段
        if (!simpleRadioHandled) {
            this.log('📍 方法1未命中，尝试方法2：遍历表单行...');
            const formRows = document.querySelectorAll('.el-form-item, .doraemon-form-item, .attr-row, [class*="form-item"], .goods-attr-form .attr-row');
            this.log(`📍 找到 ${formRows.length} 个表单行`);

            for (const row of formRows) {
                const rowText = (row as HTMLElement).innerText || '';
                // 检查这一行是否包含"产地"标签
                if (rowText.includes('产地') && (rowText.includes('境内') || rowText.includes('境外'))) {
                    this.log('🔍 找到产地行:', rowText.substring(0, 50));

                    // 查找该行中的所有可点击元素
                    const clickables = row.querySelectorAll('.doraemon-radio-wrapper, .el-radio, .ant-radio-wrapper, label, span');
                    for (const el of clickables) {
                        const elText = (el as HTMLElement).innerText?.trim() || '';
                        if (elText === '境内') {
                            this.log(`🎯 在产地行中找到境内选项`);
                            (el as HTMLElement).click();
                            simpleRadioHandled = true;
                            await sleep(300);
                            break;
                        }
                    }
                    if (simpleRadioHandled) break;
                }
            }
        }

        // 🔥 方法3：最后尝试 - 直接搜索所有包含"境内"文字的 span/label 并点击其父级
        if (!simpleRadioHandled) {
            this.log('📍 方法2未命中，尝试方法3：搜索所有文字节点...');
            const allElements = document.querySelectorAll('span, label');
            for (const el of allElements) {
                if ((el as HTMLElement).innerText?.trim() === '境内') {
                    const parent = (el as HTMLElement).closest('.doraemon-radio-wrapper, .el-radio, .ant-radio-wrapper, label');
                    if (parent) {
                        this.log('🎯 方法3命中，点击父级元素');
                        (parent as HTMLElement).click();
                        simpleRadioHandled = true;
                        await sleep(300);
                        break;
                    }
                }
            }
        }

        if (simpleRadioHandled) {
            this.log('✅ 产地"境内"选择成功');
        } else {
            this.warn('⚠️ 未能找到并点击"境内"选项，请检查页面结构');
        }

        // 如果简单单选框已处理，检查是否还有级联选择器需要处理
        if (simpleRadioHandled) {
            // 检查是否有制造商所在区域等级联选择器
            const hasCascader = document.querySelector('.doraemon-cascader-picker, .el-cascader');
            if (!hasCascader) {
                this.log("✅ 产地填写完成（简单单选模式）");
                return;
            }
            this.log("📍 继续处理制造商所在区域级联选择器...");
        }

        // =============================================
        // 第二步：处理制造商所在区域级联选择器
        // =============================================
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
            // 如果没有级联选择器，但简单单选已处理，视为成功
            if (simpleRadioHandled) {
                this.log("✅ 产地填写完成（无级联选择器）");
                return;
            }
            this.warn("未找到产地选择器（既没有简单单选也没有级联）");
            return;
        }


        // 先点击"境内"单选，确保级联可用
        // ⭐ 支持多种 radio 组件结构：el-radio, doraemon-radio, 原生 radio, ant-radio 等
        let jingneiClicked = false;

        // 方式1: 查找所有包含"境内"文字的元素
        const allRadioElements = document.querySelectorAll('label, span, .el-radio, .doraemon-radio, .ant-radio-wrapper, [class*="radio"]');
        for (const el of allRadioElements) {
            const text = (el as HTMLElement).innerText?.trim() || '';
            if (text === '境内' || text.includes('境内')) {
                const radioParent = (el as HTMLElement).closest('.el-radio, .doraemon-radio, .ant-radio-wrapper, [class*="radio"], label');
                const clickTarget = radioParent || el;
                (clickTarget as HTMLElement).click();
                this.log('🔘 点击境内单选');
                jingneiClicked = true;
                await sleep(200);
                break;
            }
        }

        // 方式2: 如果方式1失败，尝试查找 input[type=radio] + label 结构
        if (!jingneiClicked) {
            const radios = document.querySelectorAll('input[type="radio"]');
            for (const radio of radios) {
                const label = radio.parentElement;
                const text = label?.innerText?.trim() || '';
                if (text === '境内' || text.includes('境内')) {
                    (radio as HTMLInputElement).click();
                    this.log('🔘 点击境内单选(原生radio)');
                    jingneiClicked = true;
                    await sleep(200);
                    break;
                }
            }
        }

        // 方式3: 直接通过 XPath 查找
        if (!jingneiClicked) {
            const xpath = "//*[contains(text(), '境内') and (ancestor::*[contains(@class, 'radio')] or self::label)]";
            const result = document.evaluate(xpath, document.body, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            const node = result.singleNodeValue;
            if (node) {
                (node as HTMLElement).click();
                this.log('🔘 点击境内单选(XPath)');
                await sleep(200);
            }
        }

        // 确保可见且居中
        triggerInput.scrollIntoView({ behavior: "smooth", block: "center" });
        await sleep(200);

        // 2. 获取目标地址
        const origin = this.getOrigin(scraped);
        this.log(`🎯 目标产地: ${origin.province} / ${origin.city} / ${origin.district}`);

        // 3. 点击输入框打开下拉
        const selectOnce = async () => {
            triggerInput.click();
            await sleep(200);
            if (!(await this.clickCascaderNode(origin.province))) return false;
            await sleep(180);
            if (!(await this.clickCascaderNode(origin.city))) return false;
            await sleep(180);
            await this.clickCascaderNode(origin.district);
            return true;
        }

        let selected = await selectOnce();
        if (!selected) {
            // 重试一次：关闭再打开
            document.body.click();
            await sleep(200);
            selected = await selectOnce();
        }

        // 点击页面空白处收起菜单（如果没自动收起）
        document.body.click();
        this.log("✅ 智能产地填写完成");
    },

    // 价格/库存兜底填写（价格按下浮8%）
    // ⭐ 增强版 v2：支持按 id 属性、label 关联、DOM 结构多种方式查找
    async fillPriceAndStock(scraped: any): Promise<void> {
        this.log("💰 开始填写价格/库存...");

        // 等待 UI 空闲
        await waitForUIIdle();

        const specs = scraped?.specs || {};
        let basePrice =
            scraped?.price ||
            parseFloat(specs['价格'] || specs['市场价'] || specs['销售价'] || '0') ||
            scraped?.skuData?.[0]?.price ||
            0;
        if (Number.isNaN(basePrice)) basePrice = 0;

        const marketPrice = basePrice > 0 ? Math.round(basePrice * 100) / 100 : 0;
        // 销售价 = 市场价 × 0.92（下浮8%，在5-10%范围内）
        const salePrice = marketPrice > 0 ? Math.round(marketPrice * 0.92 * 100) / 100 : 0;
        // 库存默认 999
        const stockVal = scraped?.stock || parseInt(specs['库存'] || specs['数量'] || '999', 10) || 999;

        this.log(`💰 价格计算: 采集价格=${scraped?.price}, 基础价=${basePrice}, 市场价=${marketPrice}, 销售价=${salePrice}, 库存=${stockVal}`);

        const setVal = (input: HTMLInputElement, val: string, fieldName: string) => {
            this.log(`🎯 尝试填写 [${fieldName}]: 目标input.id=${input.id}, 当前值=${input.value}`);
            input.scrollIntoView({ behavior: "smooth", block: "center" });
            input.focus();
            input.click();

            // 使用原生 setter
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            if (setter) {
                setter.call(input, val);
            } else {
                input.value = val;
            }

            // 触发各种事件确保框架能感知到变化
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new Event('blur', { bubbles: true }));
            // 针对 doraemon 组件可能需要的事件
            input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

            this.log(`✅ [${fieldName}] 填写成功 = ${val}`);
        };

        let filledCount = { market: 0, sale: 0, stock: 0 };

        // ========== 策略: 遍历所有 input，按 id 填写所有匹配的输入框 ==========
        // 这样可以同时填写上面的价格区域和 SKU 表格内的每一行
        this.log("📍 遍历所有 input，填写所有匹配的字段...");

        const allInputs = Array.from(document.querySelectorAll<HTMLInputElement>("input:not([type=hidden])"));
        this.log(`📍 共找到 ${allInputs.length} 个 input 元素`);

        for (const input of allInputs) {
            if (input.disabled || input.readOnly) continue;
            // 跳过已有值的输入框
            if (input.value && input.value !== '' && input.value !== '0') continue;

            const inputId = (input.id || '').toLowerCase();
            const placeholder = (input.placeholder || '').toLowerCase();
            const parentText = (input.parentElement?.innerText || '').toLowerCase();
            // ⭐ 增强：检查祖先元素文本（政采云价格区域可能嵌套较深）
            const grandParentText = (input.parentElement?.parentElement?.innerText || '').toLowerCase();
            const ancestorCell = input.closest('td, th, .price-item, .el-form-item, .doraemon-form-item');
            const ancestorText = (ancestorCell?.textContent || '').toLowerCase();
            // 检查前一个兄弟节点（表格布局中 label 可能在前一个 td）
            const prevSiblingText = (input.parentElement?.previousElementSibling?.textContent || '').toLowerCase();

            // 是否匹配市场价 - 增强匹配
            const isMarket = inputId.includes('marketprice') || inputId.includes('market_price') ||
                placeholder.includes('市场价') || placeholder.includes('请输入') && parentText.includes('市场价') ||
                parentText.includes('市场价') || grandParentText.includes('市场价') ||
                ancestorText.includes('市场价') || prevSiblingText.includes('市场价');

            // 是否匹配销售价 - 增强匹配
            const isSale = inputId.includes('saleprice') || inputId.includes('sale_price') ||
                placeholder.includes('销售价') || placeholder.includes('请输入') && parentText.includes('销售价') ||
                parentText.includes('销售价') || grandParentText.includes('销售价') ||
                ancestorText.includes('销售价') || prevSiblingText.includes('销售价');

            // 是否匹配库存 - 增强匹配
            const isStock = inputId.includes('stock') || inputId.includes('quantity') ||
                placeholder.includes('库存') || placeholder.includes('数量') ||
                parentText.includes('库存') || parentText.includes('数量') ||
                grandParentText.includes('库存') || grandParentText.includes('数量') ||
                ancestorText.includes('库存') || ancestorText.includes('数量') ||
                prevSiblingText.includes('库存') || prevSiblingText.includes('数量');


            // 市场价（填写所有匹配的）
            if (marketPrice > 0 && isMarket) {
                setVal(input, String(marketPrice), `市场价(${input.id || 'no-id'})`);
                filledCount.market++;
            }
            // 销售价（填写所有匹配的）
            else if (salePrice > 0 && isSale) {
                setVal(input, String(salePrice), `销售价(${input.id || 'no-id'})`);
                filledCount.sale++;
            }
            // 库存（填写所有匹配的）
            else if (stockVal > 0 && isStock) {
                setVal(input, String(stockVal), `库存(${input.id || 'no-id'})`);
                filledCount.stock++;
            }
        }

        this.log(`📍 按id填写结果: 市场价=${filledCount.market}个, 销售价=${filledCount.sale}个, 库存=${filledCount.stock}个`);
        this.log(`💰 价格/库存填写完成: 市场价=${filledCount.market}个, 销售价=${filledCount.sale}个, 库存=${filledCount.stock}个`);
    }


}

    // 暴露到 window
    ; (window as any).AutoFillAIEngine = AutoFillAIEngine
