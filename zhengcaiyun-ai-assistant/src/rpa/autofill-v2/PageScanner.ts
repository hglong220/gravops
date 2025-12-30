import type { FieldCandidate, ControlType } from './types';
import { generateSignature } from './FieldSignature';

/**
 * 控件类型判定（DOM 硬规则，不使用 AI）
 */
function detectControlType(container: HTMLElement): ControlType {
    if (container.querySelector('input[type="radio"], .el-radio, .ant-radio, .ant-radio-wrapper')) {
        return 'radio';
    }
    if (container.querySelector('.el-select, .ant-select, [role="combobox"], .doraemon-select, .ant-cascader-picker')) {
        return 'select';
    }
    if (container.querySelector('input, textarea, [contenteditable="true"]')) {
        return 'text';
    }
    return 'text';
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
