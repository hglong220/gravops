import type { FieldCandidate, SemanticDecision, ProductData } from './types';
import { triggerEvents, sleep } from './Utils';

/**
 * V2 执行器 - 极简版
 * 
 * 核心逻辑：
 * 1. 输入类：调用 AI 生成值 → 填入
 * 2. 点选类：先获取选项 → AI 从中选 → 点击
 */

// ==================== 主入口 ====================
export async function executeFill(
    field: FieldCandidate,
    decision: SemanticDecision,
    productData?: ProductData
): Promise<boolean> {
    const container = field.domRef as HTMLElement;
    const controlType = field.controlType;

    console.log(`[V2 Executor] 执行字段: ${field.label} | 类型: ${controlType}`);

    try {
        switch (controlType) {
            case 'text':
            case 'number':
            case 'textarea':
                // 输入类：直接用 decision 中的值
                return await executeInput(container, decision.executePlan?.payload || '');

            case 'select':
            case 'radio':
                // 点选类：先获取选项，再让 AI 选择
                return await executeEnum(container, field.label, productData);

            case 'checkbox':
                return await executeCheckbox(container, decision.executePlan?.payload || '');

            case 'unknown':
            default:
                // unknown 也尝试点选，不能跳过！
                console.log(`[V2 Executor] 尝试点选 unknown 类型...`);
                return await executeEnum(container, field.label, productData);
        }
    } catch (e) {
        console.error(`[V2 Executor] 执行异常:`, e);
        return false;
    }
}

// ==================== 输入类执行 ====================
async function executeInput(container: HTMLElement, value: string): Promise<boolean> {
    if (!value) {
        console.warn(`[V2 Executor] 输入类无值，跳过`);
        return false;
    }

    const input = container.querySelector([
        'input[type="text"]',
        'input[type="number"]',
        'input:not([type])',
        'input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"])',
        'textarea',
        '.ant-input-number input'
    ].join(', ')) as HTMLInputElement;

    if (!input) {
        console.warn(`[V2 Executor] 未找到 input 元素`);
        return false;
    }

    input.focus();
    await sleep(50);

    // 使用 native setter
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (nativeSetter) {
        nativeSetter.call(input, value);
    } else {
        input.value = value;
    }

    triggerEvents(input);
    await sleep(100);

    console.log(`[V2 Executor] ✅ 输入成功: ${value.substring(0, 30)}`);
    return true;
}

// ==================== 点选类执行（核心改造）====================
async function executeEnum(
    container: HTMLElement,
    fieldLabel: string,
    productData?: ProductData
): Promise<boolean> {

    // Step 0: 先关闭所有现有浮层！这是关键！
    await closeAllDropdowns();

    // Step 1: 找到触发器
    const trigger = findClickableTrigger(container);
    if (!trigger) {
        console.warn(`[V2 Executor] 未找到可点击元素`);
        return false;
    }

    // Step 2: 点击打开选项
    trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    trigger.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    console.log(`[V2 Executor] 点击展开选项...`);
    await sleep(600);

    // Step 2: 获取所有可见选项
    const options = await getVisibleOptions(container);

    if (options.length === 0) {
        console.warn(`[V2 Executor] 未找到任何选项`);
        document.body.click(); // 关闭浮层
        return false;
    }

    console.log(`[V2 Executor] 发现 ${options.length} 个选项: ${options.map(o => o.text).join(' | ')}`);

    // Step 3: 让 AI 从选项中选择一个
    const choice = await askAIToChoose(fieldLabel, options.map(o => o.text), productData);
    console.log(`[V2 Executor] AI 选择: ${choice}`);

    // Step 4: 精确匹配选项（避免"不需要"匹配到"需要"）
    let targetOption = options.find(o => o.text === choice);

    // 如果精确匹配失败，尝试模糊匹配（但必须是选项包含选择，不是反过来）
    if (!targetOption) {
        targetOption = options.find(o => o.text.includes(choice));
    }

    // 仍然没找到，选第一个
    if (!targetOption) {
        console.warn(`[V2 Executor] 未找到匹配: ${choice}，使用第一个`);
        targetOption = options[0];
    }

    // 点击选项
    targetOption.element.scrollIntoView({ block: 'center' });
    await sleep(50);
    targetOption.element.click();
    await sleep(300);
    document.body.click();
    await sleep(200);
    console.log(`[V2 Executor] ✅ 点选成功: ${targetOption.text}`);
    return true;
}

// ==================== 辅助函数 ====================

/**
 * 关闭所有已打开的下拉浮层（多重保障）
 */
async function closeAllDropdowns(): Promise<void> {
    // 1. 按 ESC 键
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(100);

    // 2. 点击 body
    document.body.click();
    await sleep(100);

    // 3. 强制给所有浮层添加 hidden 类
    const dropdowns = document.querySelectorAll([
        '.ant-select-dropdown',
        '.el-select-dropdown',
        '.doraemon-select-dropdown'
    ].join(', '));

    dropdowns.forEach(d => {
        const el = d as HTMLElement;
        el.classList.add('ant-select-dropdown-hidden');
        el.style.display = 'none';
        el.style.visibility = 'hidden';
    });

    await sleep(100);
    console.log(`[V2 Executor] 已关闭 ${dropdowns.length} 个浮层`);
}

/**
 * 找到容器内可点击的触发元素
 */
function findClickableTrigger(container: HTMLElement): HTMLElement | null {
    // 优先找 select 组件
    const selectTriggers = [
        '.ant-select-selector',
        '.ant-select',
        '.el-select',
        '.doraemon-select',
        '.doraemon-select-selection',
        '[role="combobox"]',
        'input'
    ];

    for (const sel of selectTriggers) {
        const el = container.querySelector(sel) as HTMLElement;
        if (el) return el;
    }

    // 找 radio 的话返回容器本身
    if (container.querySelector('[class*="radio"]')) {
        return container;
    }

    return null;
}

/**
 * 获取当前可见的所有选项（等待浮层出现）
 */
async function getVisibleOptions(container: HTMLElement): Promise<Array<{ text: string, element: HTMLElement }>> {
    const options: Array<{ text: string, element: HTMLElement }> = [];

    // 等待浮层出现（最多等 1 秒）
    let dropdown: Element | null = null;
    for (let i = 0; i < 5; i++) {
        // 查找真正可见的浮层（排除 hidden 类和 display:none）
        const allDropdowns = document.querySelectorAll([
            '.ant-select-dropdown',
            '.el-select-dropdown',
            '.doraemon-select-dropdown'
        ].join(', '));

        for (const d of allDropdowns) {
            const el = d as HTMLElement;
            const style = window.getComputedStyle(el);
            const isHidden = el.classList.contains('ant-select-dropdown-hidden') ||
                style.display === 'none' ||
                style.visibility === 'hidden' ||
                el.getAttribute('aria-hidden') === 'true';

            if (!isHidden) {
                dropdown = d;
                break;
            }
        }

        if (dropdown) break;
        await sleep(200);
    }

    // 如果找到浮层，读取选项
    if (dropdown) {
        const items = dropdown.querySelectorAll([
            '.ant-select-item-option:not(.ant-select-item-option-disabled)',
            '.el-select-dropdown__item:not(.is-disabled)',
            '.doraemon-select-dropdown-menu-item:not(.is-disabled)',
            '[role="option"]'
        ].join(', '));

        items.forEach(item => {
            const text = (item as HTMLElement).innerText.trim();
            if (text && !text.includes('未找到') && !text.includes('点击申请')) {
                options.push({ text, element: item as HTMLElement });
            }
        });

        if (options.length > 0) return options;
    }

    // 方案2：容器内的 radio 选项
    const radios = container.querySelectorAll([
        '.el-radio',
        '.el-radio-button',
        '.ant-radio-wrapper',
        '.doraemon-radio-wrapper',
        'label[class*="radio"]'
    ].join(', '));

    radios.forEach(radio => {
        const text = (radio as HTMLElement).innerText.trim();
        if (text) {
            options.push({ text, element: radio as HTMLElement });
        }
    });

    return options;
}

/**
 * 调用 AI 从选项中选择
 */
async function askAIToChoose(
    fieldLabel: string,
    options: string[],
    productData?: ProductData
): Promise<string> {

    // 快速规则（不调 AI，秒选）
    const quickChoice = quickSelectRule(fieldLabel, options, productData);
    if (quickChoice) {
        console.log(`[V2 Executor] 快速规则命中: ${quickChoice}`);
        return quickChoice;
    }

    // 调用后端 AI
    try {
        const baseUrl = process.env.PLASMO_PUBLIC_BACKEND_URL || 'http://localhost:3000';
        const response = await fetch(`${baseUrl}/api/autofill/choose-option`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fieldLabel,
                options,
                // 传递完整的产品信息
                productTitle: productData?.title || '',
                productBrand: productData?.brand || '',
                productModel: productData?.model || '',
                manufacturer: productData?.manufacturer || productData?.brand || ''
            }),
            signal: AbortSignal.timeout(8000)
        });

        if (response.ok) {
            const result = await response.json();
            if (result.choice && options.includes(result.choice)) {
                return result.choice;
            }
        }
    } catch (e) {
        console.warn(`[V2 Executor] AI 调用失败:`, e);
    }

    // 兜底：选第一个
    console.log(`[V2 Executor] AI 失败，兜底选第一个`);
    return options[0];
}

/**
 * 快速选择规则（模式识别，不是硬编码字段名）
 */
function quickSelectRule(
    fieldLabel: string,
    options: string[],
    productData?: ProductData
): string | null {
    const label = fieldLabel.toLowerCase();
    const optionsLower = options.map(o => o.toLowerCase());

    // 模式1："是否xxx" / "有无xxx" → 优先选"否/不/无"
    if (label.includes('是否') || label.includes('有无')) {
        for (const opt of options) {
            if (opt.includes('否') || opt.includes('不') || opt.includes('无')) {
                return opt;
            }
        }
    }

    // 模式2："单位" / "计量" → 设备选"台"，否则选"件"
    if (label.includes('单位') || label.includes('计量')) {
        const title = (productData?.title || '').toLowerCase();
        // 如果是设备类，选"台"
        if (title.match(/机|设备|仪|器|台/)) {
            for (const opt of options) {
                if (opt === '台') return opt;
            }
        }
        // 否则选"件"
        for (const opt of options) {
            if (opt === '件' || opt === '个') return opt;
        }
    }

    // 模式3："产地" → 优先选"中国"或"国产"
    if (label.includes('产地') || label.includes('产区')) {
        for (const opt of options) {
            if (opt.includes('中国') || opt.includes('国产') || opt.includes('境内')) {
                return opt;
            }
        }
    }

    // 模式4："安装" → 小型设备不需要安装
    if (label.includes('安装')) {
        for (const opt of options) {
            if (opt.includes('不需要') || opt.includes('否') || opt.includes('不')) {
                return opt;
            }
        }
    }

    // 模式5："运费模板" → 选择默认/包邮
    if (label.includes('运费') || label.includes('模板')) {
        for (const opt of options) {
            if (opt.includes('默认') || opt.includes('包邮') || opt.includes('免运费')) {
                return opt;
            }
        }
        // 没有默认就选第一个
        return options[0];
    }

    // 模式6："产地"单选 → 选境内
    if (label === '产地') {
        for (const opt of options) {
            if (opt.includes('境内') || opt === '境内') {
                return opt;
            }
        }
    }

    return null;
}

// ==================== Checkbox 执行 ====================
async function executeCheckbox(container: HTMLElement, value: string): Promise<boolean> {
    const values = value.split(/[,，]/).map(v => v.trim());
    const checkboxes = container.querySelectorAll('.el-checkbox, .ant-checkbox-wrapper');
    let hitCount = 0;

    for (const v of values) {
        for (const cb of checkboxes) {
            if ((cb as HTMLElement).innerText.includes(v)) {
                (cb as HTMLElement).click();
                hitCount++;
                await sleep(100);
                break;
            }
        }
    }

    if (hitCount > 0) {
        console.log(`[V2 Executor] ✅ Checkbox 选中 ${hitCount} 个`);
        return true;
    }
    return false;
}

export const FillExecutor = { executeFill };
