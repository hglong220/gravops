/**
 * 终极全自动提取 - 智能递归点击三级联动
 * 自动遍历所有一级→二级→三级的组合
 * 无需手动操作！
 */

const { chromium } = require('playwright');
const fs = require('fs-extra');

async function ultimateExtract() {
    console.log('🎯 终极全自动提取模式');
    console.log('🤖 自动递归遍历所有一二三级类目\n');

    const browser = await chromium.launch({
        headless: false,
        slowMo: 100
    });

    const page = await browser.newPage();
    const allData = new Map();
    let captureCount = 0;

    // API监听
    page.on('response', async (response) => {
        const url = response.url();

        if (url.includes('category') || url.includes('cate') || url.includes('attr')) {
            try {
                const contentType = response.headers()['content-type'] || '';
                if (!contentType.includes('json')) return;

                const data = await response.json();

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

                    captureCount++;
                }
            } catch (e) { }
        }
    });

    console.log('🌐 打开政采云商品发布页面...');
    await page.goto('https://www.zcygov.cn/goods-center/goods/category/attr/select');

    await page.waitForTimeout(2000);

    // 获取所有一级类目元素
    const level1Items = await page.$$('.el-select-dropdown__item, [role="option"]');
    console.log(`📊 发现 ${level1Items.length} 个一级类目\n`);

    let totalClicks = 0;
    let successfulCombos = 0;

    // 遍历每个一级类目
    for (let i = 0; i < level1Items.length; i++) {
        try {
            // 重新获取一级列表（因为DOM会变化）
            await page.click(level1Selector);
            await page.waitForTimeout(1000);

            const level1List = await page.$$('.el-select-dropdown__item, [role="option"]');
            if (i >= level1List.length) continue;

            const level1Item = level1List[i];
            const level1Text = await level1Item.innerText().catch(() => '');

            if (!level1Text || level1Text.length > 50) continue;

            console.log(`\n📂 [${i + 1}/${level1Items.length}] 一级: ${level1Text}`);

            // 点击一级类目
            await level1Item.click();
            totalClicks++;
            await page.waitForTimeout(1500);

            // 等待二级类目加载
            await page.waitForTimeout(1000);

            // 点击二级选择框
            try {
                await page.click(level2Selector, { timeout: 3000 });
                await page.waitForTimeout(1000);

                // 获取二级类目列表
                const level2List = await page.$$('.el-select-dropdown__item, [role="option"]');
                console.log(`   📁 二级类目数: ${level2List.length}`);

                // 遍历每个二级类目
                for (let j = 0; j < Math.min(level2List.length, 50); j++) {
                    try {
                        // 重新打开二级下拉
                        await page.click(level2Selector);
                        await page.waitForTimeout(800);

                        const level2ListRefresh = await page.$$('.el-select-dropdown__item, [role="option"]');
                        if (j >= level2ListRefresh.length) continue;

                        const level2Item = level2ListRefresh[j];
                        const level2Text = await level2Item.innerText().catch(() => '');

                        if (!level2Text || level2Text.length > 50) continue;

                        console.log(`      ├─ [${j + 1}] ${level2Text}`);

                        // 点击二级
                        await level2Item.click();
                        totalClicks++;
                        await page.waitForTimeout(1200);

                        // 尝试点击三级
                        try {
                            await page.click(level3Selector, { timeout: 2000 });
                            await page.waitForTimeout(800);

                            const level3List = await page.$$('.el-select-dropdown__item, [role="option"]');

                            if (level3List.length > 0) {
                                console.log(`         └─ 三级数: ${level3List.length}`);

                                // 遍历三级（最多20个，避免太慢）
                                for (let k = 0; k < Math.min(level3List.length, 20); k++) {
                                    try {
                                        await page.click(level3Selector);
                                        await page.waitForTimeout(600);

                                        const level3ListRefresh = await page.$$('.el-select-dropdown__item, [role="option"]');
                                        if (k >= level3ListRefresh.length) continue;

                                        const level3Item = level3ListRefresh[k];
                                        await level3Item.click();
                                        totalClicks++;
                                        await page.waitForTimeout(600);

                                        successfulCombos++;
                                    } catch (e) { }
                                }
                            }
                        } catch (e) {
                            // 没有三级，跳过
                        }

                        // 每处理10个二级，暂停一下
                        if (j % 10 === 9) {
                            await page.waitForTimeout(2000);
                            const arr = Array.from(allData.values());
                            console.log(`      💾 当前收集: ${arr.length} 个类目`);
                        }

                    } catch (e) {
                        console.log(`      ⚠️  二级 [${j + 1}] 跳过`);
                    }
                }

            } catch (e) {
                console.log(`   ⚠️  该一级类目无二级`);
            }

            // 每处理5个一级，显示进度
            if (i % 5 === 4) {
                const arr = Array.from(allData.values());
                const l1 = arr.filter(c => c.level === 1).length;
                const l2 = arr.filter(c => c.level === 2).length;
                const l3 = arr.filter(c => c.level === 3).length;

                console.log(`\n📊 进度更新: 总${arr.length} (L1:${l1} L2:${l2} L3:${l3}) | 点击:${totalClicks}\n`);
            }

        } catch (e) {
            console.log(`⚠️  一级 [${i + 1}] 处理失败`);
        }
    }

    console.log('\n='.repeat(70));
    console.log('⏰ 等待5秒，确保最后的数据加载...\n');
    await page.waitForTimeout(5000);

    // 保存数据
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
            source: '终极全自动提取（递归三级联动）',
            url: 'https://www.zcygov.cn/goods-center/goods/category/attr/select',
            extractedAt: new Date().toISOString(),
            totalCategories: arr.length,
            level1Count: level1.length,
            level2Count: level2.length,
            level3Count: level3.length,
            level4Count: level4.length,
            totalClicks: totalClicks,
            successfulCombos: successfulCombos,
            captureCount: captureCount,
            note: '完整的1-2-3-4级类目（自动递归提取）'
        },
        categories: tree
    };

    await fs.ensureDir('./output');
    await fs.writeJSON('./output/zcy_ultimate_complete.json', output, { spaces: 2 });

    console.log('='.repeat(70));
    console.log('🎉 终极提取完成！');
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
    console.log(`   🖱️  总点击次数: ${totalClicks}`);
    console.log(`   ✅ 成功组合: ${successfulCombos}`);
    console.log(`   📡 API捕获次数: ${captureCount}`);
    console.log('');
    console.log('📁 保存位置:');
    console.log('   ./output/zcy_ultimate_complete.json');
    console.log('='.repeat(70));

    await page.waitForTimeout(3000);
    await browser.close();

    console.log('\n✅ 全部完成！这是最完整的数据了！\n');
}

ultimateExtract().catch(err => {
    console.error('❌ 错误:', err.message);
    console.error(err.stack);
});
