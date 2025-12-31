import type { ProductData, AutoFillReport } from './types';
import { VisionBridge } from '../../lib/vision-bridge';

/**
 * V2 主循环 - Gemini 视觉 AI 主导方案
 * 
 * 核心原则：
 * 1. 截取页面，发给 Gemini 分析所有必填项
 * 2. Gemini 返回每个字段的填写计划
 * 3. 软件按计划执行填写（不需要思考）
 */

function sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
}

// ==================== 类型定义 ====================

interface FormField {
    label: string;
    type: 'input' | 'select' | 'radio' | 'checkbox' | 'textarea';
    value: string;
    options?: string[];
    required: boolean;
    confidence: number;
}

interface FormAnalysisResult {
    success: boolean;
    fields: FormField[];
    summary: string;
    error?: string;
}

// ==================== 主流程 ====================

export async function runAutoFillV2(productData: ProductData): Promise<AutoFillReport> {
    const report: AutoFillReport = {
        success: false,
        filledCount: 0,
        failedCount: 0,
        failedFields: []
    };

    console.log('[V2] ═══════════════════════════════════════════════════════');
    console.log('[V2] 🚀 Gemini 视觉 AI 填表引擎启动');
    console.log('[V2] ═══════════════════════════════════════════════════════');
    console.log('[V2] 商品:', productData.title);
    console.log('[V2] 品牌:', productData.brand, '| 型号:', productData.model);
    console.log('[V2] ⭐ 电商链接:', productData.platform_link || '❌ 未提供');
    console.log('[V2] ⭐ 价格:', productData.price, '| 库存:', productData.stock);

    try {
        // Step 1: 等待页面稳定
        console.log('[V2] Step 1: 等待页面稳定...');
        await waitForFormStable();

        // Step 2: 滚动页面收集所有区域
        console.log('[V2] Step 2: 滚动页面收集所有区域...');
        await scrollToCollectAll();

        // Step 3: 截取页面截图（多张，覆盖整个页面）
        console.log('[V2] Step 3: 截取页面多张截图...');
        const screenshots = await captureMultipleScreenshots();
        if (screenshots.length === 0) {
            console.error('[V2] ❌ 截图失败');
            return { ...report, success: false };
        }
        const totalSize = screenshots.reduce((sum, s) => sum + s.length, 0);
        console.log(`[V2] 截取 ${screenshots.length} 张截图，总大小: ${Math.round(totalSize / 1024)} KB`);

        // Step 4: 发给 Gemini 分析（一次性发送多张截图）
        console.log('[V2] Step 4: 发送给 Gemini 分析...');
        const analysis = await analyzeWithGemini(screenshots, productData);

        if (!analysis.success) {
            console.error('[V2] ❌ Gemini 分析失败:', analysis.error);
            return { ...report, success: false };
        }

        console.log('[V2] Gemini 分析完成:', analysis.summary);
        console.log('[V2] 识别到', analysis.fields.length, '个字段');

        // 打印识别结果
        for (const field of analysis.fields) {
            const icon = field.required ? '⭐' : '○';
            console.log(`[V2] ${icon} ${field.label} (${field.type}) → "${field.value}"`);
        }

        // Step 5: 执行填写
        console.log('[V2] Step 5: 开始执行填写...');

        // 过滤掉不应该自动填写的字段
        const skipLabels = ['商品图片', '主图', '详情图', '规格图片', '商品详情', '图片', '商品标题'];
        // 这些字段如果UI上已经有值了，就跳过
        const maybeFilledLabels = ['品牌', '型号', '商品名称'];

        const requiredFields = analysis.fields.filter(f => {
            if (!f.required) return false;
            // 跳过图片类字段
            if (skipLabels.some(skip => f.label.includes(skip))) {
                console.log(`[V2] 跳过图片字段: ${f.label}`);
                return false;
            }
            return true;
        });

        console.log('[V2] 需要填写', requiredFields.length, '个必填项');

        // productData 在函数参数中已经有了

        for (const field of requiredFields) {
            console.log(`[V2] 填写: ${field.label}`);

            // ★ 关键：强制使用采集的数据覆盖 Gemini 推荐的值
            if (field.label.includes('电商平台链接') || field.label.includes('平台链接')) {
                if (productData.platform_link) {
                    field.value = productData.platform_link;
                    console.log(`[V2] 使用采集的电商链接: ${field.value}`);
                }
            }
            if (field.label.includes('运费模板')) {
                field.value = '默认';
                console.log(`[V2] 运费模板使用: 默认`);
            }
            if (field.label.includes('是否需要安装')) {
                field.value = '不需要';
                field.type = 'select'; // 强制设为 select 类型
                console.log(`[V2] 是否需要安装使用: 不需要`);
            }

            try {
                const success = await executeFieldFill(field);

                if (success) {
                    report.filledCount++;
                    console.log(`[V2] ✅ ${field.label} = "${field.value}"`);
                } else {
                    report.failedCount++;
                    report.failedFields.push({ label: field.label, reason: '定位或填写失败' });
                    console.log(`[V2] ❌ ${field.label} 失败`);
                }

                await sleep(300);

            } catch (e) {
                console.error(`[V2] 异常: ${field.label}`, e);
                report.failedCount++;
                report.failedFields.push({ label: field.label, reason: '异常' });
            }
        }

        // Step 6: 完成
        report.success = report.failedCount === 0;
        console.log('[V2] ═══════════════════════════════════════════════════════');
        console.log(`[V2] ✅ 完成: 成功 ${report.filledCount}, 失败 ${report.failedCount}`);
        console.log('[V2] ═══════════════════════════════════════════════════════');

        return report;

    } catch (error) {
        console.error('[V2] 主流程异常:', error);
        return { ...report, success: false };
    }
}

// ==================== 截图模块 ====================

/**
 * 截取当前可见区域
 * 直接使用 VisionBridge 的截图能力
 */
async function captureFullPage(): Promise<string | null> {
    try {
        console.log('[V2] 使用 VisionBridge 截图...');
        const screenshot = await VisionBridge.captureScreenshot();
        console.log('[V2] 截图成功，大小:', Math.round(screenshot.length / 1024), 'KB');
        return screenshot;
    } catch (error) {
        console.error('[V2] 截图失败:', error);
        return null;
    }
}

/**
 * 滚动页面截取多张截图（覆盖整个页面）
 * 根据页面高度动态决定截图数量（最多7张，5%重叠）
 */
async function captureMultipleScreenshots(): Promise<string[]> {
    const screenshots: string[] = [];

    try {
        // 1. 获取页面总高度
        const totalHeight = document.body.scrollHeight;
        const viewportHeight = window.innerHeight;

        // 2. 计算需要截取的次数（每次滚动65%视口高度，有5%重叠，减少冗余）
        const scrollStep = Math.floor(viewportHeight * 0.65);
        let numScreenshots = Math.ceil(totalHeight / scrollStep);
        numScreenshots = Math.max(1, Math.min(numScreenshots, 7)); // 最少1张，最多7张

        console.log(`[V2] 页面高度: ${totalHeight}px, 视口高度: ${viewportHeight}px, 计划截取 ${numScreenshots} 张`);

        // 3. 先滚到顶部
        window.scrollTo(0, 0);
        await sleep(400);

        // 4. 循环截图
        for (let i = 0; i < numScreenshots; i++) {
            // 计算滚动位置
            let scrollPos = i * scrollStep;
            // 最后一张确保滚到底部
            if (i === numScreenshots - 1 && numScreenshots > 1) {
                scrollPos = Math.max(0, totalHeight - viewportHeight);
            }

            window.scrollTo(0, scrollPos);
            await sleep(400);

            const shot = await VisionBridge.captureScreenshot();
            if (shot) {
                screenshots.push(shot);
                console.log(`[V2] 截图 ${i + 1}/${numScreenshots} 成功，位置: ${scrollPos}px，大小: ${Math.round(shot.length / 1024)} KB`);
            }
        }

        // 5. 滚回顶部
        window.scrollTo(0, 0);
        await sleep(300);

        console.log(`[V2] 共截取 ${screenshots.length} 张截图`);

    } catch (error) {
        console.error('[V2] 多截图失败:', error);
    }

    return screenshots;
}

/**
 * 滚动页面收集所有区域
 */
async function scrollToCollectAll(): Promise<void> {
    // 先滚动到顶部
    window.scrollTo(0, 0);
    await sleep(300);

    // 展开所有折叠区域
    const collapseToggles = document.querySelectorAll('.slide-up-down-trigger, [class*="collapse"]');
    for (const toggle of collapseToggles) {
        const text = (toggle as HTMLElement).innerText;
        if (text.includes('展开')) {
            (toggle as HTMLElement).click();
            await sleep(200);
        }
    }

    // 滚动到底部再回到顶部（触发所有懒加载）
    window.scrollTo(0, document.body.scrollHeight);
    await sleep(500);
    window.scrollTo(0, 0);
    await sleep(300);
}

// ==================== Gemini 分析模块 ====================

/**
 * 调用后端 Gemini 视觉分析接口
 * 通过 background 的 API_PROXY 绕过 Mixed Content 限制
 * 支持单张或多张截图
 */
async function analyzeWithGemini(screenshots: string | string[], productData: ProductData): Promise<FormAnalysisResult> {
    try {
        const baseUrl = 'http://localhost:3000';
        const url = `${baseUrl}/api/vision/form-analyze`;

        // 统一转换为数组格式
        const screenshotArray = Array.isArray(screenshots) ? screenshots : [screenshots];

        const body = {
            screenshots: screenshotArray,  // 使用数组格式
            productInfo: {
                title: productData.title,
                brand: productData.brand,
                model: productData.model,
                price: productData.price,
                salePrice: productData.salePrice,
                stock: productData.stock || 99,
                manufacturer: productData.manufacturer || productData.brand,
                platform_link: productData.platform_link,
                specs: productData.specs
            }
        };

        // 通过 background 代理 API 请求（绕过 Mixed Content）
        const response = await new Promise<any>((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                chrome.runtime.sendMessage(
                    {
                        type: 'API_PROXY',
                        url,
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body
                    },
                    (res) => {
                        if (chrome.runtime.lastError) {
                            resolve({ ok: false, error: chrome.runtime.lastError.message });
                        } else {
                            resolve(res);
                        }
                    }
                );

                // 超时处理
                setTimeout(() => {
                    resolve({ ok: false, error: '请求超时 (60s)' });
                }, 60000);
            } else {
                resolve({ ok: false, error: 'chrome.runtime 不可用' });
            }
        });

        if (!response.ok) {
            return {
                success: false,
                fields: [],
                summary: '',
                error: response.error || `HTTP ${response.status}`
            };
        }

        return response.data;

    } catch (error: any) {
        return {
            success: false,
            fields: [],
            summary: '',
            error: error.message || '网络异常'
        };
    }
}

// ==================== 填写执行模块 ====================

/**
 * 按 label 定位 DOM 并执行填写
 */
async function executeFieldFill(field: FormField): Promise<boolean> {
    const { label, type, value, options } = field;

    // Step 1: 按 label 定位字段容器
    const container = findFieldContainer(label);
    if (!container) {
        console.warn(`[V2] 未找到字段容器: ${label}`);
        return false;
    }

    // 滚动到可见区域
    container.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(200);

    // Step 2: 根据类型执行填写
    switch (type) {
        case 'radio':
            return await fillRadio(container, value);
        case 'select':
            return await fillSelect(container, value);
        case 'input':
        case 'textarea':
            return await fillInput(container, value);
        case 'checkbox':
            return await fillCheckbox(container, value);
        default:
            // 尝试通用填写
            return await fillInput(container, value);
    }
}

/**
 * 按 label 文本定位字段容器（包含 label + 控件的整行容器）
 */
function findFieldContainer(label: string): HTMLElement | null {
    // 标准化 label（去除空格、星号等）
    const normalizedLabel = label.replace(/[*\s:：]/g, '').trim();
    console.log(`[V2] 查找字段容器: "${label}" → 标准化: "${normalizedLabel}"`);

    // 搜索所有 label 元素
    const labelSelectors = [
        'label.doraemon-form-item-required',  // 优先找必填标记的 label
        'label.doraemon-form-item-label',
        '.doraemon-form-item-label label',
        '.el-form-item__label',
        'th',  // 表格表头（销售规格区域）
        'td',  // 表格单元格
        'span.item-label',  // 其他可能的 label 容器
        'div.label',
        'label'
    ];

    for (const selector of labelSelectors) {
        const labels = document.querySelectorAll(selector);
        for (const labelEl of labels) {
            const rawText = (labelEl as HTMLElement).innerText || '';
            const text = rawText.replace(/[*\s:：]/g, '').trim();

            // 精确匹配优先
            const isExactMatch = text === normalizedLabel;
            const isPartialMatch = text.includes(normalizedLabel) || normalizedLabel.includes(text);

            if ((isExactMatch || isPartialMatch) && text.length > 0) {
                console.log(`[V2] 匹配到 label: "${rawText}" (选择器: ${selector})`);

                // 策略：从 label 向上找，跳过 label 容器，找到包含控件的行容器
                let current = labelEl as HTMLElement;

                // 向上遍历最多 5 层
                for (let i = 0; i < 5; i++) {
                    const parent = current.parentElement;
                    if (!parent) break;

                    // 检查这个父元素是否包含控件（说明是整行容器）
                    const hasControl = parent.querySelector(
                        'input:not([type="hidden"]), .doraemon-select, .doraemon-radio-group, .el-select, .el-radio-group, textarea'
                    );

                    if (hasControl) {
                        console.log(`[V2] 找到包含控件的容器:`, parent.className);
                        return parent;
                    }

                    current = parent;
                }

                // 备用：直接用 doraemon-form-item 或 doraemon-row
                const formItem = (labelEl as HTMLElement).closest('.doraemon-form-item');
                if (formItem) {
                    console.log(`[V2] 使用 doraemon-form-item 容器:`, formItem.className);
                    return formItem as HTMLElement;
                }

                const row = (labelEl as HTMLElement).closest('.doraemon-row');
                if (row) {
                    console.log(`[V2] 使用 doraemon-row 容器:`, row.className);
                    return row as HTMLElement;
                }
            }
        }
    }

    // 备选策略：在销售规格区域查找（表格结构）
    const specTable = document.querySelector('.sku-table, .item-container, [class*="spec"], [class*="price"]');
    if (specTable) {
        // 在表格中查找包含该文字的单元格
        const cells = specTable.querySelectorAll('th, td, .item-label');
        for (const cell of cells) {
            const cellText = (cell as HTMLElement).innerText?.replace(/[*\s:：]/g, '').trim() || '';
            if (cellText === normalizedLabel || cellText.includes(normalizedLabel)) {
                console.log(`[V2] 在规格表格中找到: "${cellText}"`);
                // 返回包含输入框的容器
                const row = cell.closest('tr, .item-container, .item-row');
                if (row) return row as HTMLElement;
                return specTable as HTMLElement;
            }
        }
    }

    // 备选策略2：直接查找包含该文字的区域
    const allDivs = document.querySelectorAll('div, span');
    for (const div of allDivs) {
        const text = (div as HTMLElement).innerText?.replace(/[*\s:：]/g, '').trim() || '';
        if (text === normalizedLabel && (div as HTMLElement).querySelectorAll('*').length < 5) {
            // 找到了精确匹配的小元素，向上找包含 input 的容器
            let parent = div.parentElement;
            for (let i = 0; i < 5 && parent; i++) {
                const hasInput = parent.querySelector('input, select, textarea');
                if (hasInput) {
                    console.log(`[V2] 通过文字向上查找到容器`);
                    return parent as HTMLElement;
                }
                parent = parent.parentElement;
            }
        }
    }

    console.warn(`[V2] 未找到匹配的 label: "${label}"`);
    return null;
}

/**
 * 填写 Radio
 */
async function fillRadio(container: HTMLElement, value: string): Promise<boolean> {
    const radios = container.querySelectorAll('.doraemon-radio, .el-radio, input[type="radio"]');

    const normalizedValue = value.trim().toLowerCase();
    let clicked = false;

    for (const radio of radios) {
        const radioEl = radio as HTMLElement;
        const text = radioEl.innerText?.trim().toLowerCase() || '';

        if (text === normalizedValue || text.includes(normalizedValue) || normalizedValue.includes(text)) {
            const input = radioEl.querySelector('input[type="radio"]') as HTMLElement || radioEl;
            input.click();
            await sleep(300);
            clicked = true;

            // 特殊处理："境内" 选择后会弹出省市区级联选择器
            if (normalizedValue.includes('境内') || text.includes('境内')) {
                await handleOriginCascader(container);
            }

            return true;
        }
    }

    // 兜底：点击第一个
    if (radios.length > 0 && !clicked) {
        const first = radios[0] as HTMLElement;
        const input = first.querySelector('input[type="radio"]') as HTMLElement || first;
        input.click();
        await sleep(200);
        return true;
    }

    return false;
}

/**
 * 处理产地"境内"后的省市区级联选择器
 */
async function handleOriginCascader(container: HTMLElement): Promise<void> {
    console.log('[V2] 检测到产地选择境内，处理省市区选择器...');

    await sleep(800); // 等待级联选择器弹出

    // 检查级联菜单是否已经打开（选择"境内"后可能自动弹出）
    let cascaderMenus = document.querySelectorAll('.doraemon-cascader-menu');
    console.log(`[V2] 当前级联菜单数量: ${cascaderMenus.length}`);

    // 如果菜单没有打开，尝试点击触发器
    if (cascaderMenus.length === 0) {
        console.log('[V2] 级联菜单未打开，尝试查找并点击触发器...');

        // 查找触发器：在包含"产地"文字的表单行中查找级联选择器
        let triggerInput: HTMLElement | null = null;

        // 方法1：遍历所有表单行，找到包含"产地"的行，然后找其中的级联选择器
        const allRows = document.querySelectorAll('.doraemon-row, .doraemon-form-item, .el-form-item');
        for (const row of allRows) {
            const rowText = (row as HTMLElement).innerText || '';
            // 这一行包含"产地"且有级联选择器
            if (rowText.includes('产地') && row.querySelector('.doraemon-cascader-picker')) {
                triggerInput = row.querySelector('.doraemon-cascader-picker input') as HTMLElement;
                if (triggerInput) {
                    console.log(`[V2] 在产地行中找到级联选择器 input`);
                    break;
                }
            }
        }

        // 方法2：直接查找 id 以 address 开头的 input
        if (!triggerInput) {
            const addressInput = document.querySelector('input[id^="address"].doraemon-cascader-input') as HTMLElement;
            if (addressInput) {
                triggerInput = addressInput;
                console.log(`[V2] 通过 id 找到级联选择器 input: ${addressInput.id}`);
            }
        }

        // 方法3：查找 placeholder 为"请选择"的级联 input
        if (!triggerInput) {
            const allCascaderInputs = document.querySelectorAll('.doraemon-cascader-input[placeholder="请选择"]');
            if (allCascaderInputs.length > 0) {
                triggerInput = allCascaderInputs[0] as HTMLElement;
                console.log(`[V2] 通过 placeholder 找到级联选择器 input`);
            }
        }

        if (triggerInput) {
            console.log(`[V2] 找到级联选择器触发器: ${triggerInput.tagName}.${triggerInput.className}`);
            triggerInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(300);

            // 尝试多种点击方式
            // 方式1: 先聚焦再点击
            if (triggerInput instanceof HTMLInputElement) {
                triggerInput.focus();
            }
            triggerInput.click();
            await sleep(300);

            // 检查菜单是否弹出
            cascaderMenus = document.querySelectorAll('.doraemon-cascader-menu');

            // 方式2: 如果菜单没弹出，尝试点击 picker 容器
            if (cascaderMenus.length === 0) {
                console.log('[V2] 尝试点击 picker 容器...');
                const picker = triggerInput.closest('.doraemon-cascader-picker') as HTMLElement;
                if (picker) {
                    picker.click();
                    await sleep(300);
                    cascaderMenus = document.querySelectorAll('.doraemon-cascader-menu');
                }
            }

            // 方式3: 如果还没弹出，尝试 mousedown + mouseup 事件
            if (cascaderMenus.length === 0) {
                console.log('[V2] 尝试 mousedown/mouseup 事件...');
                triggerInput.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                await sleep(50);
                triggerInput.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                await sleep(300);
                cascaderMenus = document.querySelectorAll('.doraemon-cascader-menu');
            }

            // 等待级联菜单弹出
            for (let wait = 0; wait < 15; wait++) {
                await sleep(100);
                cascaderMenus = document.querySelectorAll('.doraemon-cascader-menu');
                if (cascaderMenus.length > 0) {
                    console.log(`[V2] 级联菜单已弹出，共 ${cascaderMenus.length} 列`);
                    break;
                }
            }

            if (cascaderMenus.length === 0) {
                console.warn('[V2] 点击触发器后级联菜单仍未弹出');
                // 打印页面上所有可能的级联相关元素
                const allCascaderElements = document.querySelectorAll('[class*="cascader"]');
                console.log(`[V2] 页面上 cascader 相关元素: ${allCascaderElements.length}`);
                for (const el of Array.from(allCascaderElements).slice(0, 5)) {
                    console.log(`  - ${el.className}`);
                }
            }
        } else {
            console.warn('[V2] 未找到产地级联选择器触发器');
            return;  // 如果找不到触发器，直接返回
        }
    }

    // 2. 定义完整的省市区路径（从北京、上海、广东、浙江随机选择）
    const originPaths = [
        { province: '北京', city: '北京市', district: '海淀区' },
        { province: '北京', city: '北京市', district: '朝阳区' },
        { province: '上海', city: '上海市', district: '黄浦区' },
        { province: '上海', city: '上海市', district: '浦东新区' },
        { province: '广东省', city: '深圳市', district: '南山区' },
        { province: '广东省', city: '广州市', district: '天河区' },
        { province: '浙江省', city: '杭州市', district: '滨江区' },
        { province: '浙江省', city: '宁波市', district: '镇海区' },
    ];
    const randomIndex = Math.floor(Math.random() * originPaths.length);
    const selectedPath = originPaths[randomIndex];
    console.log(`[V2] 随机选择产地: ${selectedPath.province}/${selectedPath.city}/${selectedPath.district}`);

    const clickCascaderMenuItem = async (targetText: string): Promise<boolean> => {
        // 生成多个可能的匹配文本（去掉省/市/区后缀）
        const textVariants = [
            targetText,
            targetText.replace(/省$/, ''),
            targetText.replace(/市$/, ''),
            targetText.replace(/区$/, ''),
            targetText.replace(/(省|市|区)$/, '')
        ];
        // 去重
        const uniqueVariants = [...new Set(textVariants)];

        console.log(`[V2] 查找级联菜单项: ${targetText}, 变体: ${uniqueVariants.join(', ')}`);

        // 尝试多次查找，因为菜单加载有动画延迟
        for (let retry = 0; retry < 15; retry++) {
            // 方法1: 使用 XPath 查找（最可靠）
            for (const variant of uniqueVariants) {
                const xpath = `//li[contains(@class,'doraemon-cascader-menu-item') and contains(., '${variant}')]`;
                const el = document.evaluate(xpath, document.body, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement;

                if (el && el.offsetParent !== null) { // 确保可见
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await sleep(80);
                    el.click();
                    console.log(`[V2] 点击级联菜单(XPath): ${variant}`);
                    await sleep(200);
                    return true;
                }
            }

            // 方法2: 用 querySelectorAll 遍历查找
            const allItems = document.querySelectorAll('.doraemon-cascader-menu-item, .el-cascader-node');
            for (const item of allItems) {
                const itemText = (item as HTMLElement).innerText?.trim() || '';
                for (const variant of uniqueVariants) {
                    if (itemText === variant || itemText.includes(variant) || variant.includes(itemText)) {
                        if ((item as HTMLElement).offsetParent !== null) {
                            (item as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
                            await sleep(80);
                            (item as HTMLElement).click();
                            console.log(`[V2] 点击级联菜单(遍历): ${itemText}`);
                            await sleep(200);
                            return true;
                        }
                    }
                }
            }

            await sleep(100);
        }

        console.warn(`[V2] 未找到级联菜单项: ${targetText}`);
        return false;
    };

    // 选择省
    let provinceSelected = await clickCascaderMenuItem(selectedPath.province);
    if (!provinceSelected) {
        provinceSelected = await clickCascaderMenuItem('北京');  // 兜底
    }

    if (!provinceSelected) {
        console.warn('[V2] 未能选择省份');
        document.body.click();
        return;
    }

    // 选择市
    await sleep(400);
    let citySelected = await clickCascaderMenuItem(selectedPath.city);
    if (!citySelected) {
        // 兜底：选择第一个城市
        const cityPanels = document.querySelectorAll('.doraemon-cascader-menu');
        if (cityPanels.length >= 2) {
            const cityItems = cityPanels[1].querySelectorAll('.doraemon-cascader-menu-item');
            if (cityItems.length > 0) {
                const firstCity = cityItems[0] as HTMLElement;
                console.log(`[V2] 选择城市(兜底): ${firstCity.innerText?.trim()}`);
                firstCity.click();
                citySelected = true;
                await sleep(300);
            }
        }
    }

    // 选择区
    await sleep(300);
    let districtSelected = await clickCascaderMenuItem(selectedPath.district);
    if (!districtSelected) {
        // 兜底：选择第一个区县
        const districtPanels = document.querySelectorAll('.doraemon-cascader-menu');
        if (districtPanels.length >= 3) {
            const districtItems = districtPanels[2].querySelectorAll('.doraemon-cascader-menu-item');
            if (districtItems.length > 0) {
                const firstDistrict = districtItems[0] as HTMLElement;
                console.log(`[V2] 选择区县(兜底): ${firstDistrict.innerText?.trim()}`);
                firstDistrict.click();
                await sleep(300);
            }
        }
    }

    // 点击空白处关闭级联选择器
    document.body.click();
    await sleep(200);

    console.log('[V2] 产地级联选择完成');
}

/**
 * 填写 Select/Dropdown（增强版，确保100%成功）
 */
async function fillSelect(container: HTMLElement, value: string): Promise<boolean> {
    console.log(`[V2] fillSelect 开始，目标值: "${value}"`);

    // 关闭所有已打开的下拉框
    await closeAllDropdowns();

    // 找触发器（多种选择器）
    const triggerSelectors = [
        '.doraemon-select',
        '.doraemon-select-selection',
        '.el-select',
        '.ant-select',
        '[role="combobox"]',
        '.doraemon-select-selection__rendered',
        'div[class*="select"]'
    ];

    let trigger: HTMLElement | null = null;
    for (const sel of triggerSelectors) {
        trigger = container.querySelector(sel) as HTMLElement;
        if (trigger) {
            console.log(`[V2] 找到触发器: ${sel}`);
            break;
        }
    }

    if (!trigger) {
        // 可能是 combobox，尝试找 input
        const input = container.querySelector('input') as HTMLInputElement;
        if (input && !input.disabled && !input.readOnly) {
            console.log(`[V2] 未找到下拉触发器，尝试作为输入框处理`);
            return await fillInput(container, value);
        }
        console.warn(`[V2] fillSelect 失败：未找到触发器`);
        return false;
    }

    // 尝试多种方式打开下拉框
    let dropdownOpened = false;
    for (let attempt = 0; attempt < 3 && !dropdownOpened; attempt++) {
        console.log(`[V2] 尝试打开下拉框，第 ${attempt + 1} 次`);

        if (attempt === 0) {
            trigger.click();
        } else if (attempt === 1) {
            // 尝试点击内部 input
            const innerInput = container.querySelector('input') as HTMLElement;
            if (innerInput) {
                innerInput.focus();
                innerInput.click();
            } else {
                trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                trigger.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            }
        } else {
            // 尝试模拟键盘事件
            trigger.focus();
            trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        }

        await sleep(500);

        // 检查下拉框是否打开
        const visibleDropdowns = document.querySelectorAll(
            '.doraemon-select-dropdown:not(.doraemon-select-dropdown-hidden), ' +
            '.el-select-dropdown, .ant-select-dropdown, [role="listbox"]'
        );
        if (visibleDropdowns.length > 0) {
            dropdownOpened = true;
            console.log(`[V2] 下拉框已打开`);
        }
    }

    // 搜索型下拉框：输入搜索文字
    const searchInput = container.querySelector('.doraemon-select-search__field, input.doraemon-input, input[type="text"]') as HTMLInputElement;
    if (searchInput && !searchInput.disabled && searchInput.offsetParent !== null) {
        console.log(`[V2] 检测到搜索型下拉框，输入: ${value}`);
        searchInput.focus();
        searchInput.value = value;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(600);
    }

    // 查找选项（多种方式）
    let options = getVisibleOptions();

    // 备选方案1：查找所有可见 li
    if (options.length === 0) {
        console.log('[V2] 方案1：查找所有可见 li...');
        const liElements = document.querySelectorAll('li');
        for (const li of liElements) {
            const el = li as HTMLElement;
            const text = el.innerText?.trim();
            if (text && el.offsetParent !== null && !el.classList.contains('is-disabled')) {
                if (!el.closest('.doraemon-cascader-menu')) {
                    options.push({ text, element: el });
                }
            }
        }
    }

    // 备选方案2：查找 dropdown 内的任何可点击元素
    if (options.length === 0) {
        console.log('[V2] 方案2：查找 dropdown 内元素...');
        const dropdownItems = document.querySelectorAll(
            '[class*="dropdown"] > *, [class*="select-menu"] li, [class*="option"]'
        );
        for (const item of dropdownItems) {
            const el = item as HTMLElement;
            const text = el.innerText?.trim();
            if (text && el.offsetParent !== null) {
                options.push({ text, element: el });
            }
        }
    }

    console.log(`[V2] 共找到 ${options.length} 个选项:`, options.map(o => o.text).slice(0, 5).join(', '));

    if (options.length === 0) {
        console.warn(`[V2] fillSelect 失败：未找到下拉选项`);
        document.body.click();
        return false;
    }

    // 智能匹配选项
    const normalizedValue = value.trim().toLowerCase();
    let targetOption = options.find(o => o.text.toLowerCase() === normalizedValue);

    if (!targetOption) {
        targetOption = options.find(o =>
            o.text.toLowerCase().includes(normalizedValue) ||
            normalizedValue.includes(o.text.toLowerCase())
        );
    }

    // 特殊匹配：否/不需要/无需
    if (!targetOption && (normalizedValue === '否' || normalizedValue === '不需要' || normalizedValue === '无需' || normalizedValue.includes('不'))) {
        targetOption = options.find(o =>
            o.text === '不需要' ||
            o.text === '否' ||
            o.text.includes('不需要') ||
            o.text.includes('无需') ||
            o.text.startsWith('不')
        );
    }

    // 特殊匹配：是/需要
    if (!targetOption && (normalizedValue === '是' || normalizedValue === '需要')) {
        targetOption = options.find(o =>
            o.text === '需要' ||
            o.text === '是' ||
            (o.text.includes('需要') && !o.text.includes('不'))
        );
    }

    // 默认选项
    if (!targetOption && options.length > 0) {
        // 对于"是否需要安装"这类字段，第二个选项通常是"不需要"
        if (normalizedValue.includes('不') || normalizedValue.includes('否')) {
            targetOption = options.length > 1 ? options[1] : options[0];
        } else {
            targetOption = options[0];
        }
        console.log(`[V2] 使用默认选项: ${targetOption.text}`);
    }

    if (targetOption) {
        console.log(`[V2] 点击下拉选项: "${targetOption.text}"`);
        targetOption.element.scrollIntoView({ block: 'center' });
        await sleep(50);

        // 多种方式点击
        targetOption.element.click();
        await sleep(100);

        // 如果还没关闭，再尝试
        if (targetOption.element.offsetParent !== null) {
            targetOption.element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            targetOption.element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        }

        await sleep(300);
        await closeAllDropdowns();
        console.log(`[V2] fillSelect 成功`);
        return true;
    }

    await closeAllDropdowns();
    return false;
}

/**
 * 填写 Input/Textarea
 */
async function fillInput(container: HTMLElement, value: string): Promise<boolean> {
    console.log(`[V2] fillInput 开始，值: "${value.substring(0, 50)}..."`);

    // 查找输入框
    const input = container.querySelector(
        'input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([disabled]), textarea:not([disabled])'
    ) as HTMLInputElement;

    if (!input) {
        console.log(`[V2] fillInput: 未找到主输入框，尝试 combobox`);
        // 可能是 combobox 的 input
        const comboboxInput = container.querySelector('.doraemon-select-search__field, input.doraemon-input') as HTMLInputElement;
        if (comboboxInput && !comboboxInput.disabled) {
            console.log(`[V2] fillInput: 找到 combobox 输入框`);
            return setInputValue(comboboxInput, value);
        }
        console.warn(`[V2] fillInput: 未找到任何输入框`);
        return false;
    }

    console.log(`[V2] fillInput: 找到输入框, type=${input.type}, id=${input.id}`);
    return setInputValue(input, value);
}

/**
 * 设置输入框值（修复 Illegal invocation 问题）
 */
function setInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): boolean {
    try {
        // 先聚焦
        input.focus();

        // 清空现有内容
        input.select();

        // 方法 1：尝试使用原生 setter（某些 React/Vue 组件需要）
        try {
            const descriptor = Object.getOwnPropertyDescriptor(
                input instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype,
                'value'
            );
            if (descriptor && descriptor.set) {
                descriptor.set.call(input, value);
            } else {
                input.value = value;
            }
        } catch {
            // 备用：直接赋值
            input.value = value;
        }

        // 触发事件确保框架能监听到
        input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

        // 失焦触发验证
        input.blur();

        console.log(`[V2] 输入框填写成功: "${value.substring(0, 30)}..."`);
        return true;
    } catch (error) {
        console.error(`[V2] setInputValue 失败:`, error);

        // 最后的备用方案：直接操作
        try {
            input.value = value;
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * 填写 Checkbox
 */
async function fillCheckbox(container: HTMLElement, value: string): Promise<boolean> {
    const checkboxes = container.querySelectorAll('.doraemon-checkbox, .el-checkbox, input[type="checkbox"]');

    const valuesToCheck = value.split(',').map(v => v.trim().toLowerCase());
    let checked = false;

    for (const checkbox of checkboxes) {
        const checkboxEl = checkbox as HTMLElement;
        const text = checkboxEl.innerText?.trim().toLowerCase() || '';

        if (valuesToCheck.some(v => text === v || text.includes(v))) {
            const input = checkboxEl.querySelector('input[type="checkbox"]') as HTMLElement || checkboxEl;
            input.click();
            checked = true;
            await sleep(100);
        }
    }

    return checked;
}

// ==================== 工具函数 ====================

async function waitForFormStable(timeout = 3000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const items = document.querySelectorAll('.doraemon-form-item, .el-form-item, .ant-form-item');
        if (items.length > 5) {
            await sleep(500);
            return true;
        }
        await sleep(200);
    }
    return false;
}

async function closeAllDropdowns(): Promise<void> {
    // 按 Escape 关闭弹出层
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(100);

    // 点击空白区域关闭
    const backdrop = document.querySelector('.doraemon-modal-mask, .el-popup-parent--hidden');
    if (backdrop) {
        (backdrop as HTMLElement).click();
    } else {
        document.body.click();
    }
    await sleep(100);
}

function getVisibleOptions(): Array<{ text: string, element: HTMLElement }> {
    const options: Array<{ text: string, element: HTMLElement }> = [];

    // 先检查有没有下拉框弹出
    const dropdowns = document.querySelectorAll(
        '.doraemon-select-dropdown:not([style*="display: none"]), ' +
        '.el-select-dropdown, .ant-select-dropdown, ' +
        '[class*="dropdown"]:not([style*="display: none"])'
    );
    console.log(`[V2] getVisibleOptions: 找到 ${dropdowns.length} 个下拉容器`);

    const selectors = [
        // Doraemon UI
        '.doraemon-select-dropdown-menu-item',
        '.doraemon-select-dropdown-menu li',
        '.doraemon-select-dropdown li',
        '.doraemon-select-item',
        // Element UI
        '.el-select-dropdown__item',
        '.el-select-dropdown__list li',
        // Ant Design
        '.ant-select-item-option',
        '.ant-select-item',
        // 通用
        '[role="option"]',
        '[role="listbox"] > *',
        '.dropdown-item',
        '.select-option',
        'li.option',
        '.doraemon-dropdown li',
        '.dropdown-menu li',
        // 更通用的选择器
        '[class*="select-dropdown"] li',
        '[class*="dropdown-menu"] li',
        '[class*="option"]:not(input)'
    ];

    for (const sel of selectors) {
        const items = document.querySelectorAll(sel);
        items.forEach(item => {
            const el = item as HTMLElement;
            const text = el.innerText?.trim();
            // 确保可见且有文字，排除已选中的
            if (text && text.length < 50 && !el.classList.contains('is-disabled') && el.offsetParent !== null) {
                // 避免重复
                if (!options.some(o => o.text === text)) {
                    options.push({ text, element: el });
                }
            }
        });
        if (options.length > 0) break;
    }

    console.log(`[V2] getVisibleOptions 找到 ${options.length} 个选项:`, options.map(o => o.text).slice(0, 10).join(', '));
    return options;
}

export const ValidationLoop = { runAutoFillV2 };
