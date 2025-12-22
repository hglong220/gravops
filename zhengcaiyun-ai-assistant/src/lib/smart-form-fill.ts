/**
 * 智能表单填写模块
 * 结合方案一（缓存）和方案二（AI 学习）
 */

// 后端 API 地址
const API_BASE = 'http://localhost:3000';

// 商品数据接口
interface ProductData {
    title: string;
    brand: string;
    model: string;
    price: number;
    marketPrice?: number;
    stock?: number;
    category?: string;
    specs?: Record<string, string>;
    images?: string[];
    detailImages?: string[];
}

// 字段映射接口
interface FieldMapping {
    label: string;
    selector: string;
    dataKey: string;
    required: boolean;
    type: string;
    fillMethod?: 'input' | 'select' | 'click' | 'custom';
}

// 从 URL 提取参数
function getUrlParams(): { templateId: string; categoryId: string } {
    const url = new URL(window.location.href);
    return {
        templateId: url.searchParams.get('templateId') || '',
        categoryId: url.searchParams.get('categoryId') || ''
    };
}

// 提取页面表单字段
function extractFormFields(): any[] {
    const results: any[] = [];
    const inputs = document.querySelectorAll('input, select, textarea');

    inputs.forEach((el, index) => {
        const input = el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        let label = '';

        // 查找 label
        if (input.id) {
            const labelEl = document.querySelector(`label[for="${input.id}"]`);
            if (labelEl) label = labelEl.textContent?.trim() || '';
        }

        if (!label) {
            let parent = input.parentElement;
            for (let i = 0; i < 5 && parent; i++) {
                const labelEl = parent.querySelector('label, .label, .ant-form-item-label');
                if (labelEl) {
                    label = labelEl.textContent?.trim() || '';
                    break;
                }
                parent = parent.parentElement;
            }
        }

        if (!label && input.placeholder) label = input.placeholder;
        if (!label && input.name) label = input.name;

        // 判断必填
        let required = input.required;
        if (!required) {
            let parent = input.parentElement;
            for (let i = 0; i < 5 && parent; i++) {
                if (parent.querySelector('.ant-form-item-required') ||
                    parent.textContent?.includes('*')) {
                    required = true;
                    break;
                }
                parent = parent.parentElement;
            }
        }

        // 生成选择器
        let selector = '';
        if (input.id) selector = '#' + input.id;
        else if (input.name) selector = `${input.tagName.toLowerCase()}[name="${input.name}"]`;

        if ((label || input.name) && selector) {
            results.push({
                label: label.replace(/[*：:]/g, '').trim(),
                selector,
                type: input.tagName.toLowerCase(),
                name: input.name || '',
                id: input.id || '',
                required
            });
        }
    });

    return results;
}

// 根据 dataKey 获取商品数据值
function getProductValue(productData: ProductData, dataKey: string): any {
    if (!dataKey) return null;

    // 处理 specs.xxx 格式
    if (dataKey.startsWith('specs.')) {
        const specKey = dataKey.replace('specs.', '');
        return productData.specs?.[specKey] || null;
    }

    return (productData as any)[dataKey];
}

// 填写单个字段
async function fillField(field: FieldMapping, value: any): Promise<boolean> {
    if (!value) return false;

    const el = document.querySelector(field.selector) as HTMLElement;
    if (!el) {
        console.warn(`[智能填表] 找不到元素: ${field.selector}`);
        return false;
    }

    try {
        if (field.type === 'input' || field.type === 'textarea') {
            const input = el as HTMLInputElement | HTMLTextAreaElement;
            input.value = String(value);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (field.type === 'select') {
            const select = el as HTMLSelectElement;
            select.value = String(value);
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }

        console.log(`[智能填表] ✓ ${field.label}: ${value}`);
        return true;
    } catch (error) {
        console.error(`[智能填表] 填写失败: ${field.label}`, error);
        return false;
    }
}

// 方案一：使用缓存快速填表
async function fastFill(productData: ProductData): Promise<{ success: boolean; filled: number; total: number }> {
    const { templateId, categoryId } = getUrlParams();

    if (!templateId && !categoryId) {
        console.log('[方案一] 无法获取模板/类目ID');
        return { success: false, filled: 0, total: 0 };
    }

    try {
        // 查询缓存的映射
        const response = await fetch(
            `${API_BASE}/api/form-mapping?templateId=${templateId}&categoryId=${categoryId}`
        );
        const data = await response.json();

        if (!data.found) {
            console.log('[方案一] 无缓存，需要使用方案二学习');
            return { success: false, filled: 0, total: 0 };
        }

        const mapping = data.mapping.fieldMapping.fields as FieldMapping[];
        console.log(`[方案一] 找到缓存映射，${mapping.length} 个字段`);

        let filled = 0;
        for (const field of mapping) {
            const value = getProductValue(productData, field.dataKey);
            if (await fillField(field, value)) {
                filled++;
            }
        }

        // 报告成功
        await fetch(`${API_BASE}/api/form-mapping`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: data.mapping.id, success: true })
        });

        return { success: true, filled, total: mapping.length };

    } catch (error) {
        console.error('[方案一] 失败:', error);
        return { success: false, filled: 0, total: 0 };
    }
}

// 方案二：AI 学习并填表
async function aiLearnAndFill(productData: ProductData): Promise<{ success: boolean; filled: number; total: number; learned: boolean }> {
    const { templateId, categoryId } = getUrlParams();

    try {
        // 1. 提取表单字段
        console.log('[方案二] 提取表单字段...');
        const fields = extractFormFields();
        console.log(`[方案二] 找到 ${fields.length} 个字段`);

        // 2. 调用 AI 分析
        console.log('[方案二] AI 分析中...');
        const analyzeResponse = await fetch(`${API_BASE}/api/ai-form-analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields, productData })
        });
        const analyzeData = await analyzeResponse.json();

        if (!analyzeData.mapping) {
            console.error('[方案二] AI 分析失败');
            return { success: false, filled: 0, total: 0, learned: false };
        }

        const mapping = analyzeData.mapping as FieldMapping[];
        console.log(`[方案二] AI 分析完成，方法: ${analyzeData.method}`);

        // 3. 填写表单
        let filled = 0;
        for (const field of mapping) {
            const value = getProductValue(productData, field.dataKey);
            if (await fillField(field, value)) {
                filled++;
            }
        }

        // 4. 保存学习结果
        if (templateId && categoryId && filled > 0) {
            console.log('[方案二] 保存学习结果...');
            await fetch(`${API_BASE}/api/form-mapping`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateId,
                    categoryId,
                    categoryPath: productData.category,
                    urlPattern: window.location.pathname,
                    fields: mapping
                })
            });
        }

        return { success: true, filled, total: mapping.length, learned: true };

    } catch (error) {
        console.error('[方案二] 失败:', error);
        return { success: false, filled: 0, total: 0, learned: false };
    }
}

// 主函数：智能填表
export async function smartFill(productData: ProductData): Promise<void> {
    console.log('[智能填表] 开始...');
    console.log('[智能填表] 商品:', productData.title);

    // 先尝试方案一（快速缓存）
    const fastResult = await fastFill(productData);

    if (fastResult.success) {
        console.log(`[智能填表] ✓ 方案一完成！填写了 ${fastResult.filled}/${fastResult.total} 个字段`);
        return;
    }

    // 方案一失败，使用方案二（AI 学习）
    console.log('[智能填表] 切换到方案二（AI 学习）...');
    const aiResult = await aiLearnAndFill(productData);

    if (aiResult.success) {
        console.log(`[智能填表] ✓ 方案二完成！填写了 ${aiResult.filled}/${aiResult.total} 个字段`);
        if (aiResult.learned) {
            console.log('[智能填表] ✓ 已保存学习结果，下次将使用方案一快速填写');
        }
    } else {
        console.error('[智能填表] ✗ 填表失败');
    }
}

// 导出给其他模块使用
export { extractFormFields, fastFill, aiLearnAndFill, getUrlParams };
