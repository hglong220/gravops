/**
 * 40分钟专门提取4-5级类目
 * 重点关注深层次类目
 */

const { chromium } = require('playwright');
const fs = require('fs-extra');

async function extract45Levels() {
    console.log('🎯 40分钟专项提取：4级和5级类目');
    console.log('⭐ 重点关注深层次类目\n');

    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    const allData = new Map();

    // 强化API监听
    page.on('response', async (response) => {
        try {
            const url = response.url();

            if (url.includes('category') || url.includes('cate') ||
                url.includes('attr') || url.includes('goods')) {

                const contentType = response.headers()['content-type'] || '';
                if (!contentType.includes('json')) return;

                const data = await response.json();

                const extractList = (obj, depth = 0) => {
                    if (depth > 10) return [];
                    if (Array.isArray(obj)) return obj;
                    if (obj.result) return extractList(obj.result, depth + 1);
                    if (obj.data) return extractList(obj.data, depth + 1);
                    if (obj.list) return obj.list;
                    if (obj.rows) return obj.rows;
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
    console.log('🎯 专项任务：提取4级和5级类目');
    console.log('');
    console.log('   操作指南：');
    console.log('   1. 选择一级类目');
    console.log('   2. 选择二级类目');
    console.log('   3. 选择三级类目');
    console.log('   4. ⭐⭐ 重点看有没有"四级类目"输入框');
    console.log('   5. ⭐⭐ 如果有，点击并选择四级');
    console.log('   6. ⭐⭐⭐ 如果还有五级，也要点击');
    console.log('');
    console.log('   💡 提示：');
    console.log('   - 主要找有4-5级的类目组合');
    console.log('   - 1-3级会自动捕获，不用特别关注');
    console.log('   - 实时显示L4和L5数量');
    console.log('');
    console.log('⏰ 监听时间: 40分钟');
    console.log('='.repeat(80));
    console.log('');

    const startTime = Date.now();
    const duration = 40 * 60 * 1000; // 40分钟
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
            const remaining = 40 - elapsed;

            // 高亮显示4-5级
            let highlight = '';
            if (l4 > 0) highlight += ` ⭐L4:${l4}`;
            if (l5 > 0) highlight += ` 🌟L5:${l5}`;

            console.log(`📦 [+${diff}] 总:${currentCount} L1:${l1} L2:${l2} L3:${l3}${highlight} | ⏰${remaining}分 | #${updateCounter}`);
        }

        // 每10分钟汇报
        const elapsed = Date.now() - startTime;
        if (elapsed % (10 * 60 * 1000) < 5000 && elapsed > 5000) {
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

            console.log(`\n⏱️  已运行 ${minutes} 分钟 | 🎯 重点：L4:${l4} L5:${l5}\n`);
        }
    }

    console.log('\n⏰ 40分钟完成！处理数据...\n');

    const arr = Array.from(allData.values());

    // 最终推断层级
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

    // 构建树（支持5级）
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
            source: '40分钟专项提取（4-5级类目）',
            extractedAt: new Date().toISOString(),
            totalCategories: arr.length,
            level1Count: level1.length,
            level2Count: level2.length,
            level3Count: level3.length,
            level4Count: level4.length,
            level5Count: level5.length,
            updateCount: updateCounter,
            note: '专门提取深层次4-5级类目'
        },
        categories: tree
    };

    await fs.ensureDir('./output');
    await fs.writeJSON('./output/zcy_45_levels.json', output, { spaces: 2 });

    console.log('='.repeat(80));
    console.log('🎉 4-5级专项提取完成！');
    console.log('');
    console.log('📊 最终统计:');
    console.log(`   总计: ${arr.length} 个`);
    console.log(`   一级: ${level1.length} 个`);
    console.log(`   二级: ${level2.length} 个`);
    console.log(`   三级: ${level3.length} 个`);
    console.log(`   ⭐ 四级: ${level4.length} 个 ${level4.length > 0 ? '✅' : ''}`);
    console.log(`   🌟 五级: ${level5.length} 个 ${level5.length > 0 ? '✅✅' : ''}`);
    console.log('');
    console.log('📁 保存: ./output/zcy_45_levels.json');
    console.log('='.repeat(80));

    await browser.close();
    console.log('\n✅ 完成！等待与其他数据合并！\n');
}

extract45Levels().catch(console.error);
