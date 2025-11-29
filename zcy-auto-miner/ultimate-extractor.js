/**
 * 政采云完整数据提取器 - 终极版
 * 确保提取到所有二三级类目
 * 
 * 使用方法：
 * 1. 在政采云页面（任意页面都可以）
 * 2. F12 → Console
 * 3. 粘贴此代码 → Enter
 * 4. 按照提示操作
 */

(function () {
    console.clear();
    console.log('%c🚀 政采云完整数据提取器 v2.0', 'font-size: 18px; color: #10b981; font-weight: bold;');
    console.log('%c确保提取到完整的二三级类目', 'font-size: 14px; color: #6b7280;');
    console.log('='.repeat(60));

    const allData = new Map();
    const visitedL1 = new Set();

    // 创建悬浮面板
    const panel = document.createElement('div');
    panel.id = 'zcy-extractor-panel';
    panel.style.cssText = `
        position: fixed; top: 100px; right: 20px; width: 340px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white; padding: 20px; border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3); z-index: 999999;
        font-family: 'Microsoft YaHei', sans-serif;
    `;

    panel.innerHTML = `
        <div style="margin-bottom: 15px;">
            <h3 style="margin: 0; font-size: 16px; display: flex; justify-content: space-between; align-items: center;">
                📦 完整数据提取器
                <button id="min-btn" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 4px 10px; border-radius: 4px; cursor: pointer;">—</button>
            </h3>
        </div>
        
        <div id="panel-body">
            <!-- 统计卡片 -->
            <div style="background: rgba(255,255,255,0.15); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; text-align: center;">
                    <div>
                        <div style="font-size: 24px; font-weight: 700;" id="l1-count">0</div>
                        <div style="font-size: 11px; opacity: 0.9;">一级</div>
                    </div>
                    <div>
                        <div style="font-size: 24px; font-weight: 700;" id="l2-count">0</div>
                        <div style="font-size: 11px; opacity: 0.9;">二级</div>
                    </div>
                    <div>
                        <div style="font-size: 24px; font-weight: 700;" id="l3-count">0</div>
                        <div style="font-size: 11px; opacity: 0.9;">三级</div>
                    </div>
                </div>
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.2); text-align: center;">
                    <div style="font-size: 20px; font-weight: 700;" id="total-count">0</div>
                    <div style="font-size: 11px; opacity: 0.9;">总计</div>
                </div>
            </div>
            
            <!-- 进度 -->
            <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px; margin-bottom: 12px;">
                <div style="font-size: 12px; margin-bottom: 8px;">已访问类目 (<span id="visited-count">0</span>):</div>
                <div id="visited-tags" style="display: flex; flex-wrap: wrap; gap: 4px; min-height: 30px;"></div>
            </div>
            
            <!-- 日志 -->
            <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px; margin-bottom: 12px; max-height: 100px; overflow-y: auto; font-size: 11px; font-family: monospace;" id="log"></div>
            
            <!-- 操作按钮 -->
            <button id="download-btn" style="width: 100%; padding: 12px; background: #10b981; border: none; color: white; font-weight: 600; border-radius: 6px; cursor: pointer; font-size: 14px; margin-bottom: 8px;">
                💾 下载完整数据
            </button>
            
            <button id="guide-btn" style="width: 100%; padding: 8px; background: rgba(255,255,255,0.2); border: none; color: white; border-radius: 6px; cursor: pointer; font-size: 12px;">
                ❓ 使用说明
            </button>
        </div>
    `;

    document.body.appendChild(panel);

    // 最小化
    let minimized = false;
    document.getElementById('min-btn').onclick = () => {
        minimized = !minimized;
        const body = document.getElementById('panel-body');
        const btn = document.getElementById('min-btn');

        if (minimized) {
            body.style.display = 'none';
            btn.textContent = '+';
            panel.style.width = '180px';
        } else {
            body.style.display = 'block';
            btn.textContent = '—';
            panel.style.width = '340px';
        }
    };

    // 日志函数
    function log(msg, color = 'rgba(255,255,255,0.9)') {
        const logEl = document.getElementById('log');
        const time = new Date().toLocaleTimeString();
        const div = document.createElement('div');
        div.style.color = color;
        div.textContent = `[${time}] ${msg}`;
        logEl.insertBefore(div, logEl.firstChild);

        while (logEl.children.length > 15) {
            logEl.removeChild(logEl.lastChild);
        }

        console.log(`%c${msg}`, `color: ${color}`);
    }

    // 更新UI
    function updateUI() {
        const arr = Array.from(allData.values());
        const l1 = arr.filter(c => c.level === 1).length;
        const l2 = arr.filter(c => c.level === 2).length;
        const l3 = arr.filter(c => c.level === 3).length;

        document.getElementById('l1-count').textContent = l1;
        document.getElementById('l2-count').textContent = l2;
        document.getElementById('l3-count').textContent = l3;
        document.getElementById('total-count').textContent = allData.size;
        document.getElementById('visited-count').textContent = visitedL1.size;

        // 更新标签
        const tagsEl = document.getElementById('visited-tags');
        tagsEl.innerHTML = Array.from(visitedL1).map(name =>
            `<span style="background: rgba(255,255,255,0.3); padding: 2px 8px; border-radius: 10px; font-size: 10px;">${name}</span>`
        ).join('');
    }

    // 拦截网络请求
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const response = await originalFetch(...args);
        const clone = response.clone();

        try {
            const data = await clone.json();
            processData(data);
        } catch (e) { }

        return response;
    };

    const XHR = XMLHttpRequest.prototype;
    const send = XHR.send;
    XHR.send = function () {
        this.addEventListener('load', function () {
            try {
                const data = JSON.parse(this.responseText);
                processData(data);
            } catch (e) { }
        });
        return send.apply(this, arguments);
    };

    // 处理数据
    function processData(data) {
        const list = data.result || data.data || data.list || data.rows || [];

        if (!Array.isArray(list) || list.length === 0) return;

        let newCount = 0;
        let currentL1 = null;

        list.forEach(item => {
            if (!item || !item.id || !item.name) return;

            const key = `${item.id}`;
            if (allData.has(key)) return;

            const category = {
                id: item.id,
                categoryCode: item.code || item.categoryCode || item.id.toString(),
                name: item.name,
                level: item.level || (item.parentId || item.pid ? (item.parentId && allData.get(item.parentId.toString())?.level === 2 ? 3 : 2) : 1),
                parentId: item.parentId || item.pid || null,
                hasChildren: item.hasChildren || false,
                hasSpu: item.hasSpu || false
            };

            allData.set(key, category);
            newCount++;

            // 记录一级类目
            if (category.level === 1) {
                visitedL1.add(category.name);
                currentL1 = category.name;
            }
        });

        if (newCount > 0) {
            log(`📥 +${newCount} 个${currentL1 ? ' (' + currentL1 + ')' : ''}`, '#10b981');
            updateUI();
        }
    }

    // 下载按钮
    document.getElementById('download-btn').onclick = () => {
        if (allData.size === 0) {
            alert('⚠️ 还没有数据！\n\n请先切换并访问各个类目。');
            return;
        }

        const arr = Array.from(allData.values());
        const level1 = arr.filter(c => c.level === 1);

        // 构建树
        const tree = level1.map(cat1 => {
            const children2 = arr.filter(c => c.level === 2 && c.parentId === cat1.id);
            return {
                ...cat1,
                children: children2.map(cat2 => {
                    const children3 = arr.filter(c => c.level === 3 && c.parentId === cat2.id);
                    return {
                        ...cat2,
                        children: children3
                    };
                })
            };
        });

        const output = {
            meta: {
                source: '政采云卖家后台-浏览器提取',
                extractedAt: new Date().toISOString(),
                totalCategories: arr.length,
                level1Count: level1.length,
                level2Count: arr.filter(c => c.level === 2).length,
                level3Count: arr.filter(c => c.level === 3).length,
                visitedCategories: Array.from(visitedL1),
                note: '包含完整的一二三级类目树结构'
            },
            categories: tree
        };

        const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `政采云完整${visitedL1.size}大类_${arr.length}个类目_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();

        log('✅ 已下载 ' + arr.length + ' 个类目', '#10b981');

        console.log('='.repeat(60));
        console.log('✅ 数据已下载！');
        console.log('📊 统计:');
        console.log('   总计:', arr.length);
        console.log('   一级:', level1.length);
        console.log('   二级:', arr.filter(c => c.level === 2).length);
        console.log('   三级:', arr.filter(c => c.level === 3).length);
        console.log('='.repeat(60));
    };

    // 使用说明
    document.getElementById('guide-btn').onclick = () => {
        alert(`📖 使用说明\n\n1️⃣ 进入"发布商品"或"商品管理"页面\n\n2️⃣ 逐个点击并浏览你的7个类目：\n   - 办公用品\n   - 办公设备\n   - 日用百货\n   - 计算机设备\n   - 劳动保护用品\n   - 灯具商品\n   - 五金工具\n\n3️⃣ 确保进入每个类目的详情/列表页\n   （这样才能触发API加载二三级数据）\n\n4️⃣ 浏览完所有类目后，点击"下载完整数据"\n\n💡 提示：面板会实时显示收集到的类目数量`);
    };

    // 初始化
    updateUI();
    log('✅ 提取器已启动', '#10b981');
    log('💡 请访问各个类目页面', '#fbbf24');

    console.log('='.repeat(60));
    console.log('✅ 提取器已启动！');
    console.log('💡 操作步骤：');
    console.log('   1. 进入"发布商品"或"商品管理"页面');
    console.log('   2. 逐个点击你的7个类目');
    console.log('   3. 确保进入每个类目详情');
    console.log('   4. 点击面板上的"下载完整数据"');
    console.log('='.repeat(60));

})();
