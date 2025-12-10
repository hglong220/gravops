/**
 * ZCY Publish Types - 政采云发布相关类型定义
 */

// ========== 发布模板类型 ==========

export interface ZcyPublishTemplate {
    id: string
    name: string                              // 模板名称
    market: string                            // 电子卖场，如 "青海网超"
    marketCode?: string                       // 卖场代码
    categoryPath: string[]                    // 类目路径数组，支持1-5级，如 ["办公设备/耗材", "打印机及配件", "激光打印机"]
    categoryIds?: number[]                    // 类目ID数组，用于精确定位
    bidItemName?: string                      // 标项名称，如 "办公用品"
    keyAttrs: {
        [fieldName: string]: KeyAttrRule
    }
}

export interface KeyAttrRule {
    source: 'scraped' | 'manual' | 'fixed'    // scraped=从采集数据取, manual=手动填, fixed=固定值
    scrapedField?: string                     // 采集字段名，如 'brand', 'model', 'attributes.规格'
    fixedValue?: string                       // 固定值
}

// ========== 商品数据类型 ==========

export interface ProductData {
    title: string
    brand: string
    model: string
    price: number
    stock: number
    images: string[]
    attributes: Record<string, string>
    skuData: any
    detailHtml: string
    detailImages: string[]
    originalUrl: string
    shopName: string
}

// ========== 发布消息类型 ==========

export interface ZcyPublishMessage {
    type: 'ZCY_PUBLISH'
    draftId: string
    zcyUrl: string
    template: ZcyPublishTemplate | null
    product: ProductData
}

// ========== 通用工具函数 ==========

/**
 * 等待元素出现
 */
export function waitFor<T extends Element>(
    getter: () => T | null,
    timeout = 10000,
    interval = 200
): Promise<T> {
    return new Promise((resolve, reject) => {
        const start = Date.now()
        const el = getter()
        if (el) {
            resolve(el)
            return
        }

        const timer = setInterval(() => {
            const el = getter()
            if (el) {
                clearInterval(timer)
                resolve(el)
            } else if (Date.now() - start > timeout) {
                clearInterval(timer)
                reject(new Error(`waitFor timeout: ${timeout}ms`))
            }
        }, interval)
    })
}

/**
 * 延迟
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 通过文本内容查找元素
 */
export function findElementByText<T extends HTMLElement>(
    selector: string,
    text: string,
    container: Element = document.body
): T | null {
    const elements = container.querySelectorAll<T>(selector)
    return Array.from(elements).find(el =>
        el.textContent?.trim().includes(text)
    ) || null
}

/**
 * 根据 label 文本找到对应的输入框并填写
 */
export function fillInputByLabel(labelText: string, value: string): boolean {
    if (!value) return false

    const labels = document.querySelectorAll('label, .form-label, .el-form-item__label, .ant-form-item-label')

    for (const label of labels) {
        if (label.textContent?.trim().startsWith(labelText)) {
            // 找到同一个 form-item 下的 input
            const formItem = label.closest('.el-form-item, .ant-form-item, .form-group') || label.parentElement
            if (!formItem) continue

            const input = formItem.querySelector('input, textarea, select') as HTMLInputElement | HTMLTextAreaElement | null
            if (input) {
                // React/Vue 兼容的设值方式
                const nativeSetter = Object.getOwnPropertyDescriptor(
                    input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
                    'value'
                )?.set

                if (nativeSetter) {
                    nativeSetter.call(input, value)
                } else {
                    input.value = value
                }

                // 触发事件
                input.dispatchEvent(new Event('input', { bubbles: true }))
                input.dispatchEvent(new Event('change', { bubbles: true }))
                input.dispatchEvent(new Event('blur', { bubbles: true }))

                console.log(`[ZCY Publish] 填写 ${labelText} = ${value}`)
                return true
            }
        }
    }

    console.warn(`[ZCY Publish] 未找到字段: ${labelText}`)
    return false
}

/**
 * 从商品数据中获取属性值
 * 支持嵌套路径，如 'attributes.规格'
 */
export function getValueFromProduct(product: ProductData, field: string): string {
    const parts = field.split('.')
    let value: any = product

    for (const part of parts) {
        if (value && typeof value === 'object') {
            value = value[part]
        } else {
            return ''
        }
    }

    return typeof value === 'string' ? value : ''
}

/**
 * 根据模板规则获取属性值
 */
export function resolveAttrValue(rule: KeyAttrRule, product: ProductData): string {
    switch (rule.source) {
        case 'scraped':
            return rule.scrapedField ? getValueFromProduct(product, rule.scrapedField) : ''
        case 'fixed':
            return rule.fixedValue || ''
        case 'manual':
        default:
            return ''
    }
}

/**
 * 模拟点击元素
 */
export function clickElement(el: HTMLElement | null): boolean {
    if (!el) return false
    el.scrollIntoView({ behavior: 'instant', block: 'center' })
    el.click()
    return true
}
