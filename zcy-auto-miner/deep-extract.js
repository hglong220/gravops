/**
 * 深度递归提取 - 确保拿到完整的1-2-3级类目
 * 采用策略：浏览器自动化 + API拦截 + 递归展开
 */

const { chromium } = require('playwright');
const fs = require('fs-extra');

async function deepExtract() {
    console.log('🎯 深度递归提取模式');
    console.log('✅ 确保提取完整的1-2-3级类目\n');

    const browser = await chromium.launch({
        headless: false,
        slowMo: 50
    });

    const page = await browser.newPage();
    const allData = new Map();

    // 设置更长的超时
    page.setDefaultTimeout(60000);

    // 拦截所有网络请求
    page.on('response', async (response) => {
        const url = response.url();

        // 匹配类目相关的API
        if (url.includes('category') || url.includes('cate') || url.includes('goods') || url.includes('attr')) {
            try {
                const contentType = response.headers()['content-type'] || '';
                if (!contentType.includes('json')) return;

                const data = await response.json();

                // 多种数据格式兼容
                const extractList = (obj) => {
                    if (Array.isArray(obj)) return obj;
                    if (obj.result) return Array.isArray(obj.result) ? obj.result : extractList(obj.result);
                    if (obj.data) return Array.isArray(obj.data) ? obj.data : extractList(obj.data);
                    if (obj.list) return obj.list;
                    if (obj.rows) return obj.rows;
                    return [];
                };

                const list = extractList(data);

                if (list.length > 0) {
                    list.forEach(item => {
                        if (item && item.id && item.name) {
                            const existing = allData.get(item.id);

                            // 合并数据，优先保留更完整的信息
                            allData.set(item.id, {
                                id: item.id,
                                categoryCode: item.code || item.categoryCode || existing?.categoryCode || item.id.toString(),
                                name: item.name,
                                level: item.level || existing?.level || (item.parentId ? 2 : 1),
                                parentId: item.parentId || item.pid || existing?.parentId || null,
                                hasChildren: item.hasChildren || existing?.hasChildren || false,
                                hasSpu: item.hasSpu || existing?.hasSpu || false
                            });
                        }
                    });

                    console.log(`📦 API捕获 +${list.length} | 共: ${allData.size}`);
                }
            } catch (e) { }
        }
    });

    console.log('🌐 打开政采云页面...');
    await page.goto('https://www.zcygov.cn/goods-center/goods/category/attr/select');

    console.log('⏰ 等待15秒登录...\n');
    await page.waitForTimeout(15000);

    console.log('🤖 开始智能提取...\n');

    // 策略1：尝试找到类目树组件并递归展开
    console.log('📌 策略1: 查找类目树...');

    const treeSelectors = [
        '.category-tree',
        '[class*="tree"]',
        '.el-tree',
        '[role="tree"]'
    ];

    for (const selector of treeSelectors) {
        try {
            const tree = await page.$(selector);
            if (tree) {
                console.log(`✅ 找到类目树: ${selector}\n`);

                // 展开所有节点
                const expandIcons = await page.$$(`${selector} [class*="expand"], ${selector} .el-icon-caret-right, ${selector} .switcher`);
                console.log(`🔓 展开 ${expandIcons.length} 个节点...`);

                for (let i = 0; i < expandIcons.length; i++) {
                    try {
                        await expandIcons[i].click();
                        await page.waitForTimeout(500);

                        if (i % 10 === 0) {
                            console.log(`   进度: ${i}/${expandIcons.length}`);
                        }
                    } catch (e) { }
                }

                await page.waitForTimeout(3000);
                break;
            }
        } catch (e) { }
    }

    // 策略2：模拟用户点击每个类目
    console.log('\n📌 策略2: 逐个点击类目...');

    const categorySelectors = [
        '[data-level="1"]',
        '.category-item',
        '[class*="category-"]',
        'li[class*="item"]'
    ];

    for (const selector of categorySelectors) {
        const items = await page.$$(selector);

        if (items.length > 10) { // 至少要有10个以上才算有效
            console.log(`✅ 找到 ${items.length} 个类目项: ${selector}\n`);

            for (let i = 0; i < Math.min(items.length, 300); i++) {
                try {
                    const item = items[i];
                    const text = await item.innerText().catch(() => '');

                    if (text && text.length > 0 && text.length < 100) {
                        console.log(`👆 [${i + 1}/${items.length}] ${text.substring(0, 30)}`);

                        // 点击
                        await item.click().catch(() => { });
                        await page.waitForTimeout(1000);

                        // 查找并点击展开按钮
                        const expands = await page.$$('[class*="expand"], .arrow-icon, [class*="unfold"]');
                        for (const exp of expands.slice(0, 5)) {
                            try {
                                await exp.click();
                                await page.waitForTimeout(300);
                            } catch (e) { }
                        }

                        // 每10个暂停一下
                        if (i % 10 === 9) {
                            await page.waitForTimeout(2000);
                        }
                    }
                } catch (e) { }
            }

            break;
        }
    }

    console.log('\n⏰ 等待最后的数据加载...');
    await page.waitForTimeout(10000);

    // 保存数据
    console.log('\n💾 处理并保存数据...\n');

    const arr = Array.from(allData.values());

    // 智能推断层级（如果API没返回level字段）
    arr.forEach(cat => {
        if (!cat.parentId) {
            cat.level = 1;
        } else {
            const parent = arr.find(c => c.id === cat.parentId);
            if (parent) {
                cat.level = (parent.level || 1) + 1;
            }
        }
    });

    const level1 = arr.filter(c => c.level === 1);
    const level2 = arr.filter(c => c.level === 2);
    const level3 = arr.filter(c => c.level === 3);

    // 构建完整的树
    const tree = level1.map(cat1 => ({
        ...cat1,
        children: level2.filter(c => c.parentId === cat1.id).map(cat2 => ({
            ...cat2,
            children: level3.filter(c => c.parentId === cat2.id)
        }))
    }));

    const output = {
        meta: {
            source: '深度递归提取',
            url: 'https://www.zcygov.cn/goods-center/goods/category/attr/select',
            extractedAt: new Date().toISOString(),
            totalCategories: arr.length,
            level1Count: level1.length,
            level2Count: level2.length,
            level3Count: level3.length,
            note: '完整的1-2-3级类目树'
        },
        categories: tree
    };

    await fs.ensureDir('./output');
    await fs.writeJSON('./output/zcy_complete_categories.json', output, { spaces: 2 });

    console.log('='.repeat(70));
    console.log('🎉 深度提取完成！');
    console.log('');
    console.log('📊 完整统计:');
    console.log(`   ✅ 总计: ${arr.length} 个类目`);
    console.log(`   ✅ 一级: ${level1.length} 个`);
    console.log(`   ✅ 二级: ${level2.length} 个`);
    console.log(`   ✅ 三级: ${level3.length} 个`);
    console.log('');

    if (level2.length === 0) {
        console.log('⚠️  警告: 没有提取到二级类目！');
        console.log('💡 可能需要手动在页面上展开类目');
    }

    if (level3.length === 0) {
        console.log('⚠️  警告: 没有提取到三级类目！');
        console.log('💡 可能需要手动在页面上展开类目');
    }

    console.log('');
    console.log('📁 保存位置:');
    console.log('   ./output/zcy_complete_categories.json');
    console.log('='.repeat(70));

    await page.waitForTimeout(3000);
    await browser.close();

    console.log('\n✅ 全部完成！\n');
}

deepExtract().catch(err => {
    console.error('❌ 错误:', err.message);
    console.log('\n堆栈:', err.stack);
});
