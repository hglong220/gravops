/**
 * 政采云类目自动提取工具 - Playwright版
 * 100%合法，通过供应商后台发布商品流程提取类目
 */

const { chromium } = require('playwright');
const fs = require('fs-extra');
const path = require('path');

// 配置
const CONFIG = {
    loginUrl: 'https://login.zcygov.cn',
    publishUrl: 'https://shop.zcygov.cn/goods/publish', // 商品发布页面
    headless: process.argv.includes('--headless'), // 默认显示浏览器，方便登录
    debug: process.argv.includes('--debug'),
    outputDir: './output',

    // 等待时间配置（毫秒）
    timeout: {
        navigation: 60000,    // 页面导航超时
        element: 10000,       // 元素查找超时
        categoryLoad: 3000,   // 类目加载等待
        expandDelay: 500      // 展开类目延迟
    }
};

// 日志工具
const logger = {
    info: (msg) => console.log(`ℹ️  ${msg}`),
    success: (msg) => console.log(`✅ ${msg}`),
    error: (msg) => console.error(`❌ ${msg}`),
    debug: (msg) => CONFIG.debug && console.log(`🔍 ${msg}`),
    warn: (msg) => console.warn(`⚠️  ${msg}`)
};

// 类目数据存储
class CategoryStore {
    constructor() {
        this.categories = new Map();
        this.tree = [];
    }

    add(category) {
        const key = category.code || category.id;
        if (key && !this.categories.has(key)) {
            this.categories.set(key, category);
            return true;
        }
        return false;
    }

    getAll() {
        return Array.from(this.categories.values());
    }

    buildTree() {
        const all = this.getAll();
        const map = new Map();
        const roots = [];

        // 创建映射
        all.forEach(cat => {
            map.set(cat.code || cat.id, { ...cat, children: [] });
        });

        // 构建树
        all.forEach(cat => {
            const node = map.get(cat.code || cat.id);
            if (cat.parentCode || cat.pid) {
                const parent = map.get(cat.parentCode || cat.pid);
                if (parent) {
                    parent.children.push(node);
                } else {
                    roots.push(node);
                }
            } else {
                roots.push(node);
            }
        });

        this.tree = roots;
        return roots;
    }

    getCount() {
        return this.categories.size;
    }
}

// 主提取函数
async function extractCategories() {
    logger.info('启动政采云类目提取工具...');

    // 确保输出目录存在
    await fs.ensureDir(CONFIG.outputDir);

    // 启动浏览器
    const browser = await chromium.launch({
        headless: CONFIG.headless,
        slowMo: 100, // 放慢操作，更像人类
    });

    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();
    const store = new CategoryStore();

    try {
        // 步骤1：导航到登录页面
        logger.info('步骤 1/5: 打开政采云登录页面...');
        await page.goto(CONFIG.loginUrl, { waitUntil: 'networkidle', timeout: CONFIG.timeout.navigation });

        logger.warn('请在浏览器中完成登录操作...');
        logger.warn('登录成功后，脚本会自动继续...');

        // 等待登录完成（检测URL变化或特定元素）
        await page.waitForFunction(() => {
            return window.location.hostname.includes('shop.zcygov.cn') ||
                document.querySelector('.user-info') !== null ||
                !window.location.pathname.includes('login');
        }, { timeout: 300000 }); // 5分钟超时

        logger.success('检测到登录成功！');
        await page.waitForTimeout(2000);

        // 步骤2：导航到商品发布页面
        logger.info('步骤 2/5: 导航到商品发布页面...');

        // 尝试多个可能的URL
        const possibleUrls = [
            'https://shop.zcygov.cn/goods/publish',
            'https://shop.zcygov.cn/product/publish',
            'https://shop.zcygov.cn/item/publish',
            'https://seller.zcygov.cn/goods/publish'
        ];

        let navigated = false;
        for (const url of possibleUrls) {
            try {
                logger.debug(`尝试访问: ${url}`);
                await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
                navigated = true;
                logger.success(`成功访问: ${url}`);
                break;
            } catch (e) {
                logger.debug(`无法访问: ${url}`);
            }
        }

        if (!navigated) {
            throw new Error('无法找到商品发布页面！请手动导航到该页面...');
        }

        await page.waitForTimeout(3000);

        // 步骤3：查找并点击类目选择器
        logger.info('步骤 3/5: 查找类目选择器...');

        const categorySelectors = [
            'button:has-text("选择类目")',
            'button:has-text("类目")',
            '.category-selector',
            '[class*="category-select"]',
            'input[placeholder*="类目"]',
            '.select-category',
            'text=请选择类目'
        ];

        let categoryButton = null;
        for (const selector of categorySelectors) {
            try {
                categoryButton = await page.waitForSelector(selector, { timeout: 5000 });
                if (categoryButton) {
                    logger.success(`找到类目选择器: ${selector}`);
                    break;
                }
            } catch (e) {
                logger.debug(`未找到选择器: ${selector}`);
            }
        }

        if (categoryButton) {
            await categoryButton.click();
            logger.success('点击类目选择器');
            await page.waitForTimeout(2000);
        } else {
            logger.warn('未找到类目选择按钮，假设类目已显示');
        }

        // 步骤4：提取类目数据
        logger.info('步骤 4/5: 提取类目数据...');

        // 方法A：尝试点击"展开全部"按钮
        try {
            const expandAllBtn = await page.waitForSelector('button:has-text("展开"), button:has-text("全部展开"), .expand-all', { timeout: 3000 });
            if (expandAllBtn) {
                await expandAllBtn.click();
                logger.success('点击"展开全部"');
                await page.waitForTimeout(3000);
            }
        } catch (e) {
            logger.debug('未找到"展开全部"按钮，将手动展开');
        }

        // 方法B：从DOM提取类目
        const categories = await page.evaluate(() => {
            const results = [];

            // 尝试多种选择器
            const possibleSelectors = [
                '.category-item',
                '[class*="category"]',
                '.tree-node',
                '[class*="tree-node"]',
                '.ant-tree-treenode',
                'li[role="treeitem"]',
                '[data-category-code]',
                '[data-category-id]'
            ];

            let elements = [];
            for (const selector of possibleSelectors) {
                elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    console.log(`使用选择器: ${selector}，找到 ${elements.length} 个元素`);
                    break;
                }
            }

            elements.forEach(el => {
                // 提取类目信息
                const text = el.innerText || el.textContent || '';
                const code = el.getAttribute('data-code') ||
                    el.getAttribute('data-category-code') ||
                    el.getAttribute('data-id') ||
                    el.getAttribute('data-key');
                const name = text.split('\n')[0].trim();
                const level = el.getAttribute('data-level') ||
                    (el.getAttribute('class').match(/level-(\d+)/) || [])[1] ||
                    '1';

                if (name && name.length < 100) { // 过滤掉太长的文本
                    results.push({
                        code: code || name,
                        name: name,
                        level: parseInt(level) || 1,
                        parentCode: el.getAttribute('data-parent') || null,
                        fullPath: el.getAttribute('data-path') || null
                    });
                }
            });

            return results;
        });

        logger.info(`从DOM提取到 ${categories.length} 个类目`);
        categories.forEach(cat => store.add(cat));

        // 方法C：监听网络请求
        logger.info('监听类目API请求...');

        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('category') || url.includes('cate')) {
                try {
                    const data = await response.json();
                    const list = data.result || data.data || data.list || [];

                    if (Array.isArray(list)) {
                        list.forEach(item => {
                            if (item && item.name) {
                                store.add({
                                    code: item.code || item.categoryCode || item.id,
                                    name: item.name || item.categoryName,
                                    level: item.level || 1,
                                    parentCode: item.parentCode || item.parentId || item.pid,
                                    id: item.id
                                });
                            }
                        });
                        logger.success(`从API捕获 ${list.length} 个类目`);
                    }
                } catch (e) {
                    logger.debug('响应不是JSON或解析失败');
                }
            }
        });

        // 尝试触发更多类目加载
        logger.info('尝试展开一级类目...');
        const expandButtons = await page.$$('button[class*="expand"], .switcher, [class*="switcher"]');
        logger.info(`找到 ${expandButtons.length} 个展开按钮`);

        for (let i = 0; i < Math.min(expandButtons.length, 50); i++) {
            try {
                await expandButtons[i].click();
                await page.waitForTimeout(CONFIG.timeout.expandDelay);
                logger.debug(`展开第 ${i + 1} 个类目`);
            } catch (e) {
                logger.debug(`无法点击第 ${i + 1} 个展开按钮`);
            }
        }

        await page.waitForTimeout(3000);

        // 再次提取
        const moreCategories = await page.evaluate(() => {
            const results = [];
            const elements = document.querySelectorAll('[class*="category"], [class*="tree"]');

            elements.forEach(el => {
                const text = (el.innerText || el.textContent || '').trim();
                const code = el.getAttribute('data-code') || el.getAttribute('data-id');

                if (text && text.length > 0 && text.length < 100 && !text.includes('\n\n')) {
                    results.push({
                        code: code || text,
                        name: text.split('\n')[0],
                        level: 1
                    });
                }
            });

            return results;
        });

        logger.info(`再次提取到 ${moreCategories.length} 个类目`);
        moreCategories.forEach(cat => store.add(cat));

        // 步骤5：保存数据
        logger.info('步骤 5/5: 保存数据...');

        const allCategories = store.getAll();
        const tree = store.buildTree();

        logger.success(`共提取 ${allCategories.size} 个唯一类目`);

        // 保存为JSON（扁平列表）
        await fs.writeJSON(
            path.join(CONFIG.outputDir, 'categories_flat.json'),
            allCategories,
            { spaces: 2 }
        );

        // 保存为JSON（树形结构）
        await fs.writeJSON(
            path.join(CONFIG.outputDir, 'categories_tree.json'),
            tree,
            { spaces: 2 }
        );

        // 保存为TXT
        let txt = 'ID\t类目编码\t类目名称\t层级\t父级编码\n';
        txt += '='.repeat(100) + '\n';
        allCategories.forEach((cat, index) => {
            txt += `${index + 1}\t${cat.code || 'N/A'}\t${cat.name}\t${cat.level || 'N/A'}\t${cat.parentCode || 'N/A'}\n`;
        });
        await fs.writeFile(
            path.join(CONFIG.outputDir, 'categories.txt'),
            txt,
            'utf-8'
        );

        // 保存为CSV
        let csv = 'ID,类目编码,类目名称,层级,父级编码\n';
        allCategories.forEach((cat, index) => {
            csv += `${index + 1},"${cat.code || ''}","${cat.name}",${cat.level || 1},"${cat.parentCode || ''}"\n`;
        });
        await fs.writeFile(
            path.join(CONFIG.outputDir, 'categories.csv'),
            csv,
            'utf-8'
        );

        logger.success('✅ 数据保存完成！');
        logger.info(`📁 输出目录: ${path.resolve(CONFIG.outputDir)}`);
        logger.info(`📊 文件列表:`);
        logger.info(`   - categories_flat.json (扁平列表)`);
        logger.info(`   - categories_tree.json (树形结构)`);
        logger.info(`   - categories.txt (制表符分隔)`);
        logger.info(`   - categories.csv (CSV格式)`);

    } catch (error) {
        logger.error(`提取失败: ${error.message}`);
        logger.debug(error.stack);

        // 保存错误截图
        await page.screenshot({
            path: path.join(CONFIG.outputDir, 'error_screenshot.png'),
            fullPage: true
        });
        logger.info(`错误截图已保存到: error_screenshot.png`);

    } finally {
        if (!CONFIG.debug) {
            await browser.close();
        } else {
            logger.warn('调试模式：浏览器保持打开，按Ctrl+C退出');
        }
    }
}

// 运行
if (require.main === module) {
    extractCategories()
        .then(() => {
            logger.success('🎉 提取完成！');
            process.exit(0);
        })
        .catch((error) => {
            logger.error(`🚨 程序异常: ${error.message}`);
            process.exit(1);
        });
}

module.exports = { extractCategories };
