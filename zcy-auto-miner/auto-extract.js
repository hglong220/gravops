/**
 * 全自动提取 - 连接已登录的浏览器
 * 不需要任何手动操作！
 */

const { chromium } = require('playwright');
const fs = require('fs-extra');

async function autoExtract() {
    console.log('🚀 启动全自动提取模式...');
    console.log('💤 你可以休息了，我来自动操作！\n');

    // 连接到已打开的Chrome（调试端口9222）
    let browser, page;

    try {
        browser = await chromium.connectOverCDP('http://localhost:9222');
        const contexts = browser.contexts();
        page = contexts[0].pages()[0] || await contexts[0].newPage();

        console.log('✅ 已连接到你的Chrome浏览器');
    } catch (e) {
        await page.waitForTimeout(3000);
        console.log('✅ 成功\n');
        break;
    } catch (e) {
        console.log('❌ 失败，尝试下一个...\n');
    }
}

console.log('🔍 查找类目筛选器...\n');

// 查找类目筛选/选择器
const selectors = [
    '[class*="category"]',
    '[class*="classification"]',
    'text=类目',
    'text=分类'
];

let categoryElement = null;
for (const selector of selectors) {
    try {
        categoryElement = await page.waitForSelector(selector, { timeout: 5000 });
        if (categoryElement) {
            console.log(`✅ 找到类目元素\n`);
            await categoryElement.click();
            await page.waitForTimeout(2000);
            break;
        }
    } catch (e) { }
}

console.log('🤖 开始递归点击所有类目...\n');

// 查找所有可点击的类目元素
const clickableSelectors = [
    '.category-item',
    '[class*="category-"]',
    'li[data-level]',
    '[role="menuitem"]',
    'a[href*="category"]'
];

let totalClicks = 0;

for (const selector of clickableSelectors) {
    const elements = await page.$$(selector);

    if (elements.length > 0) {
        console.log(`📌 找到 ${elements.length} 个类目元素\n`);

        for (let i = 0; i < Math.min(elements.length, 100); i++) {
            try {
                const el = elements[i];
                const text = await el.innerText();

                if (text && text.length < 50) {
                    console.log(`👆 [${i + 1}/${elements.length}] 点击: ${text.substring(0, 20)}`);

                    await el.click({ force: true });
                    await page.waitForTimeout(1500);
                    totalClicks++;

                    // 尝试展开子类
                    const expandBtns = await page.$$('.expand, [class*="expand"], .arrow');
                    for (let j = 0; j < Math.min(expandBtns.length, 10); j++) {
                        try {
                            await expandBtns[j].click();
                            await page.waitForTimeout(500);
                        } catch (e) { }
                    }
                }
            } catch (e) {
                console.log(`  ⚠️  跳过`);
            }
        }

        break;
    }
}

console.log(`\n✅ 自动点击完成！共点击 ${totalClicks} 次\n`);
console.log('⏰ 等待5秒，确保数据加载完成...\n');
await page.waitForTimeout(5000);

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
        source: 'Playwright全自动提取',
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

if (!browser.isConnected()) {
    await browser.close();
}

console.log('\n✅ 全部完成！你可以去休息了！😴\n');
}

// 运行
autoExtract().catch(err => {
    console.error('❌ 出错:', err.message);
    console.log('\n💡 建议：直接使用你现有的316个类目数据');
});
