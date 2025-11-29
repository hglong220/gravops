/**
 * 政采云7大类目持续收集脚本
 * 适用于需要手动切换类目的场景
 * 
 * 使用方法：
 * 1. 登录政采云，进入有类目的页面
 * 2. 按F12打开开发者工具 → Console
 * 3. 粘贴并运行此脚本
 * 4. 手动点击/切换每个类目（脚本会自动收集数据）
 * 5. 切换完所有7个类目后，点击面板上的"下载数据"按钮
 */

(function () {
    console.log('🚀 政采云持续收集模式已启动');
    console.log('💡 请手动切换类目，数据会自动收集');
    console.log('='.repeat(50));

    const allData = new Map();
    const visitedCategories = new Set();

    // 创建悬浮控制面板
    const panel = document.createElement('div');
    panel.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        width: 320px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        z-index: 999999;
        font-family: 'Microsoft YaHei', sans-serif;
    `;

    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 style="margin: 0; font-size: 16px;">📦 类目收集器</h3>
            <button id="minimize-btn" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">—</button>
        </div>
        <div id="panel-content">
            <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px; margin-bottom: 12px;">
                <div style="font-size: 28px; font-weight: 700; text-align: center;" id="total-count">0</div>
                <div style="font-size: 12px; text-align: center; opacity: 0.9;">已收集类目数</div>
            </div>
            
            <div style="font-size: 12px; line-height: 1.8; margin-bottom: 12px;">
                <div>一级: <span id="level1-count">0</span></div>
                <div>二级: <span id="level2-count">0</span></div>
                <div>三级: <span id="level3-count">0</span></div>
            </div>
            
            <div style="background: rgba(255,255,255,0.15); padding: 10px; border-radius: 6px; margin-bottom: 12px; max-height: 120px; overflow-y: auto; font-size: 11px;" id="log"></div>
            
            <div style="background: rgba(255,255,255,0.15); padding: 10px; border-radius: 6px; margin-bottom: 12px;">
                <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px;">已访问类目 (<span id="visited-count">0</span>/7):</div>
                <div id="visited-list" style="font-size: 11px; line-height: 1.6;"></div>
            </div>
            
            <button id="download-btn" style="width: 100%; padding: 12px; background: #10b981; border: none; color: white; font-weight: 600; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.2s;">
                💾 下载数据 (JSON)
            </button>
            <button id="clear-btn" style="width: 100%; padding: 8px; background: rgba(255,255,255,0.2); border: none; color: white; border-radius: 6px; cursor: pointer; font-size: 12px; margin-top: 8px;">
                🗑️ 清空数据
            </button>
        </div>
    `;

    document.body.appendChild(panel);

    // 最小化功能
    let minimized = false;
    document.getElementById('minimize-btn').onclick = function () {
        minimized = !minimized;
        const content = document.getElementById('panel-content');
        const btn = document.getElementById('minimize-btn');

        if (minimized) {
            content.style.display = 'none';
            btn.textContent = '+';
            panel.style.width = '200px';
        } else {
            content.style.display = 'block';
            btn.textContent = '—';
            panel.style.width = '320px';
        }
    };

    // 更新UI
    function updateUI() {
        const dataArray = Array.from(allData.values());
        const level1 = dataArray.filter(c => c.level === 1).length;
        const level2 = dataArray.filter(c => c.level === 2).length;
        const level3 = dataArray.filter(c => c.level === 3).length;

        document.getElementById('total-count').textContent = allData.size;
        document.getElementById('level1-count').textContent = level1;
        document.getElementById('level2-count').textContent = level2;
        document.getElementById('level3-count').textContent = level3;
        document.getElementById('visited-count').textContent = visitedCategories.size;

        // 更新已访问列表
        const visitedList = document.getElementById('visited-list');
        if (visitedCategories.size === 0) {
            visitedList.innerHTML = '<div style="opacity: 0.7;">还未访问任何类目</div>';
        } else {
            visitedList.innerHTML = Array.from(visitedCategories)
                .map((name, i) => `<div>✅ ${i + 1}. ${name}</div>`)
                .join('');
        }
    }

    function addLog(msg, color = 'rgba(255,255,255,0.9)') {
        const logEl = document.getElementById('log');
        const time = new Date().toLocaleTimeString();
        const div = document.createElement('div');
        div.style.color = color;
        div.textContent = `[${time}] ${msg}`;
        logEl.insertBefore(div, logEl.firstChild);

        // 保持最多10条日志
        while (logEl.children.length > 10) {
            logEl.removeChild(logEl.lastChild);
        }
    }

    // 拦截Fetch请求
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

    // 拦截XHR请求
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

        if (Array.isArray(list) && list.length > 0) {
            let newCount = 0;
            let currentLevel1 = null;

            list.forEach(item => {
                if (item && item.id && item.name) {
                    const key = `${item.id}`;

                    if (!allData.has(key)) {
                        allData.set(key, {
                            id: item.id,
                            categoryCode: item.code || item.categoryCode || item.id.toString(),
                            name: item.name,
                            level: item.level || (item.parentId ? 2 : 1),
                            parentId: item.parentId || item.pid || null,
                            hasChildren: item.hasChildren || false,
                            hasSpu: item.hasSpu || false
                        });
                        newCount++;
                    }

                    // 记录一级类目
                    if (item.level === 1 || (!item.parentId && !item.pid)) {
                        currentLevel1 = item.name;
                        visitedCategories.add(item.name);
                    }
                }
            });

            if (newCount > 0) {
                addLog(`📥 +${newCount} 个类目${currentLevel1 ? ' (' + currentLevel1 + ')' : ''}`, '#10b981');
                updateUI();
            }
        }
    }

    // 下载按钮
    document.getElementById('download-btn').onclick = function () {
        if (allData.size === 0) {
            alert('⚠️ 还没有数据！\n\n请先切换浏览各个类目，让脚本收集数据。');
            return;
        }

        const dataArray = Array.from(allData.values());

        // 构建树形结构
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
                source: '政采云卖家后台-手动切换提取',
                extractedAt: new Date().toISOString(),
                totalCategories: dataArray.length,
                level1Count: level1Cats.length,
                level2Count: dataArray.filter(c => c.level === 2).length,
                level3Count: dataArray.filter(c => c.level === 3).length,
                visitedCategories: Array.from(visitedCategories)
            },
            categories: tree
        };

        const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `政采云${visitedCategories.size}大类_${dataArray.length}个类目_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();

        addLog(`✅ 已下载 ${dataArray.length} 个类目`, '#10b981');

        console.log('='.repeat(50));
        console.log('✅ 数据已下载！');
        console.log('📊 统计:');
        console.log('   - 总类目:', dataArray.length);
        console.log('   - 一级类目:', level1Cats.length);
        console.log('   - 二级类目:', dataArray.filter(c => c.level === 2).length);
        console.log('   - 三级类目:', dataArray.filter(c => c.level === 3).length);
        console.log('   - 已访问:', Array.from(visitedCategories));
        console.log('='.repeat(50));
    };

    // 清空按钮
    document.getElementById('clear-btn').onclick = function () {
        if (confirm('确定要清空所有已收集的数据吗？')) {
            allData.clear();
            visitedCategories.clear();
            updateUI();
            document.getElementById('log').innerHTML = '';
            addLog('🗑️ 数据已清空', '#ef4444');
        }
    };

    // 初始化
    updateUI();
    addLog('✅ 收集器已启动', '#10b981');
    addLog('💡 请手动切换类目', '#fbbf24');

    console.log('✅ 持续收集模式已启动！');
    console.log('💡 现在可以手动切换类目，数据会自动收集');
    console.log('📊 完成后点击面板上的"下载数据"按钮');

})();
