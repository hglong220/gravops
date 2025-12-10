/**
 * 政采云表单自动填写引擎
 * 
 * 功能：
 * 1. 自动扫描页面必填字段（红星标记）
 * 2. 根据采集数据自动填写
 * 3. 使用类目默认值补充
 * 4. 调用 AI 智能填写剩余字段
 */

// ========== 日志 ==========
function log(...args: any[]) {
    console.log('[FormFiller]', ...args);
}

async function wait(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

// ========== 字段类型定义 ==========

interface FormField {
    label: string;           // 字段名称
    element: HTMLElement;    // 表单元素
    type: 'input' | 'select' | 'radio' | 'textarea' | 'checkbox' | 'unknown';
    required: boolean;       // 是否必填
    currentValue: string;    // 当前值
    options?: string[];      // 下拉/单选选项
}

interface FillResult {
    success: boolean;
    filled: string[];        // 成功填写的字段
    failed: string[];        // 填写失败的字段
    skipped: string[];       // 跳过的字段（已有值）
}

// ========== 字段扫描器 ==========

/**
 * 扫描页面上所有表单字段
 */
function scanFormFields(): FormField[] {
    const fields: FormField[] = [];

    // 查找所有表单行（支持多种UI框架）
    const formRows = document.querySelectorAll(
        '.el-form-item, .ant-form-item, .form-group, .form-item, ' +
        'tr:has(input), tr:has(select), tr:has(textarea), ' +
        '[class*="form-row"], [class*="field-row"]'
    );

    log(`扫描到 ${formRows.length} 个表单行`);

    for (const row of formRows) {
        const field = parseFormRow(row as HTMLElement);
        if (field && field.label) {
            fields.push(field);
        }
    }

    log(`解析出 ${fields.length} 个有效字段`);
    return fields;
}

/**
 * 解析单个表单行
 */
function parseFormRow(row: HTMLElement): FormField | null {
    // 1. 获取标签名称
    const labelEl = row.querySelector(
        'label, .el-form-item__label, .ant-form-item-label, ' +
        '[class*="label"], th, .field-label'
    ) as HTMLElement;

    if (!labelEl) return null;

    let label = labelEl.innerText?.trim() || '';
    // 清洗标签（移除冒号和星号）
    label = label.replace(/[：:*\s]/g, '');

    if (!label) return null;

    // 2. 判断是否必填（红星标记）
    const required = !!(
        row.querySelector('.is-required, .required, .ant-form-item-required') ||
        labelEl.querySelector('.required, [class*="required"]') ||
        row.innerHTML.includes('*') && row.innerHTML.includes('必填') ||
        labelEl.innerHTML.includes('*')
    );

    // 3. 查找输入元素
    const input = row.querySelector('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"])') as HTMLInputElement;
    const textarea = row.querySelector('textarea') as HTMLTextAreaElement;
    const select = row.querySelector('select, .el-select, .ant-select') as HTMLElement;
    const radios = row.querySelectorAll('input[type="radio"], .el-radio, .ant-radio');
    const checkbox = row.querySelector('input[type="checkbox"], .el-checkbox') as HTMLElement;

    let element: HTMLElement | null = null;
    let type: FormField['type'] = 'unknown';
    let currentValue = '';
    let options: string[] = [];

    if (input) {
        element = input;
        type = 'input';
        currentValue = input.value || '';
    } else if (textarea) {
        element = textarea;
        type = 'textarea';
        currentValue = textarea.value || '';
    } else if (select) {
        element = select;
        type = 'select';
        // 获取当前选中值
        const selectInput = select.querySelector('.el-input__inner, .ant-select-selection-item, select') as HTMLElement;
        currentValue = selectInput?.innerText?.trim() || (selectInput as HTMLInputElement)?.value || '';
        // 获取选项（如果下拉已展开）
        const optionEls = document.querySelectorAll('.el-select-dropdown__item, .ant-select-item');
        optionEls.forEach(opt => {
            const text = (opt as HTMLElement).innerText?.trim();
            if (text) options.push(text);
        });
    } else if (radios.length > 0) {
        element = radios[0] as HTMLElement;
        type = 'radio';
        // 获取选中的radio
        radios.forEach(radio => {
            const radioInput = radio.querySelector('input') as HTMLInputElement;
            if (radioInput?.checked || (radio as HTMLElement).classList.contains('is-checked')) {
                currentValue = (radio as HTMLElement).innerText?.trim() || '';
            }
            options.push((radio as HTMLElement).innerText?.trim() || '');
        });
    } else if (checkbox) {
        element = checkbox;
        type = 'checkbox';
    }

    if (!element) return null;

    return {
        label,
        element,
        type,
        required,
        currentValue,
        options: options.length > 0 ? options : undefined
    };
}

// ========== 字段值映射 ==========

interface FieldMapping {
    keywords: string[];      // 匹配关键词
    getValue: (data: CollectedData) => string | undefined;
}

interface CollectedData {
    title?: string;
    brand?: string;
    model?: string;
    price?: number;
    specs?: { [key: string]: string };
    categoryName?: string;
}

/**
 * 字段映射规则
 * 根据字段名自动匹配采集数据中的值
 */
const FIELD_MAPPINGS: FieldMapping[] = [
    {
        keywords: ['品牌', '商品品牌'],
        getValue: (data) => data.brand
    },
    {
        keywords: ['型号', '产品型号', '商品型号', '规格型号'],
        getValue: (data) => data.model
    },
    {
        keywords: ['产地', '生产产地', '原产地'],
        getValue: () => '境内'  // 默认境内
    },
    {
        keywords: ['计量单位', '单位', '销售单位'],
        getValue: (data) => {
            // 根据类目推断单位
            const cat = data.categoryName || '';
            if (cat.includes('纸') || cat.includes('复印')) return '包';
            if (cat.includes('笔')) return '支';
            if (cat.includes('本') || cat.includes('册')) return '本';
            return '台';  // 默认台
        }
    },
    {
        keywords: ['供价', '售价', '销售价', '单价'],
        getValue: (data) => {
            if (!data.price) return undefined;
            // 价格下浮 3-5%
            const rate = 0.03 + Math.random() * 0.02;
            const discounted = data.price * (1 - rate);
            return (Math.floor(discounted * 100) / 100).toString();
        }
    },
    {
        keywords: ['市场价', '参考价', '原价'],
        getValue: (data) => data.price?.toString()
    },
    {
        keywords: ['库存', '库存数量', '可售数量'],
        getValue: () => '999'  // 默认库存
    },
    {
        keywords: ['生产厂商', '生产商', '厂商', '制造商'],
        getValue: (data) => data.brand || ''
    },
    {
        keywords: ['保质期', '质保期', '售后服务'],
        getValue: () => '1年'
    },
];

/**
 * 类目特定的默认值
 */
const CATEGORY_DEFAULTS: { [category: string]: { [field: string]: string } } = {
    '点钞机': {
        '清点速度': '全入',
        '产品类型': '点钞机',
        '工作电压': 'AC220V',
        '功率': '80W',
    },
    '碎纸机': {
        '碎纸能力': '5-10张',
        '碎纸方式': '粒状',
    },
    '打印机': {
        '打印方式': '激光',
        '接口类型': 'USB',
    },
    '复印纸': {
        '纸张规格': 'A4',
        '纸张克重': '70g',
    },
};

/**
 * 根据字段名获取填充值
 */
function getFieldValue(fieldLabel: string, data: CollectedData): string | undefined {
    // 1. 先从采集的specs中精确匹配
    if (data.specs?.[fieldLabel]) {
        return data.specs[fieldLabel];
    }

    // 2. 从字段映射规则中匹配
    for (const mapping of FIELD_MAPPINGS) {
        for (const keyword of mapping.keywords) {
            if (fieldLabel.includes(keyword) || keyword.includes(fieldLabel)) {
                const value = mapping.getValue(data);
                if (value) return value;
            }
        }
    }

    // 3. 从类目默认值中匹配
    const categoryName = data.categoryName || '';
    for (const [cat, defaults] of Object.entries(CATEGORY_DEFAULTS)) {
        if (categoryName.includes(cat)) {
            if (defaults[fieldLabel]) {
                return defaults[fieldLabel];
            }
        }
    }

    // 4. 模糊匹配specs
    if (data.specs) {
        for (const [key, value] of Object.entries(data.specs)) {
            if (key.includes(fieldLabel) || fieldLabel.includes(key)) {
                return value;
            }
        }
    }

    return undefined;
}

// ========== 字段填写器 ==========

/**
 * 填写输入框
 */
async function fillInputField(field: FormField, value: string): Promise<boolean> {
    const input = field.element.querySelector('input, .el-input__inner') as HTMLInputElement ||
        field.element as HTMLInputElement;

    if (!input) return false;

    try {
        input.focus();
        input.value = '';
        await wait(50);

        // 尝试用 execCommand
        document.execCommand('insertText', false, value);

        // 如果 execCommand 失败，直接赋值
        if (input.value !== value) {
            input.value = value;
        }

        // 触发事件
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));

        await wait(100);
        return true;
    } catch (e) {
        log(`填写输入框失败: ${field.label}`, e);
        return false;
    }
}

/**
 * 填写下拉框
 */
async function fillSelectField(field: FormField, value: string): Promise<boolean> {
    const select = field.element;

    try {
        // 点击打开下拉框
        const trigger = select.querySelector('.el-input, .ant-select-selector, input') as HTMLElement || select;
        trigger.click();
        await wait(500);

        // 查找匹配的选项
        const options = document.querySelectorAll(
            '.el-select-dropdown__item, .ant-select-item, ' +
            '.el-scrollbar__view li, [class*="option"]'
        );

        for (const opt of options) {
            const text = (opt as HTMLElement).innerText?.trim();
            if (text === value || text?.includes(value) || value.includes(text || '')) {
                (opt as HTMLElement).click();
                log(`✓ 选择下拉: ${field.label} = ${text}`);
                await wait(200);
                return true;
            }
        }

        // 如果没找到精确匹配，选择第一个包含关键词的
        for (const opt of options) {
            const text = (opt as HTMLElement).innerText?.trim() || '';
            // 境内/境外选择
            if (value === '境内' && (text.includes('境内') || text.includes('国产') || text.includes('国内'))) {
                (opt as HTMLElement).click();
                await wait(200);
                return true;
            }
        }

        // 点击其他地方关闭下拉框
        document.body.click();
        await wait(100);

        return false;
    } catch (e) {
        log(`填写下拉框失败: ${field.label}`, e);
        return false;
    }
}

/**
 * 选择单选按钮
 */
async function fillRadioField(field: FormField, value: string): Promise<boolean> {
    const row = field.element.closest('.el-form-item, .form-item, tr, [class*="row"]');
    if (!row) return false;

    const radios = row.querySelectorAll('.el-radio, .ant-radio-wrapper, input[type="radio"]');

    for (const radio of radios) {
        const text = (radio as HTMLElement).innerText?.trim() || '';
        const label = radio.closest('label')?.innerText?.trim() || '';

        if (text === value || text.includes(value) || label.includes(value) ||
            value.includes(text) || value.includes(label)) {
            (radio as HTMLElement).click();
            log(`✓ 选择单选: ${field.label} = ${text || label}`);
            await wait(200);
            return true;
        }
    }

    // 如果是产地字段，尝试选择"境内"相关选项
    if (field.label.includes('产地')) {
        for (const radio of radios) {
            const text = (radio as HTMLElement).innerText?.trim() || '';
            if (text.includes('境内') || text.includes('国产') || text.includes('国内')) {
                (radio as HTMLElement).click();
                await wait(200);
                return true;
            }
        }
    }

    return false;
}

/**
 * 填写文本域
 */
async function fillTextareaField(field: FormField, value: string): Promise<boolean> {
    const textarea = field.element.querySelector('textarea') as HTMLTextAreaElement ||
        field.element as HTMLTextAreaElement;

    if (!textarea) return false;

    try {
        textarea.focus();
        textarea.value = value;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        await wait(100);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * 填写单个字段
 */
async function fillField(field: FormField, value: string): Promise<boolean> {
    log(`填写字段: ${field.label} (${field.type}) = ${value}`);

    switch (field.type) {
        case 'input':
            return await fillInputField(field, value);
        case 'select':
            return await fillSelectField(field, value);
        case 'radio':
            return await fillRadioField(field, value);
        case 'textarea':
            return await fillTextareaField(field, value);
        default:
            return false;
    }
}

// ========== 主入口 ==========

/**
 * 自动填写表单
 * @param data 采集数据
 * @returns 填写结果
 */
export async function autoFillForm(data: CollectedData): Promise<FillResult> {
    const result: FillResult = {
        success: true,
        filled: [],
        failed: [],
        skipped: []
    };

    log('═══════════════════════════════════════');
    log('🚀 开始自动填写表单');
    log('采集数据:', JSON.stringify(data, null, 2));
    log('═══════════════════════════════════════');

    // 1. 扫描所有字段
    const fields = scanFormFields();

    log(`\n📋 发现 ${fields.length} 个表单字段:`);
    fields.forEach(f => {
        log(`  ${f.required ? '* ' : '  '}${f.label} (${f.type})${f.currentValue ? ' = ' + f.currentValue : ''}`);
    });

    // 2. 筛选需要填写的字段（必填 + 空值）
    const fieldsToFill = fields.filter(f => {
        // 跳过已有值的字段
        if (f.currentValue && f.currentValue !== '请选择' && f.currentValue !== '请输入') {
            result.skipped.push(f.label);
            return false;
        }
        return true;  // 填所有空字段，不仅仅是必填
    });

    log(`\n📝 需要填写 ${fieldsToFill.length} 个字段`);

    // 3. 逐个填写
    for (const field of fieldsToFill) {
        const value = getFieldValue(field.label, data);

        if (!value) {
            log(`⚠️ 无法获取值: ${field.label}`);
            if (field.required) {
                result.failed.push(field.label);
            }
            continue;
        }

        const success = await fillField(field, value);

        if (success) {
            result.filled.push(field.label);
        } else {
            if (field.required) {
                result.failed.push(field.label);
            }
        }

        await wait(200);  // 字段间间隔
    }

    // 4. 汇总结果
    result.success = result.failed.length === 0;

    log('\n═══════════════════════════════════════');
    log(`✅ 填写完成: ${result.filled.length} 成功, ${result.failed.length} 失败, ${result.skipped.length} 跳过`);
    log('成功:', result.filled.join(', '));
    if (result.failed.length > 0) {
        log('失败:', result.failed.join(', '));
    }
    log('═══════════════════════════════════════');

    return result;
}

/**
 * 选择运费模版
 */
export async function selectShippingTemplate(): Promise<boolean> {
    log('选择运费模版...');

    // 查找运费模版相关元素
    const labels = document.querySelectorAll('label, .el-form-item__label, [class*="label"]');

    for (const label of labels) {
        const text = (label as HTMLElement).innerText?.trim() || '';
        if (text.includes('运费') && text.includes('模')) {
            const row = label.closest('.el-form-item, .form-item, tr, [class*="row"]');
            if (row) {
                const select = row.querySelector('.el-select, select, .ant-select') as HTMLElement;
                if (select) {
                    select.click();
                    await wait(500);

                    // 查找"卖家包邮"选项
                    const options = document.querySelectorAll('.el-select-dropdown__item, [class*="option"]');
                    for (const opt of options) {
                        const optText = (opt as HTMLElement).innerText?.trim() || '';
                        if (optText.includes('包邮') || optText.includes('卖家')) {
                            (opt as HTMLElement).click();
                            log('✓ 选择运费模版: 卖家包邮');
                            await wait(200);
                            return true;
                        }
                    }
                }
            }
        }
    }

    log('⚠️ 未找到运费模版');
    return false;
}

/**
 * 生成 attributes 数组（从采集数据和默认值）
 */
export function generateAttributes(data: CollectedData): Array<{ label: string; value: string }> {
    const attributes: Array<{ label: string; value: string }> = [];

    // 基本字段
    if (data.brand) {
        attributes.push({ label: '品牌', value: data.brand });
    }
    if (data.model) {
        attributes.push({ label: '型号', value: data.model });
    }

    // 通用默认值
    attributes.push({ label: '产地', value: '境内' });

    // 计量单位（根据类目）
    const categoryName = data.categoryName || '';
    let unit = '台';
    if (categoryName.includes('纸')) unit = '包';
    else if (categoryName.includes('笔')) unit = '支';
    else if (categoryName.includes('本')) unit = '本';
    attributes.push({ label: '计量单位', value: unit });

    // 价格
    if (data.price) {
        const rate = 0.03 + Math.random() * 0.02;
        const discounted = Math.floor(data.price * (1 - rate) * 100) / 100;
        attributes.push({ label: '供价', value: discounted.toString() });
        attributes.push({ label: '售价', value: discounted.toString() });
        attributes.push({ label: '市场价', value: data.price.toString() });
    }

    // 库存
    attributes.push({ label: '库存', value: '999' });

    // 从specs添加
    if (data.specs) {
        for (const [key, value] of Object.entries(data.specs)) {
            if (!attributes.some(a => a.label === key)) {
                attributes.push({ label: key, value });
            }
        }
    }

    // 类目特定默认值
    for (const [cat, defaults] of Object.entries(CATEGORY_DEFAULTS)) {
        if (categoryName.includes(cat)) {
            for (const [key, value] of Object.entries(defaults)) {
                if (!attributes.some(a => a.label === key)) {
                    attributes.push({ label: key, value });
                }
            }
        }
    }

    log(`生成 ${attributes.length} 个属性:`, attributes);
    return attributes;
}

export { scanFormFields, getFieldValue, fillField };
export type { FormField, FillResult, CollectedData };
