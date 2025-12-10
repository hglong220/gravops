/**
 * 政采云发布页面填写工具
 * 
 * 功能：
 * 1. 填写所有必填项
 * 2. 价格随机下浮3-5%
 * 3. 运费模版选择"卖家包邮"
 * 4. 图片上传
 */

import { processAndUploadImages, clearImageCache } from './image-uploader';

// ========== 日志 ==========
function log(...args: any[]) {
    console.log('[PublishFiller]', ...args);
}

async function wait(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

// ========== 价格计算 ==========

/**
 * 价格下浮 3-5% 随机计算
 */
function calculateDiscountPrice(originalPrice: number): number {
    const discountRate = 0.03 + Math.random() * 0.02;  // 0.03 ~ 0.05
    const discountedPrice = originalPrice * (1 - discountRate);
    return Math.floor(discountedPrice * 100) / 100;
}

// ========== 表单填写工具 ==========

/**
 * 通用输入框填写
 */
async function fillInput(labelText: string, value: string): Promise<boolean> {
    const labels = document.querySelectorAll('label, .el-form-item__label, [class*="label"]');

    for (const label of labels) {
        const text = (label as HTMLElement).innerText?.trim().replace(/[：:*]/g, '');
        if (text === labelText || text.includes(labelText)) {
            const row = label.closest('.el-form-item, .form-item, [class*="row"], tr');
            if (row) {
                const input = row.querySelector('input:not([type="radio"]):not([type="checkbox"]), textarea, .el-input__inner') as HTMLInputElement;
                if (input) {
                    input.focus();
                    input.value = '';
                    await wait(50);
                    document.execCommand('insertText', false, value);
                    if (input.value !== value) {
                        input.value = value;
                    }
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    log(`✓ 填写 ${labelText}: ${value}`);
                    return true;
                }
            }
        }
    }

    log(`✗ 未找到输入框: ${labelText}`);
    return false;
}

/**
 * 单选按钮选择
 */
async function selectRadio(labelText: string, optionText: string): Promise<boolean> {
    const labels = document.querySelectorAll('label, .el-form-item__label, [class*="label"]');

    for (const label of labels) {
        const text = (label as HTMLElement).innerText?.trim().replace(/[：:*]/g, '');
        if (text === labelText || text.includes(labelText)) {
            const row = label.closest('.el-form-item, .form-item, [class*="row"], tr');
            if (row) {
                // 找到包含选项文本的 radio
                const radios = row.querySelectorAll('.el-radio, input[type="radio"]');
                for (const radio of radios) {
                    const radioLabel = (radio as HTMLElement).innerText?.trim() ||
                        radio.closest('label')?.innerText?.trim() || '';
                    if (radioLabel.includes(optionText)) {
                        (radio as HTMLElement).click();
                        await wait(200);
                        log(`✓ 选择 ${labelText}: ${optionText}`);
                        return true;
                    }
                }
            }
        }
    }

    log(`✗ 未找到单选项: ${labelText} - ${optionText}`);
    return false;
}

/**
 * 下拉框选择
 */
async function selectDropdown(labelText: string, optionText: string): Promise<boolean> {
    const labels = document.querySelectorAll('label, .el-form-item__label, [class*="label"]');

    for (const label of labels) {
        const text = (label as HTMLElement).innerText?.trim().replace(/[：:*]/g, '');
        if (text === labelText || text.includes(labelText)) {
            const row = label.closest('.el-form-item, .form-item, [class*="row"]');
            if (row) {
                // 点击下拉框打开
                const select = row.querySelector('.el-select, .el-input, [class*="select"]') as HTMLElement;
                if (select) {
                    select.click();
                    await wait(500);

                    // 找到下拉选项
                    const options = document.querySelectorAll('.el-select-dropdown__item, [class*="option"]');
                    for (const opt of options) {
                        if ((opt as HTMLElement).innerText?.trim().includes(optionText)) {
                            (opt as HTMLElement).click();
                            await wait(200);
                            log(`✓ 选择下拉 ${labelText}: ${optionText}`);
                            return true;
                        }
                    }
                }
            }
        }
    }

    log(`✗ 未找到下拉项: ${labelText} - ${optionText}`);
    return false;
}

/**
 * 选择运费模版（卖家包邮）
 */
async function selectShippingTemplate(): Promise<boolean> {
    log('选择运费模版...');

    // 尝试多种方式
    // 1. 下拉框方式
    const success = await selectDropdown('运费模版', '卖家包邮') ||
        await selectDropdown('运费模板', '卖家包邮') ||
        await selectDropdown('运费', '包邮');

    if (success) return true;

    // 2. 直接查找包含"卖家包邮"的选项
    const allOptions = document.querySelectorAll('.el-select-dropdown__item, [class*="option"], [class*="template"]');
    for (const opt of allOptions) {
        const text = (opt as HTMLElement).innerText?.trim();
        if (text?.includes('卖家包邮') || text?.includes('包邮')) {
            (opt as HTMLElement).click();
            await wait(200);
            log('✓ 选择运费模版: 卖家包邮');
            return true;
        }
    }

    log('⚠️ 未能选择运费模版');
    return false;
}

// ========== 类目默认值 ==========

interface CategoryDefaults {
    unit: string;           // 计量单位
    origin: string;         // 产地
    [key: string]: string;  // 其他默认值
}

const CATEGORY_DEFAULTS: { [category: string]: CategoryDefaults } = {
    '点钞机': {
        unit: '台',
        origin: '境内',
        '清点速度': '全入',
        '产品类型': '点钞机',
    },
    '打印机': {
        unit: '台',
        origin: '境内',
    },
    '碎纸机': {
        unit: '台',
        origin: '境内',
    },
    '复印纸': {
        unit: '包',
        origin: '境内',
    },
    '打印纸': {
        unit: '包',
        origin: '境内',
    },
    // 默认值
    'default': {
        unit: '个',
        origin: '境内',
    }
};

function getCategoryDefaults(categoryName: string): CategoryDefaults {
    // 查找匹配的类目
    for (const [key, defaults] of Object.entries(CATEGORY_DEFAULTS)) {
        if (categoryName.includes(key) || key.includes(categoryName)) {
            return defaults;
        }
    }
    return CATEGORY_DEFAULTS['default'];
}

// ========== 发布页面填写接口 ==========

export interface PublishFormData {
    // 基本信息
    title: string;
    brand: string;
    model: string;
    categoryName: string;   // 类目名称（用于获取默认值）

    // 价格（原始采集价格，会自动下浮3-5%）
    price: number;

    // 库存
    stock?: number;

    // 图片
    mainImages: string[];       // 主图URL列表
    detailImages?: string[];    // 详情图URL列表

    // 采集的规格参数（用于匹配必填项）
    specs?: { [key: string]: string };
}

export interface PublishResult {
    success: boolean;
    errors: string[];
    priceUsed: number;
}

/**
 * 填写发布页面所有表单
 */
export async function fillPublishForm(data: PublishFormData): Promise<PublishResult> {
    const errors: string[] = [];

    log('═══════════════════════════════════════');
    log('🚀 开始填写发布页面');
    log('═══════════════════════════════════════');

    try {
        // 获取类目默认值
        const defaults = getCategoryDefaults(data.categoryName);
        log(`类目: ${data.categoryName}, 默认单位: ${defaults.unit}`);

        // ========== 1. 基本信息 ==========
        log('\n📝 填写基本信息');

        // 品牌（可能已在属性页选择过）
        if (data.brand) {
            await fillInput('品牌', data.brand);
        }

        // 型号
        if (data.model) {
            await fillInput('型号', data.model);
        }

        // ========== 2. 通用属性 ==========
        log('\n📝 填写通用属性');

        // 产地
        await selectRadio('产地', defaults.origin);

        // 计量单位
        await fillInput('计量单位', defaults.unit) ||
            await selectDropdown('计量单位', defaults.unit);

        // ========== 3. 价格信息 ==========
        log('\n💰 填写价格信息');

        const discountedPrice = calculateDiscountPrice(data.price);
        log(`原价: ${data.price}, 下浮后: ${discountedPrice} (下浮 ${((1 - discountedPrice / data.price) * 100).toFixed(2)}%)`);

        await fillInput('售价', discountedPrice.toString());
        await fillInput('供价', discountedPrice.toString());
        await fillInput('市场价', data.price.toString());

        // 库存
        if (data.stock) {
            await fillInput('库存', data.stock.toString());
        }

        // ========== 4. 运费模版 ==========
        log('\n🚚 选择运费模版');
        await selectShippingTemplate();

        // ========== 5. 技术参数（从采集数据匹配） ==========
        if (data.specs) {
            log('\n📋 填写技术参数');
            for (const [key, value] of Object.entries(data.specs)) {
                await fillInput(key, value);
            }
        }

        // 填写类目默认值
        for (const [key, value] of Object.entries(defaults)) {
            if (key !== 'unit' && key !== 'origin') {
                await fillInput(key, value);
            }
        }

        // ========== 6. 图片上传 ==========
        log('\n🖼️ 上传图片');

        if (data.mainImages.length > 0) {
            const imageResult = await processAndUploadImages({
                mainImages: data.mainImages,
                detailImages: data.detailImages,
            });

            if (!imageResult.success) {
                errors.push('图片上传失败');
            }

            log(`主图上传: ${imageResult.mainUploaded} 张`);
            log(`详情图上传: ${imageResult.detailUploaded} 张`);
        }

        // ========== 完成 ==========
        log('\n═══════════════════════════════════════');
        log('✅ 发布页面填写完成');
        log('═══════════════════════════════════════');

        return {
            success: errors.length === 0,
            errors,
            priceUsed: discountedPrice,
        };

    } catch (error) {
        log('填写异常:', error);
        errors.push(String(error));
        return {
            success: false,
            errors,
            priceUsed: 0,
        };
    }
}

/**
 * 点击提交发布
 */
export async function submitPublish(): Promise<boolean> {
    log('点击提交发布...');

    // 找提交按钮
    const submitButtons = document.querySelectorAll('button, .el-button');
    for (const btn of submitButtons) {
        const text = (btn as HTMLElement).innerText?.trim();
        if (text === '提交' || text === '发布' || text === '保存并发布') {
            (btn as HTMLElement).click();
            log('✓ 点击提交按钮');
            await wait(2000);

            // 确认弹窗
            const confirmBtns = document.querySelectorAll('.el-button--primary, [class*="confirm"]');
            for (const confirmBtn of confirmBtns) {
                const confirmText = (confirmBtn as HTMLElement).innerText?.trim();
                if (confirmText === '确定' || confirmText === '确认') {
                    (confirmBtn as HTMLElement).click();
                    log('✓ 确认提交');
                    break;
                }
            }

            return true;
        }
    }

    log('✗ 未找到提交按钮');
    return false;
}

// 导出清理函数
export { clearImageCache };
