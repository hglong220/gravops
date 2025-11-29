/**
 * 1小时超长监听版
 * 给你充足时间提取更多类目
 */

const { chromium } = require('playwright');
const fs = require('fs-extra');

async function oneHourExtract() {
    console.log('🎯 1小时超长监听模式');
    console.log('⏰ 你有充足时间提取尽可能多的类目！\n');

    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    const allData = new Map();

    // API监听
    page.on('response', async (response) => {
        try {
            if (response.url().includes('category') || response.url().includes('cate') || response.url().includes('attr')) {
                const data = await response.json();
                const list = data.result || data.data || data.list || data.rows || [];

                if (Array.isArray(list)) {
                    list.forEach(item => {
                        if (item?.id && item?.name) {
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
                }
            }
        } catch (e) { }
    });

    await page.goto('https://www.zcygov.cn/goods-center/goods/category/attr/select');
    console.log('⏰ 等15秒登录...\n');
    await page.waitForTimeout(15000);

    console.log('='.repeat(80));
    console.log('💡 操作指南：');
    console.log('   1. 在浏览器中逐个点击一级类目');
    console.log('   2. 展开二级类目');
    console.log('   3. 展开三级类目');
    console.log('   4. 尽量点击更多不同的组合');
    console.log('');
    console.log('⏰ 监听时间: 60分钟（1小时）');
    console.log('💾 每5秒自动检查并显示进度');
    console.log('📊 完成后自动保存到 output/zcy_1hour_manual.json');
    console.log('='.repeat(80));
    console.log('');

    const startTime = Date.now();
    const duration = 60 * 60 * 1000; // 60分钟
    let lastCount = 0;
    let updateCounter = 0;

    while (Date.now() - startTime < duration) {
        await page.waitForTimeout(5000);

        const currentCount = allData.size;
        if (currentCount > lastCount) {
            const diff = currentCount - lastCount;
            lastCount = currentCount;
            updateCounter++;

            const arr = Array.from(allData.values());
            const l1 = arr.filter(c => c.level === 1).length;
            const l2 = arr.filter(c => c.level === 2).length;
            const l3 = arr.filter(c => c.level === 3).length;

            const elapsed = Math.floor((Date.now() - startTime) / 60000);
            const remaining = 60 - elapsed;

            console.log(`📦 [+${diff}] 总: ${currentCount} (L1:${l1} L2:${l2} L3:${l3}) | ⏰ ${remaining}分钟 | #${updateCounter}`);
        }

        // 每10分钟提示一次
        const elapsed = Date.now() - startTime;
        if (elapsed % (10 * 60 * 1000) < 5000 && elapsed > 5000) {
            const minutes = Math.floor(elapsed / 60000);
            console.log(`\n⏱️  已运行 ${minutes} 分钟 | 当前: ${allData.size} 个类目\n`);
        }
    }

    console.log('\n⏰ 1小时完成！开始保存数据...\n');

    const arr = Array.from(allData.values());

    // 智能推断层级
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
    const level4 = arr.filter(c => c.level === 4);

    // 构建树
    const tree = level1.map(cat1 => ({
        ...cat1,
        children: level2.filter(c => c.parentId === cat1.id).map(cat2 => ({
            ...cat2,
            children: level3.filter(c => c.parentId === cat2.id).map(cat3 => ({
                ...cat3,
                children: level4.filter(c => c.parentId === cat3.id)
            }))
        }))
    }));

    const output = {
        meta: {
            source: '1小时手动提取',
            extractedAt: new Date().toISOString(),
            totalCategories: arr.length,
            level1Count: level1.length,
            level2Count: level2.length,
            level3Count: level3.length,
            level4Count: level4.length,
            updateCount: updateCounter,
            note: '1小时持续监听收集的完整数据'
        },
        categories: tree
    };

    await fs.ensureDir('./output');
    await fs.writeJSON('./output/zcy_1hour_manual.json', output, { spaces: 2 });

    console.log('='.repeat(80));
    console.log('🎉 1小时提取完成！');
    console.log('');
    console.log('📊 最终统计:');
    console.log(`   ✅ 总计: ${arr.length} 个类目`);
    console.log(`   ✅ 一级: ${level1.length} 个`);
    console.log(`   ✅ 二级: ${level2.length} 个`);
    console.log(`   ✅ 三级: ${level3.length} 个`);
    if (level4.length > 0) {
        console.log(`   ✅ 四级: ${level4.length} 个`);
    }
    console.log('');
    console.log(`   🔄 数据更新次数: ${updateCounter}`);
    console.log('');
    console.log('📁 保存位置:');
    console.log('   ./output/zcy_1hour_manual.json');
    console.log('='.repeat(80));

    await page.waitForTimeout(3000);
    await browser.close();

    console.log('\n✅ 全部完成！\n');
}

oneHourExtract().catch(err => {
    console.error('❌ 错误:', err.message);
});
