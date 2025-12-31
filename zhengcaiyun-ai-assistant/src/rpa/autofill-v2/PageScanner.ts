import type { FieldCandidate, ControlType } from './types';
import { generateSignature } from './FieldSignature';

/**
 * 控件类型判定（两级策略）
 * 
 * 第一级：结构特征快判（基于 class/role，不点击，速度快）
 * 第二级：行为探测兜底（仅当第一级返回 unknown 时）
 * 
 * ⚠️ 核心原则：
 * - 只相信 DOM，扫描阶段一次判定
 * - 优先级：radio > select > checkbox > text
 * - 禁止 select fallback 成 input
 */
function detectControlType(container: HTMLElement): ControlType {

    // ==================== 第一级：结构特征快判 ====================

    // 1️⃣ 优先检测 Radio
    const radioSelectors = [
        'input[type="radio"]',
        '.el-radio',
        '.el-radio-group',
        '.el-radio-button',
        '.ant-radio',
        '.ant-radio-wrapper',
        '.ant-radio-group',
        '.doraemon-radio-group',
        '.doraemon-radio-wrapper',
        '[class*="radio"]'  // 模糊匹配任何包含 radio 的 class
    ];
    if (container.querySelector(radioSelectors.join(', '))) {
        return 'radio';
    }

    // 2️⃣ 检测 Select/Dropdown（政采云大量使用 doraemon 组件）
    const selectSelectors = [
        '.el-select',
        '.ant-select',
        '.ant-select-selector',
        '.doraemon-select',
        '.doraemon-select-selection',
        '[role="combobox"]',
        '[role="listbox"]',
        '.ant-cascader-picker',
        '.el-cascader',
        '.doraemon-cascader-picker',
        '[class*="select"]:not([class*="selected"])',  // 模糊匹配 select 但排除 selected
        '[class*="picker"]',  // 模糊匹配 picker
        '[class*="dropdown-trigger"]'
    ];
    if (container.querySelector(selectSelectors.join(', '))) {
        return 'select';
    }

    // 3️⃣ 检测 Checkbox
    const checkboxSelectors = [
        'input[type="checkbox"]',
        '.el-checkbox',
        '.ant-checkbox',
        '.ant-checkbox-wrapper',
        '.doraemon-checkbox',
        '[class*="checkbox"]'
    ];
    if (container.querySelector(checkboxSelectors.join(', '))) {
        return 'checkbox';
    }

    // 4️⃣ 检测 Input/Textarea
    const inputSelectors = [
        'input[type="text"]',
        'input[type="number"]',
        'input:not([type])',
        'input.ant-input',
        'input.el-input__inner',
        'input.doraemon-input',
        'textarea',
        '.ant-input-number',
        '[contenteditable="true"]',
        '.el-textarea',
        '.ant-input-textarea'
    ];
    if (container.querySelector(inputSelectors.join(', '))) {
        // 确保不是 select 内嵌的 input（用于搜索）
        const input = container.querySelector('input');
        if (input) {
            const parent = input.closest('.ant-select, .el-select, .doraemon-select');
            if (parent) {
                // 这是 select 的搜索框，应该判定为 select
                return 'select';
            }
        }
        return 'text';
    }

    // 5️⃣ 兜底检查：有任何 input 元素
    if (container.querySelector('input')) {
        return 'text';
    }

    // ==================== 第二级：行为特征探测 ====================
    // 仅当第一级无法判定时执行

    // 检测是否有可点击的下拉触发元素
    const clickableDropdown = container.querySelector([
        '[class*="arrow"]',
        '[class*="suffix"]',
        '.anticon-down',
        '.el-icon-arrow-down'
    ].join(', '));
    if (clickableDropdown) {
        console.log(`[V2 Scanner] 行为探测: 发现下拉箭头，判定为 select`);
        return 'select';
    }

    // 检测是否有多个平级的可点击项（可能是 radio）
    const clickableItems = container.querySelectorAll('[class*="item"], [class*="option"]');
    if (clickableItems.length >= 2) {
        console.log(`[V2 Scanner] 行为探测: 发现 ${clickableItems.length} 个可点击项，判定为 radio`);
        return 'radio';
    }

    // 最终兜底
    console.warn(`[V2 Scanner] 无法识别控件类型:`, container.className, container.innerHTML.substring(0, 200));
    return 'unknown';
}

/**
 * 必填项精准捕获算法
 */
function isRequired(container: HTMLElement): boolean {
    // 1. 显性文本星号
    const labelText = container.querySelector('.el-form-item__label, .ant-form-item-label, label, .attr-label')?.textContent || '';
    if (labelText.includes('*') || labelText.includes('＊')) return true;

    // 2. 伪元素视觉检测 (红色星号样式)
    const labelEl = container.querySelector('.el-form-item__label, .ant-form-item-label, label, .attr-label');
    if (labelEl) {
        const brands = [':before', ':after'];
        for (const pseudo of brands) {
            const style = window.getComputedStyle(labelEl, pseudo);
            const content = style.getPropertyValue('content');
            const color = style.getPropertyValue('color');
            if (content && content !== 'none' && (color.includes('255,') || color.includes('245,'))) return true;
        }
    }

    // 3. UI 框架必填类名检测
    const mandatoryClasses = [
        '.is-required',
        '.ant-form-item-required',
        '.required',
        '.doraemon-form-item-required'
    ];
    if (mandatoryClasses.some(cls => container.matches(cls) || container.querySelector(cls))) return true;

    // 4. ARIA 语义与 HTML5 属性
    const input = container.querySelector('input, select, textarea');
    if (input && (input.hasAttribute('required') || input.getAttribute('aria-required') === 'true')) return true;

    // 5. 动态错误红框态 (提交后触发的校验)
    const errorMarkers = [
        '.is-error',
        '.el-form-item__error',
        '.ant-form-item-explain-error',
        '.has-error'
    ];
    if (errorMarkers.some(cls => container.matches(cls) || container.querySelector(cls))) return true;

    return false;
}

/**
 * 字段提取
 */
export function scanRequiredFields(): FieldCandidate[] {
    const fields: FieldCandidate[] = [];

    // 扫视所有可能的表单行容器（政采云多种结构全覆盖）
    const containerSelectors = [
        '.el-form-item',
        '.ant-form-item',
        '.doraemon-form-item',
        '.doraemon-row',           // 政采云行容器
        '.attr-row',
        '.publish-item',
        '.goods-attr-item',        // 政采云商品属性
        '[class*="form-item"]',    // 通配模糊匹配
        '[data-afield-id]'         // 已标记的字段
    ].join(', ');

    const containers = document.querySelectorAll(containerSelectors);

    containers.forEach((el, index) => {
        const container = el as HTMLElement;
        if (container.offsetParent === null) return; // 忽略隐藏

        if (isRequired(container)) {
            const labelEl = container.querySelector('.el-form-item__label, .ant-form-item-label, label, .attr-label') as HTMLElement;
            const label = labelEl ? labelEl.innerText.replace(/[*＊:：\s]/g, '').trim() : '';
            if (!label) return;

            const cType = detectControlType(container);

            const field: FieldCandidate = {
                id: `v2_${index}_${Date.now()}`,
                label,
                controlType: cType,
                required: true,
                domRef: container,
                currentValueText: '',
                options: [],
                signature: '',
                section: '',
                selectors: {
                    container: container.className,
                    control: 'input',
                    label: ''
                }
            };

            field.signature = generateSignature(field);
            fields.push(field);
        }
    });

    console.log(`[V2 Scanner] 物理扫描完成：发现 ${fields.length} 个必填项。`);
    return fields;
}

export const PageScanner = { scanRequiredFields };
