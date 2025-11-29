/**
 * 简化但可靠的提取脚本
 * 基于截图的实际DOM结构
 */

const { chromium } = require('playwright');
const fs = require('fs-extra');

async function simpleButComplete() {
    console.log('🎯 简化全自动提取');
    console.log('📱 基于实际DOM结构\n');

    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    const allData = new Map();

    // API监听
    page.on('response', async (response) => {
        try {
            if (response.url().includes('category') || response.url().includes('cate')) {
                const data = await response.json();
                const list = data.result || data.data || data.list || [];

                if (Array.isArray(list)) {
                    list.forEach(item => {
                        if (item?.id && item?.name) {
                            allData.set(item.id, {
                                id: item.id,
                                categoryCode: item.code || item.id.toString(),
                                name: item.name,
                                level: item.level || 1,
                                parentId: item.parentId || null,
                                hasChildren: item.hasChildren || false,
                                hasSpu: item.hasSpu || false
                            });
                        }
                    });
                }
            }
        } catch (e) { }
    });

    await page.goto('https://www.zcygov.cn/goods-center/goods/category/attr/select');
    console.log('⏰ 等15秒登录...\n');
    await page.waitForTimeout(15000);

    console.log('🔍 查找类目区域...\n');

    // 等待页面稳定
    await page.waitForTimeout(3000);

    // 简单策略：每隔一段时间检查数据更新
    console.log('💡 请在浏览器中手动操作：');
    console.log('   1. 点击一级类目');
    console.log('   2. 点击二级类目');
    console.log('   3. 点击三级类目');
    console.log('   4. 尽量多点击不同的组合\n');
    console.log('⏰ 监听30分钟，你有充足时间！\n');
    console.log('='.repeat(70));

    const startTime = Date.now();
    const duration = 30 * 60 * 1000; // 30分钟
    let lastCount = 0;

    while (Date.now() - startTime < duration) {
        await page.waitForTimeout(5000);

        const currentCount = allData.size;
        if (currentCount > lastCount) {
            const diff = currentCount - lastCount;
            lastCount = currentCount;

            const arr = Array.from(allData.values());
            const l1 = arr.filter(c => c.level === 1).length;
            const l2 = arr.filter(c => c.level === 2).length;
            const l3 = arr.filter(c => c.level === 3).length;

            const elapsed = Math.floor((Date.now() - startTime) / 60000);
            const remaining = 30 - elapsed;

            console.log(`📦 [+${diff}] 总: ${currentCount} (L1:${l1} L2:${l2} L3:${l3}) | ⏰ 剩余: ${remaining}分钟`);
        }
    }

    console.log('\n⏰ 时间到！保存数据...\n');

    const arr = Array.from(allData.values());
    arr.forEach(cat => {
        if (!cat.parentId) cat.level = 1;
        else {
            const parent = arr.find(c => c.id === cat.parentId);
            if (parent) cat.level = (parent.level || 1) + 1;
        }
    });

    const level1 = arr.filter(c => c.level === 1);
    const level2 = arr.filter(c => c.level === 2);
    const level3 = arr.filter(c => c.level === 3);

    const tree = level1.map(cat1 => ({
        ...cat1,
        children: level2.filter(c => c.parentId === cat1.id).map(cat2 => ({
            ...cat2,
            children: level3.filter(c => c.parentId === cat2.id)
        }))
    }));

    const output = {
        meta: {
            source: '30分钟手动提取',
            extractedAt: new Date().toISOString(),
            totalCategories: arr.length,
            level1Count: level1.length,
            level2Count: level2.length,
            level3Count: level3.length
        },
        categories: tree
    };

    await fs.ensureDir('./output');
    await fs.writeJSON('./output/zcy_30min_manual.json', output, { spaces: 2 });

    console.log('='.repeat(70));
    console.log('🎉 完成！');
    console.log(`📊 总计: ${arr.length} | L1:${level1.length} L2:${level2.length} L3:${level3.length}`);
    console.log('📁 ./output/zcy_30min_manual.json');
    console.log('='.repeat(70));

    await browser.close();
}

simpleButComplete().catch(console.error);
