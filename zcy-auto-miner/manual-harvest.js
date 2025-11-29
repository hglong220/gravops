// 26大类目手动收割脚本
// 使用方法：在政采云页面控制台直接粘贴运行

console.log('🎯 启动26大类目手动收割模式');

const db = {};
let count = 0;

// 创建控制面板
const panel = document.createElement('div');
panel.style.cssText = `
    position: fixed;
    top: 50px;
    right: 20px;
    width: 350px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
    border-radius: 15px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    z-index: 999999;
    font-family: 'Microsoft YaHei', sans-serif;
`;

panel.innerHTML = `
    <h2 style="margin: 0 0 15px 0; font-size: 18px;">📦 26大类目收割机</h2>
    <div style="background: rgba(255,255,255,0.2); padding: 10px; border-radius: 8px; margin-bottom: 10px;">
        <div style="font-size: 24px; font-weight: bold;" id="counter">0</div>
        <div style="font-size: 12px; opacity: 0.9;">已收集类目数</div>
    </div>
    <div id="log" style="height: 200px; overflow-y: auto; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; font-size: 12px; margin-bottom: 10px;"></div>
    <button id="btnCapture" style="width: 100%; padding: 12px; background: #10b981; border: none; color: white; font-weight: bold; border-radius: 8px; cursor: pointer; margin-bottom: 8px;">🎣 开始智能捕获</button>
    <button id="btnExport" style="width: 100%; padding: 12px; background: #3b82f6; border: none; color: white; font-weight: bold; border-radius: 8px; cursor: pointer;">💾 导出数据</button>
`;

document.body.appendChild(panel);

const log = (msg, color = 'white') => {
    const logEl = document.getElementById('log');
    const time = new Date().toLocaleTimeString();
    logEl.innerHTML = `<div style="color: ${color};">[${time}] ${msg}</div>` + logEl.innerHTML;
};

const updateCounter = () => {
    document.getElementById('counter').innerText = count;
};

// 拦截所有API响应
const originalFetch = window.fetch;
window.fetch = async function (...args) {
    const response = await originalFetch(...args);
    const clone = response.clone();

    clone.json().then(data => {
        processData(data);
    }).catch(() => { });

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

    if (Array.isArray(list)) {
        list.forEach(item => {
            if (item && item.id && item.name) {
                const key = `${item.id}_${item.name}`;
                if (!db[key]) {
                    db[key] = {
                        id: item.id,
                        name: item.name,
                        pid: item.parentId || item.pid || 0,
                        code: item.code || item.categoryCode || '',
                        level: item.level || 0
                    };
                    count++;
                    updateCounter();
                    log(`✅ ${item.name}`, '#10b981');
                }
            }
        });
    }
}

// 智能捕获按钮
document.getElementById('btnCapture').onclick = async () => {
    log('🚀 启动智能捕获模式...', '#fbbf24');

    // 查找所有可能的类目元素
    const selectors = [
        '.doraemon-list-item',
        '[class*="category"]',
        '[class*="menu-item"]',
        '.ant-menu-item',
        '.sidebar-item',
        'li[data-key]'
    ];

    let foundElements = [];
    for (const selector of selectors) {
        const elements = Array.from(document.querySelectorAll(selector));
        if (elements.length > 0) {
            foundElements = elements;
            log(`🎯 使用选择器: ${selector}`, '#60a5fa');
            break;
        }
    }

    if (foundElements.length === 0) {
        log('❌ 未找到菜单元素，请手动点击类目', '#ef4444');
        return;
    }

    log(`📡 找到 ${foundElements.length} 个菜单项，开始遍历...`, '#a78bfa');

    for (let i = 0; i < foundElements.length; i++) {
        const el = foundElements[i];
        const text = el.innerText?.split('\n')[0];

        log(`[${i + 1}/${foundElements.length}] 点击: ${text}`, '#fbbf24');

        el.click();
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });

        // 等待数据加载
        await new Promise(r => setTimeout(r, 1800 + Math.random() * 400));
    }

    log('✅✅✅ 扫描完成！', '#10b981');
};

// 导出按钮
document.getElementById('btnExport').onclick = () => {
    if (count === 0) {
        alert('还没有数据，请先点击"开始智能捕获"');
        return;
    }

    // 生成TXT
    let txt = '类目ID\t类目名称\t父级ID\t类目编码\t层级\n';
    txt += '='.repeat(100) + '\n';

    Object.values(db).forEach(item => {
        txt += `${item.id}\t${item.name}\t${item.pid}\t${item.code}\t${item.level}\n`;
    });

    // 下载TXT
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `政采云26大类_${count}条_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();

    // 同时下载JSON
    const jsonBlob = new Blob([JSON.stringify(Object.values(db), null, 2)], { type: 'application/json' });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const jsonA = document.createElement('a');
    jsonA.href = jsonUrl;
    jsonA.download = `政采云26大类_${count}条_${new Date().toISOString().slice(0, 10)}.json`;
    jsonA.click();

    log(`💾 已导出 ${count} 条数据（TXT + JSON）`, '#10b981');
};
