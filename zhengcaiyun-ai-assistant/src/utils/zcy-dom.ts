/**
 * 政采云页面DOM操作模块
 * 负责识别和操作政采云网站的表单元素
 */

import { fetchWithAuth } from "~src/utils/api"

export interface ProductData {
    name: string;
    category?: string;
    images?: string[];
    description?: string;
    price?: string | number;
    stock?: string | number;
    brand?: string;
    attributes?: Record<string, string>;
}

/**
 * 查找商品名称输入框
 */
export function findProductNameInput(): HTMLInputElement | null {
    const selectors = [
        'input[name="productName"]',
        'input[placeholder*="商品名称"]',
        'input[placeholder*="商品标题"]',
        '#productName',
        '.product-name-input',
        'input[maxlength="60"]' // Common for title inputs
    ];

    for (const selector of selectors) {
        const input = document.querySelector(selector) as HTMLInputElement;
        if (input) {
            console.log('[DOM] 找到商品名称输入框:', selector);
            return input;
        }
    }
    return null;
}

/**
 * 查找价格输入框
 */
export function findPriceInput(): HTMLInputElement | null {
    const selectors = [
        'input[name="price"]',
        'input[placeholder*="价格"]',
        'input[placeholder*="单价"]',
        'input[type="number"][min="0"]'
    ];

    for (const selector of selectors) {
        const input = document.querySelector(selector) as HTMLInputElement;
        if (input) {
            console.log('[DOM] 找到价格输入框:', selector);
            return input;
        }
    }
    return null;
}

/**
 * 查找库存输入框
 */
export function findStockInput(): HTMLInputElement | null {
    const selectors = [
        'input[name="stock"]',
        'input[placeholder*="库存"]',
        'input[placeholder*="数量"]'
    ];

    for (const selector of selectors) {
        const input = document.querySelector(selector) as HTMLInputElement;
        if (input) {
            console.log('[DOM] 找到库存输入框:', selector);
            return input;
        }
    }
    return null;
}

/**
 * 通用输入框填写函数
 */
function fillInput(input: HTMLInputElement | HTMLTextAreaElement, value: string): boolean {
    if (!input) return false;

    // Focus first
    input.focus();
    input.value = value;

    // Dispatch events to trigger React/Vue change detection
    const events = ['input', 'change', 'blur'];
    events.forEach(eventType => {
        input.dispatchEvent(new Event(eventType, { bubbles: true }));
    });

    // React 16+ hack for value setter
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (nativeInputValueSetter) {
        nativeInputValueSetter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    return true;
}

/**
 * 填写商品名称
 */
export function fillProductName(name: string): boolean {
    const input = findProductNameInput();
    if (!input) return false;
    return fillInput(input, name);
}

/**
 * 填写价格
 */
export function fillPrice(price: string | number): boolean {
    const input = findPriceInput();
    if (!input) return false;
    return fillInput(input, String(price));
}

/**
 * 填写库存
 */
export function fillStock(stock: string | number): boolean {
    const input = findStockInput();
    if (!input) return false;
    return fillInput(input, String(stock));
}

/**
 * 填写商品描述 (富文本编辑器处理)
 */
export function fillDescription(description: string): boolean {
    // 1. Try standard textarea
    const textarea = document.querySelector('textarea[name="description"], textarea[placeholder*="描述"]') as HTMLTextAreaElement;
    if (textarea) {
        return fillInput(textarea, description);
    }

    // 2. Try ContentEditable div (Common in rich text editors)
    const editor = document.querySelector('.w-e-text, .ql-editor, [contenteditable="true"]') as HTMLElement;
    if (editor) {
        editor.innerHTML = description;
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
    }

    return false;
}

/**
 * 填写 SKU 表格 (价格/库存/规格)
 */
export async function fillSkuTable(skuData: any): Promise<boolean> {
    if (!skuData || (!skuData.price && !skuData.stock)) return false;

    // Try to find the SKU table
    const table = document.querySelector('table.sku-table, .sku-list-table') as HTMLTableElement;
    if (!table) {
        console.log('[DOM] No SKU table found, skipping SKU fill');
        return false;
    }

    console.log('[DOM] Finding SKU table rows...');
    const rows = Array.from(table.querySelectorAll('tr')); // Skip header usually

    // Strategy: Fill ALL rows with the same price/stock if we don't have specific mapping
    // Since we scraped a single SKU, we assume the user wants to apply this price to all rows
    // or we find the row that matches our attributes.

    // For MVP Commercial, we batch fill all rows
    let filledCount = 0;

    for (const row of rows) {
        const priceInput = row.querySelector('input[placeholder*="价格"], input[name*="price"]') as HTMLInputElement;
        const stockInput = row.querySelector('input[placeholder*="库存"], input[name*="stock"]') as HTMLInputElement;

        if (priceInput && skuData.price) {
            fillInput(priceInput, String(skuData.price));
            filledCount++;
        }

        if (stockInput && skuData.stock) {
            fillInput(stockInput, String(skuData.stock));
            filledCount++;
        }
    }

    if (filledCount > 0) {
        console.log(`[DOM] Filled ${filledCount} inputs in SKU table`);
        return true;
    }

    return false;
}

/**
 * 填写动态属性
 */
export async function fillAttributes(attributes: Record<string, string>): Promise<void> {
    if (!attributes) return;

    for (const [key, value] of Object.entries(attributes)) {
        // Find label containing attribute name
        const labels = Array.from(document.querySelectorAll('label'));
        const targetLabel = labels.find(l => l.textContent?.includes(key));

        if (targetLabel) {
            // Find associated input
            const inputId = targetLabel.getAttribute('for');
            let input;

            if (inputId) {
                input = document.getElementById(inputId);
            } else {
                // Look for input inside or next to label
                input = targetLabel.querySelector('input') || targetLabel.nextElementSibling?.querySelector('input');
            }

            if (input) {
                fillInput(input as HTMLInputElement, value);
                console.log(`[DOM] 已填写属性: ${key} = ${value}`);
            }
        }
    }
}

/**
 * 查找图片上传按钮
 */
export function findImageUploadButton(): HTMLInputElement | null {
    const selectors = [
        'input[type="file"][accept*="image"]',
        'input[type="file"]',
        '.upload-button input',
        '.ant-upload input[type="file"]' // Ant Design
    ];

    for (const selector of selectors) {
        const input = document.querySelector(selector) as HTMLInputElement;
        if (input) {
            return input;
        }
    }
    return null;
}

/**
 * 上传图片文件
 */
export async function uploadImage(imageUrl: string): Promise<boolean> {
    try {
        console.log('[DOM] 开始上传图片:', imageUrl);

        // 1. Fetch image via proxy to bypass CORS/Hotlink protection
        // Use fetchWithAuth to ensure we are authorized to use the proxy
        const proxyUrl = `/api/copy/image-proxy?url=${encodeURIComponent(imageUrl)}`;
        const response = await fetchWithAuth(proxyUrl);

        if (!response.ok) {
            throw new Error(`Proxy fetch failed: ${response.statusText}`);
        }

        const blob = await response.blob();
        const file = new File([blob], "image.jpg", { type: blob.type });

        // 2. Find upload button
        const fileInput = findImageUploadButton();
        if (!fileInput) {
            throw new Error('未找到图片上传按钮');
        }

        // 3. Simulate file upload
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;

        // Trigger events
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        fileInput.dispatchEvent(new Event('input', { bubbles: true }));

        console.log('[DOM] 图片上传触发成功');
        return true;

    } catch (error) {
        console.error('[DOM] 图片上传失败:', error);
        return false;
    }
}

/**
 * 完整的商品上传流程
 */
export async function uploadProduct(productData: ProductData): Promise<{
    success: boolean;
    step: string;
    error?: string;
}> {
    try {
        console.log('[DOM] 开始自动填表...', productData);

        // 1. Basic Info
        if (!fillProductName(productData.name)) {
            console.warn('[DOM] 无法填写商品名称');
        }
        await sleep(300);

        if (productData.price) fillPrice(productData.price);
        await sleep(300);

        if (productData.stock) fillStock(productData.stock);
        await sleep(300);

        // 2. Description
        if (productData.description) {
            fillDescription(productData.description);
        }
        await sleep(500);

        // 3. Attributes
        if (productData.attributes) {
            await fillAttributes(productData.attributes);
        }
        await sleep(500);

        // 3.5 SKU Table
        // Use price/stock from main product data as default for table
        await fillSkuTable({ price: productData.price, stock: productData.stock });
        await sleep(500);

        // 4. Images (Try first 5)
        if (productData.images && productData.images.length > 0) {
            const imagesToUpload = productData.images.slice(0, 5);
            for (const img of imagesToUpload) {
                await uploadImage(img);
                await sleep(1000); // Wait for upload
            }
        }

        return { success: true, step: 'completed' };

    } catch (error) {
        console.error('[Upload] 上传流程异常:', error);
        return {
            success: false,
            step: 'unknown',
            error: error instanceof Error ? error.message : '未知错误'
        };
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract the current ZCY Region/Province
 */
export function extractRegion(): string {
    // 1. Try site name header
    const siteName = document.querySelector('.site-name, .current-site, .region-name')?.textContent?.trim();
    if (siteName) return siteName.replace('政府采购网', '').trim();

    // 2. Try Subdomain (e.g. gansu.zcygov.cn)
    const hostname = window.location.hostname;
    const subdomain = hostname.split('.')[0];
    const regionMap: Record<string, string> = {
        'gansu': '甘肃',
        'zhejiang': '浙江',
        'shandong': '山东',
        'guangxi': '广西',
        'hunan': '湖南',
        // Add more mappings as needed
    };
    if (regionMap[subdomain]) return regionMap[subdomain];

    // 3. Fallback to parsing document title
    const title = document.title;
    const regions = ['甘肃', '浙江', '山东', '广西', '湖南', '重庆', '四川'];
    for (const r of regions) {
        if (title.includes(r)) return r;
    }

    return 'Global'; // Default
}

export function checkApprovalStatusFromDOM(): 'approved' | 'rejected' | 'pending' | 'unknown' {
    const textContent = document.body.innerText;

    if (textContent.includes('审核通过') || textContent.includes('已上架')) {
        return 'approved';
    }

    if (textContent.includes('审核驳回') || textContent.includes('审核不通过')) {
        return 'rejected';
    }

    if (textContent.includes('审核中') || textContent.includes('待审核')) {
        return 'pending';
    }

    // Check specific status badges if text is ambiguous
    const statusBadges = document.querySelectorAll('.status-badge, .ant-tag');
    for (const badge of Array.from(statusBadges)) {
        const text = badge.textContent?.trim();
        if (text === '已上架') return 'approved';
        if (text === '审核中') return 'pending';
    }

    return 'unknown';
}

/**
 * Click "Edit" button for a specific product
 * Assumes we are on the product list page
 */
export async function clickEditButton(productId?: string): Promise<boolean> {
    // 1. If productId is provided, find the specific row
    if (productId) {
        const row = document.querySelector(`tr[data-row-key="${productId}"]`) ||
            document.querySelector(`div[data-id="${productId}"]`);

        if (row) {
            const btn = row.querySelector('a:contains("编辑"), button:contains("编辑"), .edit-btn') as HTMLElement;
            if (btn) {
                btn.click();
                return true;
            }
        }
    }

    // 2. Generic "Edit" button search (First one found)
    const buttons = Array.from(document.querySelectorAll('button, a'));
    const editBtn = buttons.find(b => b.textContent?.trim().includes('编辑'));

    if (editBtn) {
        (editBtn as HTMLElement).click();
        return true;
    }

    return false;
}

/**
 * Find the category selector trigger
 */
export function findCategorySelector(): HTMLElement | null {
    const selectors = [
        '.category-selector',
        '.ant-cascader-picker',
        '[placeholder*="类目"]',
        '#category-picker'
    ];

    for (const selector of selectors) {
        const el = document.querySelector(selector) as HTMLElement;
        if (el) return el;
    }
    return null;
}

/**
 * Select a category by name
 */
export function selectCategory(categoryName: string): boolean {
    // Try to find the category in the visible dropdown
    const options = Array.from(document.querySelectorAll('.ant-cascader-menu-item, .category-option, li'));

    for (const option of options) {
        if (option.textContent?.trim() === categoryName) {
            (option as HTMLElement).click();
            return true;
        }
    }
    return false;
}

/**
 * Find category search input
 */
export function findCategorySearchInput(): HTMLInputElement | null {
    const selectors = [
        '#search', // Verified ID
        'input[placeholder*="请输入类目名称"]',
        'input.ant-input-search',
        '.category-search input',
        'input[type="text"]'
    ];

    // Filter for inputs that look like the search bar (usually at the top)
    const inputs = Array.from(document.querySelectorAll('input'));
    const searchInput = inputs.find(input =>
        input.id === 'search' ||
        input.placeholder.includes('类目名称') ||
        input.placeholder.includes('关键词') ||
        input.className.includes('search')
    );

    return searchInput as HTMLInputElement || null;
}

/**
 * Search and select category
 */
export async function searchAndSelectCategory(keyword: string): Promise<boolean> {
    console.log('[DOM] Searching for category:', keyword);

    const input = findCategorySearchInput();
    if (!input) {
        console.warn('[DOM] Category search input not found');
        return false;
    }

    // Visual Debug: Highlight the input
    const originalBorder = input.style.border;
    input.style.border = '2px solid red';

    // 1. Type keyword
    input.focus();
    input.value = keyword;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    await sleep(500);

    // Trigger search (Enter or Click icon)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    // Try finding search button
    const searchBtn = input.nextElementSibling as HTMLElement ||
        input.parentElement?.querySelector('.ant-input-search-icon') ||
        input.parentElement?.querySelector('button');

    if (searchBtn) {
        searchBtn.click();
        console.log('[DOM] Clicked search button');
    }

    await sleep(2000); // Wait for results
    input.style.border = originalBorder; // Remove highlight

    // 2. Select first result
    // Strategy: Look for the result list items
    // ZCY uses custom class .doraemon-select-dropdown-menu-item for search results
    const resultItems = document.querySelectorAll('li.doraemon-select-dropdown-menu-item, .ant-select-dropdown-menu-item');

    if (resultItems.length > 0) {
        // Click the first item
        const node = resultItems[0] as HTMLElement;
        if (node) {
            node.click();
            console.log('[DOM] Selected category node by dropdown item');
            return true;
        }
    }

    // Fallback: Try to find text match in the category tree/list area
    // Also check for highlighted text
    const highlighted = document.querySelectorAll('.ant-tree-node-content-wrapper span[style*="color"]');
    if (highlighted.length > 0) {
        const node = highlighted[0].closest('.ant-tree-node-content-wrapper') as HTMLElement;
        if (node) {
            node.click();
            console.log('[DOM] Selected category node by highlight');
            return true;
        }
    }

    return false;
}

/**
 * Handle Modals (Duplicate Product, SPU Application)
 */
export async function handleModals(): Promise<void> {
    console.log('[DOM] Checking for modals...');

    // 1. Duplicate Product Modal
    // Usually has text "重复铺货" or "已发布"
    // Buttons: "继续发品" (Continue) or "取消" (Cancel)
    // We want to continue if possible, or cancel if blocked.
    // User strategy: If "Duplicate", maybe we should just continue?
    // Let's look for "继续发品"
    const continueBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent?.includes('继续发品'));
    if (continueBtns.length > 0) {
        console.log('[DOM] Found "Continue Publishing" button, clicking...');
        continueBtns[0].click();
        await sleep(1000);
        return;
    }

    // 2. SPU Application Modal (Standard Product Unit)
    // Usually "标准商品", "申请", "返回修改"
    // If we hit this, we might be in the wrong category or need to apply.
    // For automation, we usually want to "Return" and try another category or just close it.
    // But if we can't proceed, we are stuck.
    // Let's try to close it if it's blocking.
    const closeBtns = Array.from(document.querySelectorAll('.ant-modal-close, button.ant-btn-default'));
    const returnBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('返回修改'));

    if (returnBtn) {
        console.log('[DOM] Found "Return to Modify" button, clicking...');
        returnBtn.click();
        await sleep(1000);
        return;
    }
}

/**
 * Select Brand by Name
 */
export async function selectBrand(brandName: string): Promise<boolean> {
    console.log(`[DOM] Trying to select brand: ${brandName}`);

    // 1. Find Brand Section
    // Usually a label "品牌" and a container next to it
    const brandLabel = Array.from(document.querySelectorAll('label')).find(l => l.textContent?.includes('品牌'));
    if (!brandLabel) return false;

    const container = brandLabel.closest('.ant-row') || brandLabel.parentElement?.parentElement;
    if (!container) return false;

    // 2. Check if it's a search box (Select/Cascader) or a list
    // ZCY Brand selector is often a custom search box or an Ant Select
    const searchInput = container.querySelector('input[placeholder*="品牌"], input.ant-select-search__field') as HTMLInputElement;

    if (searchInput) {
        console.log('[DOM] Found brand search input');
        // Type brand name
        searchInput.focus();
        searchInput.value = brandName;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(1000); // Wait for search results

        // Select first result
        // The results usually appear in a dropdown portal, not inside the container
        // We look for .ant-select-dropdown-menu-item containing the text
        const options = Array.from(document.querySelectorAll('.ant-select-dropdown-menu-item, li[role="option"]'));
        const targetOption = options.find(opt => opt.textContent?.includes(brandName));

        if (targetOption) {
            (targetOption as HTMLElement).click();
            console.log('[DOM] Selected brand from dropdown');
            return true;
        }
    }

    return false;
}

/**
 * Fill All Required Attributes (Brute Force)
 */
export async function fillAllRequiredAttributes(): Promise<void> {
    console.log('[DOM] Brute-forcing all required attributes...');

    // Find all required labels
    const requiredLabels = document.querySelectorAll('label.ant-form-item-required');

    for (const label of Array.from(requiredLabels)) {
        const container = label.closest('.ant-row') || label.parentElement?.parentElement;
        if (!container) continue;

        // Check if already filled
        const input = container.querySelector('input, select, textarea') as HTMLInputElement;
        if (input && input.value) continue; // Already has value

        // 1. Radio Buttons
        const radios = container.querySelectorAll('input[type="radio"]');
        if (radios.length > 0) {
            // Select "No" or "Other" or first one
            // Strategy: Prefer "无", "否", "其他"
            let targetRadio = Array.from(radios).find(r => {
                const text = r.parentElement?.textContent || '';
                return text.includes('无') || text.includes('否') || text.includes('其他');
            });

            if (!targetRadio) targetRadio = radios[0]; // Default to first

            if (targetRadio && !(targetRadio as HTMLInputElement).checked) {
                (targetRadio as HTMLElement).click();
                await sleep(200);
            }
            continue;
        }

        // 2. Checkboxes
        // Be careful not to check everything. Maybe just check "无" if available.
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        if (checkboxes.length > 0) {
            const noneCheckbox = Array.from(checkboxes).find(c => {
                const text = c.parentElement?.textContent || '';
                return text.includes('无') || text.includes('不');
            });

            if (noneCheckbox && !(noneCheckbox as HTMLInputElement).checked) {
                (noneCheckbox as HTMLElement).click();
                await sleep(200);
            }
            continue;
        }

        // 3. Select/Cascader (Hard to automate blindly, but let's try opening and clicking first option)
        const selectTrigger = container.querySelector('.ant-select, .ant-cascader-picker');
        if (selectTrigger) {
            (selectTrigger as HTMLElement).click();
            await sleep(500);
            // Try to click the first option in the dropdown
            const firstOption = document.querySelector('.ant-select-dropdown-menu-item, .ant-cascader-menu-item');
            if (firstOption) {
                (firstOption as HTMLElement).click();
                await sleep(200);
            }
        }
    }
}

/**
 * Fill Category Attributes (Brand/Model) - Enhanced
 */
export async function fillCategoryAttributes(brandName?: string): Promise<boolean> {
    console.log('[DOM] Filling category attributes...');

    // Helper to find and click checkbox by label text
    const clickCheckboxByText = async (text: string) => {
        const spans = Array.from(document.querySelectorAll('span, label, div'));
        const targetSpan = spans.find(s => s.textContent?.includes(text) && s.children.length === 0);

        if (targetSpan) {
            let container = targetSpan.parentElement;
            let checkbox: HTMLInputElement | null = null;

            for (let i = 0; i < 4; i++) {
                if (!container) break;
                checkbox = container.querySelector('input[type="checkbox"]');
                if (checkbox) break;
                container = container.parentElement;
            }

            if (checkbox && !checkbox.checked) {
                console.log(`[DOM] Found checkbox for "${text}", clicking...`);
                checkbox.click();
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                await sleep(500);
                return true;
            }
        }
        return false;
    };

    // 1. Handle Brand
    let brandSelected = false;
    if (brandName) {
        brandSelected = await selectBrand(brandName);
    }

    // Only click "No Brand" if we didn't select a brand AND we don't have a brand name to select
    if (!brandSelected && !brandName) {
        await clickCheckboxByText('无品牌');
    }

    // 2. Handle "No Model" (Usually safe to default to No Model if not provided)
    await clickCheckboxByText('无型号');

    // 3. Brute force others
    await fillAllRequiredAttributes();

    return true;
}

/**
 * Click "Next Step" button
 */
export async function clickNextStep(): Promise<boolean> {
    console.log('[DOM] Clicking Next Step...');

    const nextBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('下一步'));

    if (nextBtn && !nextBtn.disabled) {
        nextBtn.click();
        return true;
    }

    return false;
}

/**
 * Submit Form
 */
export async function submitForm(): Promise<boolean> {
    console.log('[DOM] 尝试提交表单...');

    const selectors = [
        'button.submit-btn',
        'button[type="button"].ant-btn-primary', // Common AntD submit button
        'button:contains("发布")',
        'button:contains("提交")',
        'button:contains("保存")'
    ];

    // Helper to find button by text
    const findBtn = () => {
        const buttons = Array.from(document.querySelectorAll('button'));
        // Filter visible buttons only
        const visibleButtons = buttons.filter(b => b.offsetParent !== null);

        // Priority 1: Exact text match
        let btn = visibleButtons.find(b =>
            b.textContent?.trim() === '立即发布' ||
            b.textContent?.trim() === '提交审核'
        );

        // Priority 2: Contains text
        if (!btn) {
            btn = visibleButtons.find(b =>
                b.textContent?.includes('立即发布') ||
                b.textContent?.includes('提交审核')
            );
        }

        return btn;
    };

    const submitBtn = findBtn();

    if (submitBtn) {
        console.log('[DOM] 找到提交按钮:', submitBtn.textContent);
        submitBtn.click();

        // Handle potential "Confirm" dialog
        await sleep(1000);

        // Look for a secondary confirm button in a modal
        const confirmBtn = document.querySelector('.ant-modal-confirm-btns button.ant-btn-primary, .ant-modal-footer button.ant-btn-primary') as HTMLElement;
        if (confirmBtn) {
            console.log('[DOM] 找到确认弹窗按钮，点击确认...');
            confirmBtn.click();
        }

        return true;
    }

    console.warn('[DOM] 未找到提交按钮');
    return false;
}
