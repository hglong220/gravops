/**
 * RPA 执行器 V5
 * 
 * 接收后端生成的操作指令，逐步执行
 * 支持两种格式：
 * 1. 新格式 RpaCommand (type: OPEN_DIALOG, SELECT_BID, etc.)
 * 2. 旧格式 RpaOperation (action: click, input, wait)
 */

// 新指令类型
type RpaCommandType =
    | 'OPEN_DIALOG'
    | 'EXPAND_MARKET'
    | 'SELECT_BID'
    | 'CONFIRM_DIALOG'
    | 'SELECT_CATEGORY'
    | 'INPUT_BRAND'
    | 'SELECT_BRAND'
    | 'INPUT_MODEL'
    | 'SELECT_MODEL'
    | 'CLICK_NEXT'
    | 'WAIT';

interface RpaCommand {
    type: RpaCommandType;
    value?: string;
    waitMs?: number;
    note?: string;
}

// 旧操作类型（兼容）
interface RpaOperation {
    step: number;
    action: 'click' | 'input' | 'wait' | 'scroll';
    target: string;
    selector?: string;
    text?: string;
    value?: string;
    waitMs?: number;
}

// 执行结果
interface ExecutionResult {
    success: boolean;
    completedSteps: number;
    totalSteps: number;
    error?: string;
    failedStep?: number;
}

// 日志函数
function log(message: string, type: 'info' | 'success' | 'error' = 'info') {
    const icons = { info: '📋', success: '✅', error: '❌' };
    console.log(`[RPA执行器] ${icons[type]} ${message}`);
}

// 等待函数
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 高亮元素
function highlight(el: HTMLElement, label: string): void {
    const rect = el.getBoundingClientRect();

    // 移除旧高亮
    const old = document.getElementById('rpa-highlight');
    if (old) old.remove();

    // 创建高亮框
    const box = document.createElement('div');
    box.id = 'rpa-highlight';
    box.style.cssText = `
        position: fixed;
        left: ${rect.left - 3}px;
        top: ${rect.top - 3}px;
        width: ${rect.width + 6}px;
        height: ${rect.height + 6}px;
        border: 3px solid #FF0000;
        border-radius: 4px;
        pointer-events: none;
        z-index: 999999;
        box-shadow: 0 0 10px rgba(255,0,0,0.5);
    `;

    // 标签
    const labelEl = document.createElement('div');
    labelEl.style.cssText = `
        position: absolute;
        top: -28px;
        left: 0;
        background: #FF0000;
        color: white;
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 14px;
        font-weight: bold;
    `;
    labelEl.textContent = label;
    box.appendChild(labelEl);

    document.body.appendChild(box);
}

// 移除高亮
function removeHighlight(): void {
    const box = document.getElementById('rpa-highlight');
    if (box) box.remove();
}

// 查找元素（按文本或选择器）
function findElement(op: RpaOperation): HTMLElement | null {
    // 优先按文本查找
    if (op.text) {
        // 查找按钮
        const buttons = document.querySelectorAll('button, .el-button');
        for (const btn of buttons) {
            if (btn.textContent?.includes(op.text)) {
                return btn as HTMLElement;
            }
        }

        // 查找包含文本的元素
        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
            const text = el.textContent?.trim() || '';
            const cleanText = text.replace(/\s*[\(（]\d+[\)）]\s*$/, '').trim();

            if (cleanText === op.text || text.includes(op.text)) {
                // 确保是可点击的元素
                const tag = el.tagName.toLowerCase();
                if (['button', 'a', 'li', 'span', 'div', 'label', 'input', 'i', 'td', 'tr'].includes(tag)) {
                    const rect = (el as HTMLElement).getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        return el as HTMLElement;
                    }
                }
            }
        }
    }

    // 按选择器查找
    if (op.selector) {
        const selectors = op.selector.split(',').map(s => s.trim());
        for (const sel of selectors) {
            const el = document.querySelector(sel) as HTMLElement;
            if (el) {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    return el;
                }
            }
        }
    }

    return null;
}

// 执行点击操作
async function executeClick(op: RpaOperation): Promise<boolean> {
    log(`步骤${op.step}: 点击 - ${op.target}`);

    // 等待元素出现（最多10秒）
    let el: HTMLElement | null = null;
    for (let i = 0; i < 20; i++) {
        el = findElement(op);
        if (el) break;
        await sleep(500);
        log(`  等待元素... (${i + 1}/20)`);
    }

    if (!el) {
        log(`  未找到元素: ${op.target}`, 'error');
        return false;
    }

    // 高亮元素
    highlight(el, `步骤${op.step}: ${op.target}`);
    log(`  找到元素，准备点击...`);

    // 等待让用户看到
    await sleep(1000);

    // 执行点击 - 使用真正的用户交互模拟
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await sleep(300);

    // 获取元素中心点坐标
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    // 完整的鼠标事件序列（模拟真实用户点击）
    const eventOptions = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
        screenX: x,
        screenY: y,
        button: 0,
        buttons: 1
    };

    // 1. 鼠标移入
    el.dispatchEvent(new MouseEvent('mouseenter', eventOptions));
    el.dispatchEvent(new MouseEvent('mouseover', eventOptions));

    // 2. 鼠标按下
    el.dispatchEvent(new MouseEvent('mousedown', eventOptions));

    // 3. 聚焦（如果可聚焦）
    if (typeof el.focus === 'function') {
        el.focus();
    }

    await sleep(50);

    // 4. 鼠标抬起
    el.dispatchEvent(new MouseEvent('mouseup', eventOptions));

    // 5. 点击事件
    el.dispatchEvent(new MouseEvent('click', eventOptions));

    // 6. 原生点击（备用）
    el.click();

    // 7. 如果是 input/button，触发 change 事件
    if (el.tagName === 'INPUT' || el.tagName === 'BUTTON') {
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    log(`  点击完成 ✓`, 'success');

    // 等待操作生效
    const waitTime = op.waitMs || 2000;
    await sleep(waitTime);

    removeHighlight();
    return true;
}

// 执行输入操作
async function executeInput(op: RpaOperation): Promise<boolean> {
    log(`步骤${op.step}: 输入 - ${op.target}`);

    if (!op.value) {
        log(`  无输入值，跳过`);
        return true;
    }

    // 查找输入框
    let input: HTMLInputElement | null = null;

    if (op.selector) {
        const selectors = op.selector.split(',').map(s => s.trim());
        for (const sel of selectors) {
            input = document.querySelector(sel) as HTMLInputElement;
            if (input) break;
        }
    }

    if (!input) {
        // 查找任何可见的输入框
        const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"])');
        for (const inp of inputs) {
            const rect = (inp as HTMLElement).getBoundingClientRect();
            if (rect.width > 50 && rect.height > 20) {
                input = inp as HTMLInputElement;
                break;
            }
        }
    }

    if (!input) {
        log(`  未找到输入框`, 'error');
        return false;
    }

    highlight(input, `步骤${op.step}: 输入 ${op.value}`);

    await sleep(500);

    // 聚焦并输入
    input.focus();
    input.value = op.value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    log(`  输入完成: ${op.value} ✓`, 'success');

    await sleep(op.waitMs || 1000);
    removeHighlight();

    return true;
}

// 执行等待操作
async function executeWait(op: RpaOperation): Promise<boolean> {
    log(`步骤${op.step}: 等待 - ${op.target}`);

    const timeout = op.waitMs || 3000;

    if (op.selector) {
        // 等待元素出现
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const el = document.querySelector(op.selector);
            if (el) {
                log(`  元素已出现 ✓`, 'success');
                return true;
            }
            await sleep(200);
        }
        log(`  等待超时，继续执行...`);
    } else {
        // 纯等待
        await sleep(timeout);
        log(`  等待完成 ✓`, 'success');
    }

    return true;
}

// 专门处理展开网上超市操作
async function executeExpandMarket(step: number): Promise<boolean> {
    log(`步骤${step}: 展开网上超市`);

    // 1. 找到包含"网上超市"的行
    const rows = document.querySelectorAll('tr');
    let targetRow: HTMLElement | null = null;

    for (const row of rows) {
        if (row.textContent?.includes('网上超市')) {
            targetRow = row as HTMLElement;
            break;
        }
    }

    if (!targetRow) {
        log('  未找到网上超市行', 'error');
        return false;
    }

    log('  找到网上超市行');

    // 2. 在该行中找到展开按钮（+ 号）
    // ** 正确的选择器放在最前面 **
    const expandSelectors = [
        '.doraemon-table-row-expand-icon',           // ← 正确的选择器！
        '[aria-label="展开行"]',                      // 按 aria-label
        'div[role="button"][class*="expand"]',       // div 按钮
        '.el-table__expand-icon',
        'i.el-icon-arrow-right',
        'i.el-icon-plus',
        '.expand-icon',
        'i[class*="expand"]',
        'i[class*="arrow"]',
        'td:first-child i',
        'td:first-child .cell i'
    ];

    let expandBtn: HTMLElement | null = null;

    for (const selector of expandSelectors) {
        const btn = targetRow.querySelector(selector) as HTMLElement;
        if (btn) {
            expandBtn = btn;
            log(`  找到展开按钮: ${selector}`);
            break;
        }
    }

    // 如果没找到，尝试找第一个单元格里的任何可点击元素
    if (!expandBtn) {
        const firstCell = targetRow.querySelector('td:first-child .cell') || targetRow.querySelector('td:first-child');
        if (firstCell) {
            const icons = firstCell.querySelectorAll('i, span, div');
            for (const icon of icons) {
                const rect = (icon as HTMLElement).getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0 && rect.width < 30) {
                    expandBtn = icon as HTMLElement;
                    log('  使用第一个单元格内的图标');
                    break;
                }
            }
        }
    }

    if (!expandBtn) {
        log('  未找到展开按钮', 'error');
        return false;
    }

    // 高亮并点击
    highlight(expandBtn, `步骤${step}: 展开网上超市`);
    await sleep(1000);

    // 获取当前行数
    const rowsBefore = document.querySelectorAll('tr').length;

    // 完整的鼠标事件序列（模拟真实用户点击）
    const rect = expandBtn.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const eventOptions = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
        screenX: x,
        screenY: y,
        button: 0,
        buttons: 1
    };

    // 鼠标事件序列
    expandBtn.dispatchEvent(new MouseEvent('mouseenter', eventOptions));
    expandBtn.dispatchEvent(new MouseEvent('mouseover', eventOptions));
    expandBtn.dispatchEvent(new MouseEvent('mousedown', eventOptions));
    if (typeof expandBtn.focus === 'function') expandBtn.focus();
    await sleep(50);
    expandBtn.dispatchEvent(new MouseEvent('mouseup', eventOptions));
    expandBtn.dispatchEvent(new MouseEvent('click', eventOptions));
    expandBtn.click();

    // 如果是 div 按钮，也点击父元素
    if (expandBtn.tagName.toLowerCase() === 'div' || expandBtn.tagName.toLowerCase() === 'i') {
        expandBtn.parentElement?.click();
    }

    log('  已点击展开按钮');

    // 等待展开（检查行数增加）
    for (let i = 0; i < 10; i++) {
        await sleep(500);
        const rowsAfter = document.querySelectorAll('tr').length;
        if (rowsAfter > rowsBefore) {
            log(`  展开成功: ${rowsBefore} → ${rowsAfter} 行`, 'success');
            removeHighlight();
            return true;
        }
    }

    log('  展开可能未生效，继续执行...', 'error');
    removeHighlight();
    return true; // 继续执行，让后续步骤尝试
}

// 将 RpaCommand 转换为 RpaOperation
function convertCommandToOperation(cmd: RpaCommand, index: number): RpaOperation {
    const step = index + 1;

    switch (cmd.type) {
        case 'OPEN_DIALOG':
            return { step, action: 'click', target: '修改按钮', text: '修改', waitMs: 2000 };
        case 'EXPAND_MARKET':
            return { step, action: 'click', target: '展开网上超市', text: '网上超市', selector: '.el-table__expand-icon, .el-icon-plus, i[class*="expand"], i[class*="plus"]', waitMs: 2000 };
        case 'SELECT_BID':
            return { step, action: 'click', target: `选择标项: ${cmd.value}`, text: cmd.value, selector: 'input[type="radio"], .el-radio', waitMs: 1500 };
        case 'CONFIRM_DIALOG':
            return { step, action: 'click', target: '确定', text: '确定', waitMs: 3000 };
        case 'SELECT_CATEGORY':
            return { step, action: 'click', target: `选择类目: ${cmd.value}`, text: cmd.value, waitMs: 1500 };
        case 'INPUT_BRAND':
            return { step, action: 'input', target: '输入品牌', selector: '.doraemon-select-search__field, input[placeholder*="品牌"], input[placeholder*="搜索"]', value: cmd.value, waitMs: 1000 };
        case 'SELECT_BRAND':
            return { step, action: 'click', target: `选择品牌: ${cmd.value}`, text: cmd.value, selector: '.doraemon-select-dropdown-menu-item, .el-select-dropdown__item', waitMs: 1000 };
        case 'INPUT_MODEL':
            return { step, action: 'input', target: '输入型号', selector: 'input#specification, input[placeholder*="型号"]', value: cmd.value, waitMs: 1000 };
        case 'SELECT_MODEL':
            return { step, action: 'click', target: `选择型号: ${cmd.value}`, text: cmd.value, selector: '.doraemon-select-dropdown-menu-item, .el-select-dropdown__item', waitMs: 1000 };
        case 'CLICK_NEXT':
            return { step, action: 'click', target: '下一步', text: '下一步', waitMs: 2000 };
        case 'WAIT':
            return { step, action: 'wait', target: '等待', waitMs: cmd.waitMs || 2000 };
        default:
            return { step, action: 'wait', target: `未知指令: ${cmd.type}`, waitMs: 1000 };
    }
}

// 判断是否是新格式
function isRpaCommand(item: RpaCommand | RpaOperation): item is RpaCommand {
    return 'type' in item && typeof item.type === 'string';
}

// 主执行函数（支持两种格式）
export async function executeOperations(items: (RpaCommand | RpaOperation)[]): Promise<ExecutionResult> {
    log(`开始执行 ${items.length} 个步骤`);
    log('═'.repeat(40));

    let completedSteps = 0;

    for (let index = 0; index < items.length; index++) {
        const item = items[index];
        let success = false;
        const step = index + 1;

        try {
            // 检查是否是 EXPAND_MARKET 命令（需要特殊处理）
            if (isRpaCommand(item) && item.type === 'EXPAND_MARKET') {
                success = await executeExpandMarket(step);
            } else {
                // 转换为 RpaOperation 并执行
                const op = isRpaCommand(item)
                    ? convertCommandToOperation(item, index)
                    : (item as RpaOperation);

                switch (op.action) {
                    case 'click':
                        success = await executeClick(op);
                        break;
                    case 'input':
                        success = await executeInput(op);
                        break;
                    case 'wait':
                        success = await executeWait(op);
                        break;
                    default:
                        log(`未知操作: ${op.action}`, 'error');
                        success = false;
                }
            }
        } catch (error) {
            log(`步骤${step}执行出错: ${error}`, 'error');
            success = false;
        }

        if (!success) {
            log('═'.repeat(40));
            log(`执行失败，停止在步骤 ${step}`, 'error');

            return {
                success: false,
                completedSteps,
                totalSteps: items.length,
                error: `步骤${step}失败`,
                failedStep: step
            };
        }

        completedSteps++;
    }

    log('═'.repeat(40));
    log(`全部 ${items.length} 个步骤执行完成！`, 'success');
    removeHighlight();

    return {
        success: true,
        completedSteps,
        totalSteps: items.length
    };
}

// 导出
export type { RpaOperation, RpaCommand, ExecutionResult };
