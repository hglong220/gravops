import type { FieldCandidate, SemanticDecision } from './types';
import { simulateClick, triggerEvents, sleep } from './Utils';

/**
 * 物理层执行器：基于控件类型的"死命令"执行
 */
export async function executeFill(field: FieldCandidate, decision: SemanticDecision): Promise<boolean> {
    const container = field.domRef as HTMLElement;
    const physicalType = field.controlType; // PageScanner 判定的物理类型
    const value = decision.executePlan.payload;

    if (!value) return false;

    console.log(`[V2 Executor] 执行字段: ${field.label} | 物理类型: ${physicalType} | 填充值: ${value}`);

    try {
        // 先尝试按照 PageScanner 判定的类型执行
        let success = await executeByType(container, physicalType, value);

        // 如果失败，尝试智能检测实际控件类型
        if (!success) {
            console.log(`[V2 Executor] 首次执行失败，尝试智能检测控件类型...`);
            const actualType = detectActualControlType(container);
            if (actualType !== physicalType) {
                console.log(`[V2 Executor] 实际类型: ${actualType}，重新执行...`);
                success = await executeByType(container, actualType, value);
            }
        }

        return success;
    } catch (e) {
        console.error(`[V2 Executor] 物理执行失败: ${field.label}`, e);
        return false;
    }
}

/**
 * 智能检测实际控件类型
 */
function detectActualControlType(container: HTMLElement): string {
    // 检测 Radio
    if (container.querySelector('.el-radio, .ant-radio, .doraemon-radio-wrapper, input[type="radio"]')) {
        return 'radio';
    }
    // 检测 Select
    if (container.querySelector('.el-select, .ant-select, .doraemon-select, [role="combobox"]')) {
        return 'select';
    }
    // 检测 Checkbox
    if (container.querySelector('.el-checkbox, .ant-checkbox, input[type="checkbox"]')) {
        return 'checkbox';
    }
    // 检测 Input/Textarea
    if (container.querySelector('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), textarea')) {
        return 'text';
    }
    return 'unknown';
}

/**
 * 按控件类型执行填写
 */
async function executeByType(container: HTMLElement, physicalType: string, value: string): Promise<boolean> {
    switch (physicalType) {
        // 场景 A: 文本输入 (Input / Textarea)
        case 'text':
        case 'number':
        case 'textarea': {
            const input = container.querySelector('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), textarea') as HTMLInputElement;
            if (input) {
                input.focus();
                // 使用 native setter 确保 Vue/React 响应
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                if (nativeSetter) {
                    nativeSetter.call(input, value);
                } else {
                    input.value = value;
                }
                triggerEvents(input);
                await sleep(100);
                console.log(`[V2 Executor] ✅ 文本填写成功: ${value.substring(0, 20)}...`);
                return true;
            }
            break;
        }

        // 场景 B: 下拉选择 (Select)
        case 'select': {
            const trigger = container.querySelector('.el-select, .ant-select, .doraemon-select, [role="combobox"]') as HTMLElement;
            if (trigger) {
                // 点击展开下拉
                const input = trigger.querySelector('input') as HTMLElement;
                await simulateClick(input || trigger);
                await sleep(800); // 等待下拉列表渲染

                // 在全局寻找选项（政采云下拉是全局渲染的）
                const optionSelectors = [
                    '.el-select-dropdown__item:not(.is-disabled)',
                    '.ant-select-item-option:not(.ant-select-item-option-disabled)',
                    '.doraemon-select-dropdown-menu-item:not(.is-disabled)',
                    '[role="option"]'
                ];

                const options = Array.from(document.querySelectorAll(optionSelectors.join(', ')));
                console.log(`[V2 Executor] 找到 ${options.length} 个下拉选项`);

                // 精确匹配 > 包含匹配
                let target = options.find(opt => (opt as HTMLElement).innerText.trim() === value) as HTMLElement;
                if (!target) {
                    target = options.find(opt => (opt as HTMLElement).innerText.includes(value)) as HTMLElement;
                }

                if (target) {
                    await simulateClick(target);
                    await sleep(200);
                    console.log(`[V2 Executor] ✅ 下拉选择成功: ${target.innerText.trim()}`);
                    return true;
                } else {
                    console.warn(`[V2 Executor] 未找到匹配选项: ${value}`);
                    // 关闭下拉
                    document.body.click();
                }
            }
            break;
        }

        // 场景 C: 单选 (Radio)
        case 'radio': {
            const radios = Array.from(container.querySelectorAll('.el-radio, .el-radio-group label, .ant-radio-wrapper, .doraemon-radio-wrapper'));
            console.log(`[V2 Executor] 找到 ${radios.length} 个 Radio 选项`);

            const target = radios.find(r => (r as HTMLElement).innerText.includes(value)) as HTMLElement;
            if (target) {
                await simulateClick(target);
                await sleep(200);
                console.log(`[V2 Executor] ✅ Radio 选择成功: ${target.innerText.trim()}`);
                return true;
            }
            break;
        }

        // 场景 D: 多选 (Checkbox)
        case 'checkbox': {
            const checkboxes = Array.from(container.querySelectorAll('.el-checkbox, .ant-checkbox-wrapper'));
            const values = value.split(/[,，]/).map(v => v.trim());
            let hitCount = 0;

            for (const v of values) {
                const target = checkboxes.find(c => (c as HTMLElement).innerText.includes(v)) as HTMLElement;
                if (target) {
                    await simulateClick(target);
                    hitCount++;
                    await sleep(100);
                }
            }

            if (hitCount > 0) {
                console.log(`[V2 Executor] ✅ Checkbox 选择成功: ${hitCount} 个`);
                return true;
            }
            break;
        }

        default:
            console.warn(`[V2 Executor] 未知物理类型: ${physicalType}`);
            // 兜底：尝试作为 text 处理
            const fallbackInput = container.querySelector('input:not([type="hidden"]), textarea') as HTMLInputElement;
            if (fallbackInput) {
                fallbackInput.focus();
                fallbackInput.value = value;
                triggerEvents(fallbackInput);
                console.log(`[V2 Executor] ✅ 兜底文本填写成功`);
                return true;
            }
            return false;
    }

    return false;
}

export const FillExecutor = { executeFill };
