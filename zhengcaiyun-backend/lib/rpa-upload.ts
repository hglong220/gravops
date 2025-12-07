/**
 * RPA自动上传服务
 * 使用Playwright模拟人工操作，上传到政采云
 * 核心：比人快，但要像人
 */

import { chromium, Browser, Page } from 'playwright';
import priceComparison from './price-comparison';
import categoryMatch from './category-match';
import imageProcessing from './image-processing';

interface UploadTask {
    product: any;
    priceComparison: any;
    category: any;
    images: string[];
    pricing: any;
}

interface UploadResult {
    success: boolean;
    productId?: string;
    message: string;
    timeUsed: number;
    steps: string[];
}

export class RPAUploadService {

    private browser: Browser | null = null;
    private page: Page | null = null;

    /**
     * 初始化浏览器
     */
    async init() {
        if (!this.browser) {
            this.browser = await chromium.launch({
                headless: false,  // 可见模式（调试用）
                slowMo: 100       // 放慢操作，更像人
            });

            this.page = await this.browser.newPage();

            // 设置视口
            await this.page.setViewportSize({ width: 1920, height: 1080 });
        }
    }

    /**
     * 完整的上传流程
     */
    async uploadProduct(product: any): Promise<UploadResult> {
        const startTime = Date.now();
        const steps: string[] = [];

        try {
            await this.init();

            steps.push('✅ 浏览器初始化完成');

            // Step 1: 获取比价信息
            steps.push('🔍 Step 1: 获取比价信息...');
            const priceComp = await priceComparison.getPriceComparison(product);

            if (priceComp.status === 'not_found') {
                return {
                    success: false,
                    message: '未找到京东/天猫/苏宁比价链接',
                    timeUsed: Date.now() - startTime,
                    steps
                };
            }

            steps.push(`✅ 比价链接: ${priceComp.comparison?.platform}`);

            // Step 2: AI匹配类目
            steps.push('🤖 Step 2: AI智能匹配类目...');
            const category = await categoryMatch.matchCategory(product);
            steps.push(`✅ 类目: ${category.category.name} (置信度: ${category.confidence})`);

            // Step 3: 获取合规图片
            steps.push('🖼️ Step 3: 获取合规图片...');
            const imageResult = await imageProcessing.getComplianceImages(product);
            steps.push(`✅ 图片: ${imageResult.images.length}张 (${imageResult.source}, 合规度: ${imageResult.compliance})`);

            // Step 4: 计算定价
            steps.push('💰 Step 4: 计算最优价格...');
            const pricing = priceComparison.calculateOptimalPrice(priceComp.comparison!);
            steps.push(`✅ 定价: ¥${pricing.yourPrice} (下浮${pricing.discount}%)`);

            // Step 5: RPA自动填单
            steps.push('🤖 Step 5: RPA自动填写表单...');
            await this.rpaFillForm({
                product,
                priceComparison: priceComp.comparison!,
                category: category.category,
                images: imageResult.images,
                pricing
            });

            steps.push('✅ 表单填写完成');

            // Step 6: 提交
            steps.push('📤 Step 6: 提交审核...');
            const productId = await this.submit();
            steps.push(`✅ 提交成功，商品ID: ${productId}`);

            return {
                success: true,
                productId,
                message: '上传成功',
                timeUsed: Date.now() - startTime,
                steps
            };

        } catch (error: any) {
            steps.push(`❌ 错误: ${error.message}`);

            return {
                success: false,
                message: error.message,
                timeUsed: Date.now() - startTime,
                steps
            };
        }
    }

    /**
     * RPA填写表单（核心）
     */
    private async rpaFillForm(task: UploadTask) {
        if (!this.page) throw new Error('浏览器未初始化');

        const page = this.page;

        // 1. 打开政采云商品发布页
        await page.goto('https://www.zcygov.cn/goods-center/goods/publish');
        await this.randomDelay(2000, 3000);

        // 2. 填写商品名称（模拟打字）
        console.log('📝 填写商品名称...');
        await this.typeHumanLike(page, '#productName', task.product.title);
        await this.randomDelay(1000, 2000);

        // 3. 选择类目（关键！）
        console.log('📂 选择类目...');
        await this.selectCategory(page, task.category);
        await this.randomDelay(1500, 2500);

        // 4. 上传图片
        console.log('🖼️ 上传图片...');
        await this.uploadImages(page, task.images);
        await this.randomDelay(2000, 3000);

        // 5. 填写价格
        console.log('💰 填写价格...');
        await this.typeHumanLike(page, '#price', task.pricing.yourPrice.toString());
        await this.randomDelay(1000, 1500);

        // 6. 填写比价信息（政采云特有）⭐
        console.log('🏷️ 填写比价信息...');
        await this.fillPriceComparison(page, task.priceComparison);
        await this.randomDelay(1500, 2000);

        // 7. 填写商品详情
        console.log('📄 填写商品详情...');
        if (task.product.description) {
            await this.typeHumanLike(page, '#description', task.product.description);
            await this.randomDelay(1000, 2000);
        }

        // 8. 填写其他必填项
        console.log('📋 填写其他信息...');
        await this.fillOtherFields(page, task.product);
    }

    /**
     * 选择类目（使用18575个类目数据）
     */
    private async selectCategory(page: Page, category: any) {
        // 获取类目路径
        const path = await this.getCategoryPath(category.id);

        console.log('类目路径:', path);

        // 逐级选择
        for (let i = 0; i < path.length; i++) {
            const levelSelector = `.category-level-${i + 1}`;

            // 点击下拉框
            await this.clickHumanLike(page, levelSelector);
            await this.randomDelay(500, 1000);

            // 找到并点击选项
            const optionText = path[i].name;
            const option = await page.$(`text=${optionText}`);

            if (option) {
                await this.clickHumanLike(page, option);
                await this.randomDelay(800, 1500);
            } else {
                throw new Error(`找不到类目: ${optionText}`);
            }
        }
    }

    /**
     * 获取类目完整路径
     */
    private async getCategoryPath(categoryId: number): Promise<any[]> {
        // 从18575个类目中查找完整路径
        const response = await fetch(`/api/categories/path/${categoryId}`);
        const data = await response.json();
        return data.path;
    }

    /**
     * 上传图片
     */
    private async uploadImages(page: Page, images: string[]) {
        for (let i = 0; i < Math.min(images.length, 5); i++) {
            const imageUrl = images[i];

            // 下载图片到本地
            const localPath = await this.downloadImageToLocal(imageUrl);

            // 上传
            const fileInput = await page.$('input[type="file"]');
            if (fileInput) {
                await fileInput.setInputFiles(localPath);
                await this.randomDelay(1500, 2500);
            }

            console.log(`✅ 上传第 ${i + 1} 张图片`);
        }
    }

    /**
     * 填写比价信息（政采云特有）⭐
     */
    private async fillPriceComparison(page: Page, comparison: any) {
        // 选择比价平台
        const platformMap: Record<string, string> = {
            'jd': '京东',
            'tmall': '天猫',
            'suning': '苏宁'
        };

        const platformName = platformMap[comparison.platform];

        // 选择平台
        await page.click('#price-platform');
        await this.randomDelay(300, 600);
        await page.click(`text=${platformName}`);
        await this.randomDelay(500, 1000);

        // 填写比价链接
        await this.typeHumanLike(page, '#price-comparison-url', comparison.url);
        await this.randomDelay(500, 1000);

        // 系统会自动获取比价平台的价格
        // 等待价格加载
        await page.waitForSelector('#comparison-price-loaded', { timeout: 10000 });

        console.log(`✅ 比价信息: ${platformName} - ${comparison.url}`);
    }

    /**
     * 填写其他字段
     */
    private async fillOtherFields(page: Page, product: any) {
        // 品牌 / 型号使用政采云自研的 doraemon-select 组件，需要通过 aria-controls 精准找到下拉面板并点击选项
        await this.fillBrandAndModel(page, product.brand, (product as any).model);
        await this.randomDelay(500, 800);

        // 规格参数
        if (product.specs) {
            for (const [key, value] of Object.entries(product.specs)) {
                const selector = `#spec-${key}`;
                if (await page.$(selector)) {
                    await this.typeHumanLike(page, selector, value as string);
                    await this.randomDelay(300, 600);
                }
            }
        }
    }

    /**
     * 提交
     */
    private async submit(): Promise<string> {
        if (!this.page) throw new Error('浏览器未初始化');

        // 点击提交按钮
        await this.clickHumanLike(this.page, '#submit-button');

        // 等待提交成功
        await this.page.waitForSelector('.success-message', { timeout: 30000 });

        // 获取商品ID
        const productId = await this.page.$eval('.product-id', el => el.textContent);

        return productId || 'unknown';
    }

    /**
     * 在政采云品牌 / 型号字段中选择值
     * 使用 aria-controls 找到对应的下拉面板，并在面板内点击选项，而不是直接改文本
     */
    private async fillBrandAndModel(page: Page, brand?: string, model?: string) {
        await page.evaluate(
            async ({ brand, model }) => {
                const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
                const norm = (str = '') =>
                    str.replace(/\s+/g, '').replace(/[\/\\]/g, '').toLowerCase();

                const waitForElement = async <T extends Element>(
                    getter: () => T | null,
                    timeout = 8000,
                    interval = 150
                ): Promise<T | null> => {
                    const start = Date.now();
                    let el = getter();
                    while (!el && Date.now() - start < timeout) {
                        await sleep(interval);
                        el = getter();
                    }
                    return el;
                };

                const findDoraSelectByLabel = (labelText: string) => {
                    const selects = document.querySelectorAll('.doraemon-select-selection');
                    for (const sel of selects) {
                        let p: Element | null = sel;
                        for (let i = 0; i < 12 && p; i++) {
                            const txt = (p.textContent || '').replace(/\s+/g, '');
                            if (txt.includes(labelText)) return sel as HTMLElement;
                            p = p.parentElement;
                        }
                    }
                    return null;
                };

                const findFieldByLabelText = (
                    labelText: string,
                    selector = 'input',
                    depth = 10
                ) => {
                    const candidates = Array.from(document.querySelectorAll(selector));
                    const target = norm(labelText);
                    for (const el of candidates) {
                        let p: Element | null = el;
                        for (let i = 0; i < depth && p; i++) {
                            const txt = (p.textContent || '').replace(/\s+/g, '');
                            if (norm(txt).includes(target)) return el as HTMLInputElement;
                            p = p.parentElement;
                        }
                    }
                    return null;
                };

                const selectBrand = async (brandText?: string) => {
                    if (!brandText) return;

                    console.log('[RPA V3]   查找品牌下拉框...');
                    const selectEl = await waitForElement(
                        () => findDoraSelectByLabel('品牌'),
                        8000
                    );
                    if (!selectEl) {
                        console.log('[RPA V3]   ❌ 未找到品牌选择框');
                        return;
                    }

                    const currentNameEl = selectEl.querySelector('.brand-item-name');
                    const currentName = currentNameEl ? currentNameEl.textContent?.trim() || '' : '';
                    if (currentName && norm(currentName).includes(norm(brandText))) {
                        console.log('[RPA V3]   ✓ 品牌已是目标值，无需修改:', currentName);
                        return;
                    }

                    console.log('[RPA V3]   找到品牌下拉框:', selectEl.className);
                    selectEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    await sleep(200);

                    const popupId = selectEl.getAttribute('aria-controls');
                    const popup = await waitForElement(
                        () => (popupId ? document.getElementById(popupId) : null),
                        2000
                    );
                    if (!popup) {
                        console.log('[RPA V3]   ❌ 找不到品牌下拉面板, popupId =', popupId);
                        return;
                    }

                    const items = popup.querySelectorAll('.doraemon-select-dropdown-menu-item, li');
                    console.log('[RPA V3]   下拉项个数:', items.length);

                    let target: Element | null = null;
                    for (const li of items) {
                        const txt = li.textContent?.trim() || '';
                        if (norm(txt).includes(norm(brandText))) {
                            target = li;
                            break;
                        }
                    }

                    if (!target) {
                        console.log('[RPA V3]   ❌ 下拉中未找到品牌:', brandText);
                        return;
                    }

                    target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    console.log('[RPA V3]   ✓ 已选择品牌:', target.textContent?.trim());
                };

                const selectModel = async (modelText?: string) => {
                    console.log('[RPA V3]   查找型号控件...');
                    const selectEl = await waitForElement(
                        () => findDoraSelectByLabel('型号'),
                        8000
                    );
                    if (!selectEl) {
                        console.log('[RPA V3]   ❌ 未找到型号选择框');
                        return;
                    }

                    if (!modelText || norm(modelText) === '无') {
                        const noModelCheckbox = findFieldByLabelText('无型号', 'input[type="checkbox"]', 10);
                        if (noModelCheckbox && !(noModelCheckbox as HTMLInputElement).checked) {
                            noModelCheckbox.click();
                            console.log('[RPA V3]   ✓ 已勾选 无型号');
                        }
                        return;
                    }

                    selectEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    await sleep(200);

                    const input = selectEl.querySelector<HTMLInputElement>('#specification');
                    if (!input) {
                        console.log('[RPA V3]   ❌ 型号搜索输入不存在');
                        return;
                    }

                    input.focus();
                    input.value = modelText;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    await sleep(300);

                    const popupId = selectEl.getAttribute('aria-controls');
                    const popup = await waitForElement(
                        () => (popupId ? document.getElementById(popupId) : null),
                        2000
                    );
                    if (!popup) {
                        console.log('[RPA V3]   ❌ 找不到型号下拉面板, popupId =', popupId);
                        return;
                    }

                    const items = popup.querySelectorAll('.doraemon-select-dropdown-menu-item, li');
                    let target: Element | null = null;
                    for (const li of items) {
                        const txt = li.textContent?.trim() || '';
                        if (norm(txt).includes(norm(modelText))) {
                            target = li;
                            break;
                        }
                    }

                    if (!target && items.length) {
                        input.dispatchEvent(
                            new KeyboardEvent('keydown', {
                                key: 'Enter',
                                keyCode: 13,
                                which: 13,
                                bubbles: true
                            })
                        );
                        console.log('[RPA V3]   ⚠ 未精确匹配型号，用回车选第一项');
                        return;
                    }

                    if (target) {
                        target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                        console.log('[RPA V3]   ✓ 已选择型号:', target.textContent?.trim());
                    }
                };

                await selectBrand(brand);
                await selectModel(model);
            },
            { brand: brand || '', model: model || '' }
        );
    }

    /**
     * 模拟人工打字
     */
    private async typeHumanLike(page: Page, selector: string, text: string) {
        await page.click(selector);
        await this.randomDelay(100, 300);

        // 逐字输入，每个字符100-200ms
        for (const char of text) {
            await page.type(selector, char);
            await this.randomDelay(100, 200);
        }
    }

    /**
     * 模拟人工点击
     */
    private async clickHumanLike(page: Page, selector: string | any) {
        // 先移动鼠标
        if (typeof selector === 'string') {
            const element = await page.$(selector);
            if (element) {
                await element.hover();
                await this.randomDelay(200, 500);
                await element.click();
            }
        } else {
            await selector.hover();
            await this.randomDelay(200, 500);
            await selector.click();
        }
    }

    /**
     * 随机延迟
     */
    private async randomDelay(min: number, max: number) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        await this.page?.waitForTimeout(delay);
    }

    /**
     * 下载图片到本地
     */
    private async downloadImageToLocal(url: string): Promise<string> {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();

        const fs = require('fs');
        const path = require('path');
        const tmpPath = path.join('/tmp', `image-${Date.now()}.jpg`);

        fs.writeFileSync(tmpPath, Buffer.from(buffer));

        return tmpPath;
    }

    /**
     * 关闭浏览器
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }
}

export default new RPAUploadService();
