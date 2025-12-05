/**
 * ZCY 表单字段定位工具
 */

/**
 * 根据 label 文本找到对应的输入框
 */
export function getInputByLabel(labelText: string): HTMLInputElement | HTMLTextAreaElement | null {
    // 1. ElementUI 结构
    const formItems = document.querySelectorAll('.el-form-item')
    for (const item of formItems) {
        const label = item.querySelector('.el-form-item__label')
        if (label?.textContent?.includes(labelText)) {
            const input = item.querySelector('input, textarea')
            if (input) return input as HTMLInputElement | HTMLTextAreaElement
        }
    }

    // 2. placeholder 匹配
    const inputs = document.querySelectorAll('input, textarea')
    for (const input of inputs) {
        const placeholder = input.getAttribute('placeholder') || ''
        if (placeholder.includes(labelText)) {
            return input as HTMLInputElement | HTMLTextAreaElement
        }
    }

    return null
}

/**
 * 填充输入框
 */
export function fillInputByLabel(labelText: string, value: string | number): boolean {
    const input = getInputByLabel(labelText)
    if (!input) {
        console.warn(`[ZCY Field] 找不到: ${labelText}`)
        return false
    }

    const str = String(value ?? '').trim()
    if (!str) return false

    input.value = str
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))

    console.log(`[ZCY Field] ✅ ${labelText} = ${str.substring(0, 30)}`)
    return true
}

/**
 * 批量填充
 */
export function fillMultipleFields(fields: Record<string, string | number>): number {
    let count = 0
    for (const [label, value] of Object.entries(fields)) {
        if (fillInputByLabel(label, value)) count++
    }
    return count
}
