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
 * 必填项精准捕获算法（放宽版）
 */
function isRequired(container: HTMLElement): boolean {
    // 1. 显性文本星号（放宽：查找更多位置）
    const allText = container.innerText || '';
    if (allText.includes('*') || allText.includes('＊')) {
        // 确保星号在 label 区域，不是在值区域
        const labelArea = container.querySelector('.el-form-item__label, .ant-form-item-label, label, .attr-label, [class*="label"]');
        if (labelArea && (labelArea.textContent?.includes('*') || labelArea.textContent?.includes('＊'))) {
            return true;
        }
    }

    // 2. 伪元素视觉检测 (红色星号样式)
    const labelSelectors = '.el-form-item__label, .ant-form-item-label, label, .attr-label, [class*="label"]';
    const labelEl = container.querySelector(labelSelectors);
    if (labelEl) {
        const brands = [':before', ':after'];
        for (const pseudo of brands) {
            try {
                const style = window.getComputedStyle(labelEl, pseudo);
                const content = style.getPropertyValue('content');
                const color = style.getPropertyValue('color');
                // 放宽颜色判断：红色系
                if (content && content !== 'none' && content !== '""' &&
                    (color.includes('255,') || color.includes('245,') || color.includes('rgb(255'))) {
                    return true;
                }
            } catch (e) {
                // 忽略伪元素读取错误
            }
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

    // 扫视所有可能的表单行容器（放宽版：更多选择器）
    const containerSelectors = [
        '.el-form-item',
        '.ant-form-item',
        '.doraemon-form-item',
        '.doraemon-row',           // 政采云行容器
        '.attr-row',
        '.publish-item',
        '.goods-attr-item',        // 政采云商品属性
        '[class*="form-item"]',    // 通配模糊匹配
        '[data-afield-id]',        // 已标记的字段
        '.doraemon-col',           // 政采云列容器
        '[class*="attr-item"]',    // 属性项
        '.item-row',               // 行容器
        '[class*="field"]',        // 字段容器
        'tr[class*="row"]',        // 表格行
        '[class*="required"]'      // 🆕 通用：任何带 required 类名的元素
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

/**
 * 星号扫描器（GPT 原始方案 - 100% 完整版）
 * 直接扫描页面上所有包含星号的元素
 */
interface StarScanResult {
    type: 'text' | 'pseudo';
    pseudo: string;
    content: string;
    textSnippet: string;
    hostTag: string;
    hostClass: string;
    hostId: string;
    x: number;
    y: number;
    w: number;
    h: number;
    el: HTMLElement;
}

function starScan(): StarScanResult[] {
    const STAR_RE = /[*＊]/;
    const out: StarScanResult[] = [];
    const seen = new Set<string>();

    // 检查元素是否可见
    function isVisibleEl(el: Element | null): boolean {
        if (!el || el.nodeType !== 1) return false;
        const htmlEl = el as HTMLElement;
        try {
            const st = getComputedStyle(htmlEl);
            if (st.display === 'none') return false;
            if (st.visibility === 'hidden') return false;
            if (Number(st.opacity) === 0) return false;
            const r = htmlEl.getBoundingClientRect();
            if (!r || r.width === 0 || r.height === 0) return false;
        } catch (e) {
            return false;
        }
        return true;
    }

    function addResult(type: 'text' | 'pseudo', el: HTMLElement, detail: { pseudo?: string; content?: string; textSnippet?: string }) {
        if (!el) return;

        // 给元素打 id，便于去重/定位
        if (!el.dataset.starScanId) {
            el.dataset.starScanId = 'ss_' + Math.random().toString(36).slice(2);
        }

        const uniq = type + '::' + el.dataset.starScanId + '::' + (detail?.pseudo || '') + '::' + (detail?.content || '');
        if (seen.has(uniq)) return;
        seen.add(uniq);

        const rect = el.getBoundingClientRect();
        out.push({
            type,
            pseudo: detail?.pseudo || '',
            content: detail?.content || '',
            textSnippet: detail?.textSnippet || '',
            hostTag: el.tagName.toLowerCase(),
            hostClass: (el.className && String(el.className).slice(0, 160)) || '',
            hostId: el.id || '',
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
            el,
        });
    }

    // 1. 扫描文本节点中的星号
    function scanTextNodes(root: Element | Document) {
        const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node: Text) {
                const t = node.nodeValue || '';
                if (!STAR_RE.test(t)) return NodeFilter.FILTER_REJECT;

                const host = node.parentElement;
                if (!host) return NodeFilter.FILTER_REJECT;

                const tag = host.tagName?.toLowerCase();
                if (tag === 'script' || tag === 'style' || tag === 'noscript') return NodeFilter.FILTER_REJECT;

                if (!isVisibleEl(host)) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });

        let n: Text | null;
        while ((n = tw.nextNode() as Text | null)) {
            const host = n.parentElement;
            if (!host) continue;
            const snippet = (n.nodeValue || '').replace(/\s+/g, ' ').trim().slice(0, 200);
            addResult('text', host, { textSnippet: snippet });
        }
    }

    // 2. 扫描伪元素中的星号
    function scanPseudo(root: Element | Document) {
        const all = root.querySelectorAll ? root.querySelectorAll('*') : [];
        const maxElements = 250000;
        let count = 0;

        for (const el of all) {
            count++;
            if (count > maxElements) break;
            if (!isVisibleEl(el)) continue;

            for (const pseudo of ['::before', '::after']) {
                try {
                    const st = getComputedStyle(el, pseudo);
                    if (!st) continue;

                    let c = st.content;
                    if (!c || c === 'none') continue;

                    c = String(c).replace(/^["']|["']$/g, '');
                    if (!STAR_RE.test(c)) continue;

                    addResult('pseudo', el as HTMLElement, { pseudo, content: c });
                } catch (e) {
                    continue;
                }
            }
        }
    }

    // 3. 扫描 Shadow DOM
    function scanShadowRoots(root: Element | Document) {
        const all = root.querySelectorAll ? root.querySelectorAll('*') : [];
        const maxElements = 250000;
        let count = 0;

        for (const el of all) {
            count++;
            if (count > maxElements) break;
            if ((el as any).shadowRoot) {
                try {
                    scanAll((el as any).shadowRoot);
                } catch (e) { }
            }
        }
    }

    // 4. 扫描同源 iframe
    function scanIframes() {
        const iframes = document.querySelectorAll('iframe');
        for (const fr of iframes) {
            try {
                const doc = fr.contentDocument;
                if (!doc) continue;
                scanAll(doc.documentElement);
            } catch (e) {
                // 跨域 iframe 无法访问，跳过
            }
        }
    }

    function scanAll(root?: Element | Document) {
        const base = root || document.documentElement;
        scanTextNodes(base);
        scanPseudo(base);
        scanShadowRoots(base);
    }

    // 执行扫描
    const t0 = performance.now();
    scanAll();
    scanIframes();
    const ms = Math.round(performance.now() - t0);

    // 按 y/x 排序
    out.sort((a, b) => (a.y - b.y) || (a.x - b.x));

    console.log(`[STAR_SCAN] 完成：找到 ${out.length} 个星号项，耗时 ${ms}ms`);
    console.log(`[STAR_SCAN] 详情:`, out.map(r => r.textSnippet?.slice(0, 30) || r.hostClass.slice(0, 30)).join(' | '));

    return out;
}

// ==================== RequiredFieldResolver 模块 ====================
// 职责：从星号宿主元素反推出完整的字段结构

/**
 * 结构化必填字段对象
 */
interface ResolvedField {
    label: string;
    required: boolean;
    controlType: 'radio' | 'select' | 'checkbox' | 'input' | 'textarea' | 'unknown';
    options?: string[];
    controlRef: HTMLElement | null;
    labelRef: HTMLElement | null;
}

/**
 * Label Resolver：从星号宿主元素向上找到真正的字段名称
 * 规则：向上遍历最多 12 层，优先命中 label 容器
 */
function resolveLabel(starHost: HTMLElement): { label: string; labelRef: HTMLElement | null } {
    const labelSelectors = [
        'label',
        '.doraemon-form-item-label',
        '.ant-form-item-label',
        '.el-form-item__label',
        '[class*="form-item-label"]',
        '[class*="attr-label"]',
        '[class*="label"]'
    ];

    let el: HTMLElement | null = starHost;
    let depth = 0;
    const maxDepth = 12;

    while (el && depth < maxDepth) {
        // 1. 当前元素是否是 label
        if (el.tagName.toLowerCase() === 'label') {
            const text = cleanLabel(el.textContent || '');
            if (text) return { label: text, labelRef: el };
        }

        // 2. 当前元素内部是否有 label 容器
        for (const sel of labelSelectors) {
            const labelEl = el.querySelector(sel) as HTMLElement;
            if (labelEl) {
                const text = cleanLabel(labelEl.textContent || '');
                if (text && text.length > 1 && text.length < 50) {
                    return { label: text, labelRef: labelEl };
                }
            }
        }

        // 3. 检查前一个兄弟节点（处理星号与 label 分离的结构）
        const prev = el.previousElementSibling as HTMLElement;
        if (prev) {
            const prevText = cleanLabel(prev.textContent || '');
            if (prevText && prevText.length > 1 && prevText.length < 30) {
                // 看起来像是 label
                return { label: prevText, labelRef: prev };
            }
        }

        el = el.parentElement;
        depth++;
    }

    return { label: '', labelRef: null };
}

/**
 * 清洗 label 文本
 */
function cleanLabel(text: string): string {
    return text
        .replace(/[*＊]/g, '')  // 去掉星号
        .replace(/[:：]/g, '')  // 去掉冒号
        .replace(/\s+/g, '')    // 去掉空白
        .trim();
}

/**
 * Field Resolver：从 label 容器找到可交互控件并判断类型
 */
function resolveField(labelRef: HTMLElement | null, starHost: HTMLElement): {
    controlType: ResolvedField['controlType'];
    options: string[];
    controlRef: HTMLElement | null
} {
    // 找到表单行容器（向上找到包含控件的容器）
    let container: HTMLElement | null = labelRef || starHost;
    let depth = 0;

    while (container && depth < 8) {
        // 检查是否是表单行容器
        const isFormRow = container.classList.contains('doraemon-form-item') ||
            container.classList.contains('ant-form-item') ||
            container.classList.contains('el-form-item') ||
            container.className.includes('form-item') ||
            container.className.includes('attr-item');

        if (isFormRow) break;
        container = container.parentElement;
        depth++;
    }

    if (!container) {
        container = starHost.parentElement?.parentElement || starHost;
    }

    // 使用现有的 detectControlType 函数
    const controlType = detectControlType(container as HTMLElement);

    // 提取 options（如果是 radio 或有可见选项）
    const options: string[] = [];

    // Radio options
    const radioItems = container.querySelectorAll('.doraemon-radio-wrapper, .ant-radio-wrapper, .el-radio');
    if (radioItems.length > 0) {
        radioItems.forEach(item => {
            const text = cleanLabel(item.textContent || '');
            if (text) options.push(text);
        });
    }

    // 找到控件元素
    let controlRef: HTMLElement | null = null;
    const controlSelectors = [
        'input[type="radio"]',
        'input[type="checkbox"]',
        '.doraemon-select',
        '.ant-select',
        'select',
        'textarea',
        'input'
    ];

    for (const sel of controlSelectors) {
        controlRef = container.querySelector(sel) as HTMLElement;
        if (controlRef) break;
    }

    return {
        controlType: controlType as ResolvedField['controlType'],
        options,
        controlRef
    };
}

/**
 * RequiredFieldResolver：整合 STAR_SCAN + Label Resolver + Field Resolver
 * 返回结构化的必填字段列表
 */
function resolveRequiredFields(): ResolvedField[] {
    console.log('[RequiredFieldResolver] 开始解析必填字段...');

    // Step 1: 使用 STAR_SCAN 找到所有星号元素
    const starResults = starScan();
    console.log(`[RequiredFieldResolver] STAR_SCAN 找到 ${starResults.length} 个星号元素`);

    const resolvedFields: ResolvedField[] = [];
    const seenLabels = new Set<string>();

    // Step 2: 对每个星号元素进行解析
    for (const star of starResults) {
        const starHost = star.el;
        if (!starHost) continue;

        // Step 2a: 解析 label
        const { label, labelRef } = resolveLabel(starHost);

        if (!label || label.length < 2) {
            continue; // 无法解析 label，跳过
        }

        // 去重
        if (seenLabels.has(label)) continue;
        seenLabels.add(label);

        // Step 2b: 解析控件
        const { controlType, options, controlRef } = resolveField(labelRef, starHost);

        resolvedFields.push({
            label,
            required: true,
            controlType,
            options: options.length > 0 ? options : undefined,
            controlRef,
            labelRef
        });
    }

    console.log(`[RequiredFieldResolver] 成功解析 ${resolvedFields.length} 个必填字段`);
    resolvedFields.forEach(f => {
        console.log(`[RequiredFieldResolver] ✓ ${f.label} (${f.controlType})${f.options ? ` [${f.options.join(',')}]` : ''}`);
    });

    return resolvedFields;
}

export const PageScanner = { scanRequiredFields, starScan, resolveRequiredFields };
