/**
 * 全自动提取 - 使用正确的URL
 * https://www.zcygov.cn/goods-center/goods/category/attr/select
 */

const { chromium } = require('playwright');
const fs = require('fs-extra');

async function autoExtract() {
    console.log('🚀 启动全自动提取模式...');
    console.log('💤 你可以休息了，我来自动操作！\n');

    const browser = await chromium.launch({
        headless: false,
        slowMo: 100
    });

    const page = await browser.newPage();

    console.log('🔐 正在打开政采云，请登录...');
    console.log('⏰ 等待20秒让你登录...\n');

    await page.goto('https://www.zcygov.cn/goods-center/goods/category/attr/select');
    await page.waitForTimeout(20000);

    const allData = new Map();

    // 监听所有API
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('category') || url.includes('cate') || url.includes('attr')) {
            try {
                const data = await response.json();
                const list = data.result || data.data || data.list || data.rows || [];

                if (Array.isArray(list)) {
                    list.forEach(item => {
                        if (item && item.id && item.name) {
                            allData.set(item.id, {
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
                    console.log(`📦 收集中... 目前: ${allData.size} 个类目`);
                }
            } catch (e) { }
        }
    });

    console.log('\n🤖 开始自动操作...\n');
    console.log('⏰ 等待页面加载...\n');
    await page.waitForTimeout(5000);

    console.log('🔍 查找并点击所有类目元素...\n');

    // 查找所有可点击的类目
    const clickableSelectors = [
        '.category-item',
        '[class*="category"]',
        'li',
        '[role="menuitem"]',
        'button',
        'a'
    ];

    let totalClicks = 0;

    for (const selector of clickableSelectors) {
        const elements = await page.$$(selector);

        if (elements.length > 0) {
            console.log(`📌 找到 ${elements.length} 个元素 (${selector})\n`);

            for (let i = 0; i < Math.min(elements.length, 200); i++) {
                try {
                    const el = elements[i];
                    const text = await el.innerText().catch(() => '');

                    if (text && text.length > 0 && text.length < 100) {
                        console.log(`👆 [${i + 1}] 点击: ${text.substring(0, 30)}`);

                        await el.click({ force: true }).catch(() => { });
                        await page.waitForTimeout(800);
                        totalClicks++;

                        // 尝试展开
                        const expandBtns = await page.$$('[class*="expand"], .arrow, [class*="icon"]');
                        for (let j = 0; j < Math.min(expandBtns.length, 5); j++) {
                            try {
                                await expandBtns[j].click();
                                await page.waitForTimeout(300);
                            } catch (e) { }
                        }
                    }
                } catch (e) { }

                if (i % 20 === 0) {
                    await page.waitForTimeout(2000);
                }
            }

            break;
        }
    }

    console.log(`\n✅ 自动点击完成！共点击 ${totalClicks} 次\n`);
    console.log('⏰ 等待10秒，确保所有数据加载...\n');
    await page.waitForTimeout(10000);

    // 保存数据
    console.log('💾 保存数据...\n');

    const arr = Array.from(allData.values());
    const level1 = arr.filter(c => c.level === 1);
    const level2 = arr.filter(c => c.level === 2);
    const level3 = arr.filter(c => c.level === 3);

    // 构建树
    const tree = level1.map(cat1 => ({
        ...cat1,
        children: level2.filter(c => c.parentId === cat1.id).map(cat2 => ({
            ...cat2,
            children: level3.filter(c => c.parentId === cat2.id)
        }))
    }));

    const output = {
        meta: {
            source: 'Playwright全自动提取 (正确URL)',
            url: 'https://www.zcygov.cn/goods-center/goods/category/attr/select',
            extractedAt: new Date().toISOString(),
            totalCategories: arr.length,
            level1Count: level1.length,
            level2Count: level2.length,
            level3Count: level3.length,
            totalClicks: totalClicks
        },
        categories: tree
    };

    await fs.ensureDir('./output');
    await fs.writeJSON('./output/zcy_auto_extracted.json', output, { spaces: 2 });

    console.log('='.repeat(60));
    console.log('🎉 自动提取完成！');
    console.log('');
    console.log('📊 统计:');
    console.log(`   总计: ${arr.length} 个类目`);
    console.log(`   一级: ${level1.length}`);
    console.log(`   二级: ${level2.length}`);
    console.log(`   三级: ${level3.length}`);
    console.log('');
    console.log('📁 保存位置:');
    console.log('   ./output/zcy_auto_extracted.json');
    console.log('='.repeat(60));

    await page.waitForTimeout(3000);
    await browser.close();

    console.log('\n✅ 全部完成！😴\n');
}

// 运行
autoExtract().catch(err => {
    console.error('❌ 出错:', err.message);
});
