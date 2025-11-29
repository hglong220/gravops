/**
 * 政采云7大类目快速提取脚本
 * 直接在政采云页面的浏览器控制台运行
 * 
 * 使用方法：
 * 1. 登录政采云卖家后台
 * 2. 进入"发布商品"或有类目列表的页面
 * 3. 按F12打开开发者工具
 * 4. 切换到Console标签
 * 5. 复制粘贴下面的代码，按回车
 * 6. 等待自动点击完成
 * 7. 会自动下载JSON文件
 */

(async function () {
    console.log('🚀 政采云7大类目自动提取工具');
    console.log('='.repeat(50));

    const allData = new Map();
    let clickCount = 0;

    // 创建可视化面板
    const panel = document.createElement('div');
    panel.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 350px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        z-index: 999999;
        font-family: monospace;
    `;

    panel.innerHTML = `
        <h3 style="margin:0 0 10px 0; font-size:18px;">📦 类目提取中...</h3>
        <div id="extract-progress" style="font-size:14px; line-height:1.6;"></div>
        <div id="extract-stats" style="margin-top:15px; padding-top:15px; border-top:1px solid rgba(255,255,255,0.3);"></div>
    `;

    document.body.appendChild(panel);

    const progressEl = document.getElementById('extract-progress');
    const statsEl = document.getElementById('extract-stats');

    function updateProgress(msg) {
        progressEl.innerHTML = `<div>${new Date().toLocaleTimeString()}: ${msg}</div>` + progressEl.innerHTML;
    }

    function updateStats() {
        const level1 = Array.from(allData.values()).filter(c => c.level === 1).length;
        const level2 = Array.from(allData.values()).filter(c => c.level === 2).length;
        const level3 = Array.from(allData.values()).filter(c => c.level === 3).length;

        statsEl.innerHTML = `
            <div style="font-size:12px;">
                <div>总类目: <strong>${allData.size}</strong></div>
                <div>一级: ${level1} | 二级: ${level2} | 三级: ${level3}</div>
            </div>
        `;
    }

    // 拦截API响应
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const response = await originalFetch(...args);
        const clone = response.clone();

        try {
            const data = await clone.json();
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
                        updateStats();
                    }
                });
            }
        } catch (e) { }

        return response;
    };

    const XHR = XMLHttpRequest.prototype;
    const send = XHR.send;
    XHR.send = function () {
        this.addEventListener('load', function () {
            try {
                const data = JSON.parse(this.responseText);
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
                            updateStats();
                        }
                    });
                }
            } catch (e) { }
        });
        return send.apply(this, arguments);
    };

    updateProgress('✅ 拦截器已启动');

    // 查找7个类目的选择框
    const targetCategories = [
        '办公用品', '办公设备', '日用百货', '计算机设备',
        '劳动保护用品', '灯具商品', '五金工具'
    ];

    // 尝试多种选择器
    const possibleSelectors = [
        'input[type="radio"]',
        '.radio-item',
        '[class*="category"]',
        '[class*="标项"]',
        'label'
    ];

    let categoryElements = [];
    for (const selector of possibleSelectors) {
        const elements = Array.from(document.querySelectorAll(selector));
        const matched = elements.filter(el => {
            const text = el.innerText || el.textContent || '';
            return targetCategories.some(cat => text.includes(cat));
        });

        if (matched.length > 0) {
            categoryElements = matched;
            updateProgress(`🎯 找到 ${matched.length} 个类目元素（选择器: ${selector}）`);
            break;
        }
    }

    if (categoryElements.length === 0) {
        updateProgress('❌ 未找到类目元素，请手动操作');
        alert('请手动点击左侧的7个类目，脚本会自动收集数据。完成后刷新页面并运行：window.downloadCategoryData()');

        // 提供手动下载函数
        window.downloadCategoryData = function () {
            const data = Array.from(allData.values());
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `政采云7大类_${data.length}个类目_${Date.now()}.json`;
            a.click();
            console.log('✅ 已下载', data.length, '个类目');
        };

        return;
    }

    // 自动点击每个类目
    updateProgress(`🤖 开始自动点击 ${categoryElements.length} 个类目...`);

    for (let i = 0; i < categoryElements.length; i++) {
        const el = categoryElements[i];
        const text = (el.innerText || el.textContent || '').trim().split('\n')[0];

        updateProgress(`👆 [${i + 1}/${categoryElements.length}] 点击: ${text}`);

        // 尝试点击（兼容多种元素类型）
        if (el.tagName === 'INPUT') {
            el.click();
        } else if (el.querySelector('input')) {
            el.querySelector('input').click();
        } else {
            el.click();
        }

        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        clickCount++;

        // 等待数据加载
        await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));
    }

    updateProgress(`✅✅✅ 自动点击完成！`);
    updateProgress(`📊 共收集 ${allData.size} 个类目`);

    // 等待一下确保所有数据都捕获了
    await new Promise(r => setTimeout(r, 3000));

    // 构建树形结构
    const dataArray = Array.from(allData.values());
    const level1Cats = dataArray.filter(c => c.level === 1);

    const tree = level1Cats.map(cat1 => {
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
            source: '政采云卖家后台-手动提取',
            extractedAt: new Date().toISOString(),
            totalCategories: dataArray.length,
            level1Count: level1Cats.length,
            level2Count: dataArray.filter(c => c.level === 2).length,
            level3Count: dataArray.filter(c => c.level === 3).length,
            clickCount: clickCount
        },
        categories: tree
    };

    // 自动下载JSON
    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `政采云完整7大类_${dataArray.length}个类目_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();

    updateProgress(`💾 已自动下载JSON文件！`);

    panel.querySelector('h3').textContent = '✅ 提取完成！';

    console.log('='.repeat(50));
    console.log('✅ 提取完成！数据已下载');
    console.log('📊 统计:');
    console.log('   - 总类目:', dataArray.length);
    console.log('   - 一级类目:', level1Cats.length);
    console.log('   - 二级类目:', dataArray.filter(c => c.level === 2).length);
    console.log('   - 三级类目:', dataArray.filter(c => c.level === 3).length);
    console.log('='.repeat(50));

    return output;
})();
