/**
 * 超级完整版 - 支持1-2-3-4-5级类目
 * 专门用于提取深层次类目
 * 2小时超长监听
 */

const { chromium } = require('playwright');
const fs = require('fs-extra');

async function superComplete() {
    console.log('🎯 超级完整版提取模式');
    console.log('📊 支持1-2-3-4-5级类目');
    console.log('⏰ 2小时超长监听\n');

    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    const allData = new Map();

    // 超强API监听
    page.on('response', async (response) => {
        try {
            const url = response.url();

            // 捕获所有可能的类目API
            if (url.includes('category') || url.includes('cate') ||
                url.includes('attr') || url.includes('goods') ||
                url.includes('class') || url.includes('type')) {

                const contentType = response.headers()['content-type'] || '';
                if (!contentType.includes('json')) return;

                const data = await response.json();

                // 深度提取
                const extractList = (obj, depth = 0) => {
                    if (depth > 10) return []; // 防止无限递归

                    if (Array.isArray(obj)) return obj;
                    if (obj.result) return extractList(obj.result, depth + 1);
                    if (obj.data) return extractList(obj.data, depth + 1);
                    if (obj.list) return obj.list;
                    if (obj.rows) return obj.rows;
                    if (obj.items) return obj.items;
                    if (obj.categories) return obj.categories;

                    return [];
                };

                const list = extractList(data);

                if (Array.isArray(list) && list.length > 0) {
                    list.forEach(item => {
                        if (item?.id && item?.name) {
                            const existing = allData.get(item.id);

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
                }
            }
        } catch (e) { }
    });

    await page.goto('https://www.zcygov.cn/goods-center/goods/category/attr/select');
    console.log('⏰ 等15秒登录...\n');
    await page.waitForTimeout(15000);

    console.log('='.repeat(80));
    console.log('💡 超级完整提取指南：');
    console.log('');
    console.log('   📌 重点：提取4级和5级类目');
    console.log('');
    console.log('   操作步骤：');
    console.log('   1. 选择一级类目');
    console.log('   2. 选择二级类目');
    console.log('   3. 选择三级类目');
    console.log('   4. ⭐ 看看有没有四级输入框，如果有就点击');
    console.log('   5. ⭐ 看看有没有五级输入框，如果有就点击');
    console.log('   6. 重复以上步骤，尽量多点不同组合');
    console.log('');
    console.log('   💡 提示：');
    console.log('   - 脚本会自动识别4级和5级');
    console.log('   - 只要API返回就会被捕获');
    console.log('   - 实时显示各层级数量');
    console.log('');
    console.log('⏰ 监听时间: 120分钟（2小时）');
    console.log('📊 每5秒检查一次，实时显示进度');
    console.log('='.repeat(80));
    console.log('');

    const startTime = Date.now();
    const duration = 120 * 60 * 1000; // 120分钟
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

            const l1 = arr.filter(c => c.level === 1).length;
            const l2 = arr.filter(c => c.level === 2).length;
            const l3 = arr.filter(c => c.level === 3).length;
            const l4 = arr.filter(c => c.level === 4).length;
            const l5 = arr.filter(c => c.level === 5).length;

            const elapsed = Math.floor((Date.now() - startTime) / 60000);
            const remaining = 120 - elapsed;

            let levelInfo = `L1:${l1} L2:${l2} L3:${l3}`;
            if (l4 > 0) levelInfo += ` L4:${l4}`;
            if (l5 > 0) levelInfo += ` ⭐L5:${l5}`;

            console.log(`📦 [+${diff}] 总: ${currentCount} (${levelInfo}) | ⏰ ${remaining}分 | #${updateCounter}`);
        }

        // 每20分钟提示一次
        const elapsed = Date.now() - startTime;
        if (elapsed % (20 * 60 * 1000) < 5000 && elapsed > 5000) {
            const minutes = Math.floor(elapsed / 60000);

            const arr = Array.from(allData.values());
            arr.forEach(cat => {
                if (!cat.parentId) cat.level = 1;
                else {
                    const parent = arr.find(c => c.id === cat.parentId);
                    if (parent) cat.level = (parent.level || 1) + 1;
                }
            });

            const l4 = arr.filter(c => c.level === 4).length;
            const l5 = arr.filter(c => c.level === 5).length;

            console.log(`\n⏱️  已运行 ${minutes} 分钟 | 总: ${allData.size} | ⭐ L4:${l4} L5:${l5}\n`);
        }
    }

    console.log('\n⏰ 2小时完成！处理并保存数据...\n');

    const arr = Array.from(allData.values());

    // 最终智能推断层级
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
    const level5 = arr.filter(c => c.level === 5);

    // 构建完整树（支持5级）
    const tree = level1.map(cat1 => ({
        ...cat1,
        children: level2.filter(c => c.parentId === cat1.id).map(cat2 => ({
            ...cat2,
            children: level3.filter(c => c.parentId === cat2.id).map(cat3 => ({
                ...cat3,
                children: level4.filter(c => c.parentId === cat3.id).map(cat4 => ({
                    ...cat4,
                    children: level5.filter(c => c.parentId === cat4.id)
                }))
            }))
        }))
    }));

    const output = {
        meta: {
            source: '2小时超级完整提取（支持1-5级）',
            extractedAt: new Date().toISOString(),
            totalCategories: arr.length,
            level1Count: level1.length,
            level2Count: level2.length,
            level3Count: level3.length,
            level4Count: level4.length,
            level5Count: level5.length,
            updateCount: updateCounter,
            note: '完整的1-2-3-4-5级类目数据'
        },
        categories: tree
    };

    await fs.ensureDir('./output');
    await fs.writeJSON('./output/zcy_super_complete.json', output, { spaces: 2 });

    console.log('='.repeat(80));
    console.log('🎉 超级完整提取完成！');
    console.log('');
    console.log('📊 最终统计:');
    console.log(`   ✅ 总计: ${arr.length} 个类目`);
    console.log(`   ✅ 一级: ${level1.length} 个`);
    console.log(`   ✅ 二级: ${level2.length} 个`);
    console.log(`   ✅ 三级: ${level3.length} 个`);
    console.log(`   ✅ 四级: ${level4.length} 个 ${level4.length > 0 ? '⭐' : ''}`);
    console.log(`   ✅ 五级: ${level5.length} 个 ${level5.length > 0 ? '⭐⭐' : ''}`);
    console.log('');
    console.log(`   🔄 数据更新次数: ${updateCounter}`);
    console.log('');
    console.log('📁 保存位置:');
    console.log('   ./output/zcy_super_complete.json');
    console.log('='.repeat(80));

    await page.waitForTimeout(3000);
    await browser.close();

    console.log('\n✅ 全部完成！这是最完整的数据了！\n');
}

superComplete().catch(err => {
    console.error('❌ 错误:', err.message);
});
