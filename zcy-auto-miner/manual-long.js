/**
 * 超长时间监听版 - 手动操作专用
 * 给你足够时间手动打开所有类目，自动收集数据
 */

const { chromium } = require('playwright');
const fs = require('fs-extra');

async function manualExtract() {
    console.log('🎯 超长时间监听模式');
    console.log('⏰ 你有充足时间手动打开所有类目！\n');

    const browser = await chromium.launch({
        headless: false,
        slowMo: 50
    });

    const page = await browser.newPage();
    const allData = new Map();

    let lastUpdate = Date.now();
    let updateCount = 0;

    // 监听所有API
    page.on('response', async (response) => {
        const url = response.url();

        if (url.includes('category') || url.includes('cate') || url.includes('goods') || url.includes('attr')) {
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
                    let newCount = 0;

                    list.forEach(item => {
                        if (item && item.id && item.name) {
                            const existing = allData.get(item.id);

                            if (!existing) newCount++;

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

                    if (newCount > 0) {
                        updateCount++;
                        lastUpdate = Date.now();

                        const arr = Array.from(allData.values());
                        const l1 = arr.filter(c => c.level === 1).length;
                        const l2 = arr.filter(c => c.level === 2).length;
                        const l3 = arr.filter(c => c.level === 3).length;

                        console.log(`📦 [${updateCount}] +${newCount} | 总: ${allData.size} (L1:${l1} L2:${l2} L3:${l3})`);
                    }
                }
            } catch (e) { }
        }
    });

    console.log('🌐 打开政采云页面...');
    await page.goto('https://www.zcygov.cn/goods-center/goods/category/attr/select');

    console.log('⏰ 等待15秒登录...\n');
    await page.waitForTimeout(15000);

    console.log('='.repeat(70));
    console.log('💡 现在你可以手动操作了！');
    console.log('');
    console.log('📝 操作步骤:');
    console.log('   1. 在浏览器中逐个点击一级类目');
    console.log('   2. 展开二级类目');
    console.log('   3. 展开三级类目');
    console.log('   4. 脚本会自动捕获所有API数据');
    console.log('');
    console.log('⏰ 监听时间: 10分钟（你有足够时间操作）');
    console.log('💾 完成后会自动保存');
    console.log('='.repeat(70));
    console.log('');

    // 超长时间等待 - 10分钟
    const totalMinutes = 10;
    const totalMs = totalMinutes * 60 * 1000;
    const checkInterval = 5000; // 每5秒检查一次

    let elapsed = 0;

    while (elapsed < totalMs) {
        await page.waitForTimeout(checkInterval);
        elapsed += checkInterval;

        const minutesLeft = Math.ceil((totalMs - elapsed) / 60000);
        const secondsInCurrentMinute = Math.floor(((totalMs - elapsed) % 60000) / 1000);

        // 每30秒提示一次
        if (elapsed % 30000 === 0) {
            const arr = Array.from(allData.values());
            const l1 = arr.filter(c => c.level === 1).length;
            const l2 = arr.filter(c => c.level === 2).length;
            const l3 = arr.filter(c => c.level === 3).length;

            console.log(`⏱️  剩余时间: ${minutesLeft}分${secondsInCurrentMinute}秒 | 当前: ${allData.size} 个类目 (L1:${l1} L2:${l2} L3:${l3})`);
        }

        // 如果超过1分钟没有新数据，提示用户
        const timeSinceUpdate = Date.now() - lastUpdate;
        if (timeSinceUpdate > 60000 && elapsed > 60000 && elapsed % 60000 === 0) {
            console.log('💡 提示: 1分钟没有新数据了，记得继续点击展开类目哦！');
        }
    }

    console.log('\n⏰ 时间到！开始保存数据...\n');

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
            source: '手动操作提取（10分钟版）',
            url: 'https://www.zcygov.cn/goods-center/goods/category/attr/select',
            extractedAt: new Date().toISOString(),
            totalCategories: arr.length,
            level1Count: level1.length,
            level2Count: level2.length,
            level3Count: level3.length,
            level4Count: level4.length,
            updateCount: updateCount,
            note: '手动操作提取的完整数据'
        },
        categories: tree
    };

    await fs.ensureDir('./output');
    await fs.writeJSON('./output/zcy_manual_extracted.json', output, { spaces: 2 });

    console.log('='.repeat(70));
    console.log('🎉 提取完成！');
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
    console.log(`   🔄 API更新次数: ${updateCount}`);
    console.log('');
    console.log('📁 保存位置:');
    console.log('   ./output/zcy_manual_extracted.json');
    console.log('='.repeat(70));

    await page.waitForTimeout(3000);
    await browser.close();

    console.log('\n✅ 全部完成！\n');
}

manualExtract().catch(err => {
    console.error('❌ 错误:', err.message);
});
