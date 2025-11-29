/**
 * 政采云深度提取脚本 - 获取完整的二三级类目
 * 使用Playwright自动化
 */

const { chromium } = require('playwright');
const fs = require('fs-extra');

async function extractFullCategories() {
    console.log('🚀 启动深度提取...');

    const browser = await chromium.launch({
        headless: false,  // 显示浏览器，方便你登录
        slowMo: 100
    });

    const page = await browser.newPage();
    const allCategories = new Map();

    // 监听所有API响应
    page.on('response', async (response) => {
        const url = response.url();

        if (url.includes('category') || url.includes('cate')) {
            try {
                const data = await response.json();
                const list = data.result || data.data || data.list || [];

                if (Array.isArray(list)) {
                    list.forEach(item => {
                        if (item && item.id && item.name) {
                            allCategories.set(item.id, {
                                id: item.id,
                                categoryCode: item.code || item.categoryCode || item.id.toString(),
                                name: item.name,
                                level: item.level || 1,
                                parentId: item.parentId || item.pid || null,
                                hasChildren: item.hasChildren || false,
                                hasSpu: item.hasSpu || false
                            });
                        }
                    });

                    console.log(`📦 捕获 ${list.length} 个类目，总计: ${allCategories.size}`);
                }
            } catch (e) { }
        }
    });

    // 步骤1：打开登录页并等待登录
    console.log('步骤1: 请在浏览器中登录政采云...');
    await page.goto('https://shop.zcygov.cn');

    console.log('⏳ 等待登录完成（检测到登录后会自动继续）...');
    await page.waitForTimeout(5000);

    // 检测登录状态
    try {
        await page.waitForSelector('.user-info, [class*="user"]', { timeout: 120000 });
        console.log('✅ 检测到登录成功！');
    } catch (e) {
        console.log('⚠️  未检测到登录，继续尝试...');
    }

    // 步骤2：进入商品发布页面
    console.log('步骤2: 导航到商品发布页面...');

    const publishUrls = [
        'https://shop.zcygov.cn/goods/publish',
        'https://shop.zcygov.cn/product/add',
        'https://shop.zcygov.cn/item/publish'
    ];

    let navigated = false;
    for (const url of publishUrls) {
        try {
            await page.goto(url, { timeout: 10000 });
            navigated = true;
            console.log(`✅ 访问: ${url}`);
            break;
        } catch (e) {
            console.log(`❌ 无法访问: ${url}`);
        }
    }

    if (!navigated) {
        console.log('⚠️  无法自动导航，请手动进入发布商品页面');
        console.log('💡 按任意键继续...');
        await page.pause();  // 暂停，让用户手动操作
    }

    await page.waitForTimeout(3000);

    // 步骤3：点击类目选择器
    console.log('步骤3: 查找类目选择器...');

    const categorySelectors = [
        'text=选择类目',
        'text=类目',
        '[placeholder*="类目"]',
        '.category-selector'
    ];

    for (const selector of categorySelectors) {
        try {
            await page.click(selector, { timeout: 5000 });
            console.log(`✅ 点击类目选择器: ${selector}`);
            await page.waitForTimeout(2000);
            break;
        } catch (e) { }
    }

    // 步骤4：递归展开所有类目
    console.log('步骤4: 递归展开所有类目...');

    // 查找所有一级类目
    const level1Items = await page.$$('.category-item, [class*="category"], li[data-level="1"]');
    console.log(`找到 ${level1Items.length} 个一级类目`);

    for (let i = 0; i < level1Items.length; i++) {
        try {
            const item = level1Items[i];
            const name = await item.innerText();
            console.log(`\n[${i + 1}/${level1Items.length}] 展开: ${name}`);

            // 点击一级类目
            await item.click();
            await page.waitForTimeout(1500);

            // 查找展开按钮
            const expandButtons = await page.$$('.expand-btn, [class*="expand"], .switcher');
            console.log(`  找到 ${expandButtons.length} 个展开按钮`);

            // 点击所有展开按钮（展开二级）
            for (let j = 0; j < Math.min(expandButtons.length, 20); j++) {
                try {
                    await expandButtons[j].click();
                    await page.waitForTimeout(500);
                } catch (e) { }
            }

            await page.waitForTimeout(2000);

            // 再次查找并展开三级
            const expandButtons2 = await page.$$('.expand-btn, [class*="expand"]');
            for (let k = 0; k < Math.min(expandButtons2.length, 50); k++) {
                try {
                    await expandButtons2[k].click();
                    await page.waitForTimeout(300);
                } catch (e) { }
            }

            await page.waitForTimeout(1000);

        } catch (e) {
            console.log(`  ⚠️  跳过`);
        }
    }

    console.log('\n✅ 展开完成！');
    await page.waitForTimeout(5000);  // 等待所有数据加载

    // 步骤5：保存数据
    console.log('步骤5: 保存数据...');

    const dataArray = Array.from(allCategories.values());
    const level1 = dataArray.filter(c => c.level === 1);

    // 构建树
    const tree = level1.map(cat1 => {
        const children2 = dataArray.filter(c => c.level === 2 && c.parentId === cat1.id);
        return {
            ...cat1,
            children: children2.map(cat2 => {
                const children3 = dataArray.filter(c => c.level === 3 && c.parentId === cat2.id);
                return {
                    ...cat2,
                    children: children3
                };
            })
        };
    });

    const output = {
        meta: {
            source: 'Playwright自动提取',
            extractedAt: new Date().toISOString(),
            totalCategories: dataArray.length,
            level1Count: level1.length,
            level2Count: dataArray.filter(c => c.level === 2).length,
            level3Count: dataArray.filter(c => c.level === 3).length
        },
        categories: tree
    };

    await fs.writeJSON('./output/zcy_categories_playwright.json', output, { spaces: 2 });

    console.log('\n='.repeat(50));
    console.log('✅ 提取完成！');
    console.log(`📊 总计: ${dataArray.length} 个类目`);
    console.log(`   一级: ${level1.length}`);
    console.log(`   二级: ${dataArray.filter(c => c.level === 2).length}`);
    console.log(`   三级: ${dataArray.filter(c => c.level === 3).length}`);
    console.log(`📁 已保存到: ./output/zcy_categories_playwright.json`);
    console.log('='.repeat(50));

    await browser.close();
}

// 运行
extractFullCategories().catch(console.error);
