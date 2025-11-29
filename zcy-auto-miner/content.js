// content.js
console.log("🚀 全量收割机 v4.0 已就绪");

// 1. 注入拦截器
const s = document.createElement('script');
s.src = chrome.runtime.getURL('inject.js');
(document.head || document.documentElement).appendChild(s);

// 2. 数据库
let db = {};
let totalItems = 0;

// 3. 监听并清洗数据
window.addEventListener('message', (e) => {
    if (e.data.type === 'ZCY_CAPTURE') {
        const raw = e.data.payload;
        const list = raw.result || raw.data || raw.list || raw;

        if (Array.isArray(list)) {
            list.forEach(item => {
                // 只要是有效类目，不管叫什么名字，全部入库
                if (item && item.id && item.name) {
                    if (!db[item.id]) {
                        db[item.id] = {
                            id: item.id,
                            name: item.name,
                            pid: item.parentId || 0,
                            code: item.code || ""
                        };
                        totalItems++;
                        updatePanel(`📦 已吸入: ${item.name} (ID:${item.id})`);
                    }
                }
            });
        }
    }
});

// 4. 创建控制面板
const div = document.createElement('div');
div.style.cssText = "position:fixed; top:10px; right:10px; width:300px; background:#111; color:#0f0; z-index:999999; padding:15px; font-family:monospace; border-radius:8px; opacity:0.9; box-shadow:0 5px 15px rgba(0,0,0,0.5);";
div.innerHTML = `
    <h3 style="margin:0 0 10px 0; color:white; border-bottom:1px solid #333; padding-bottom:5px;">☢️ 全量收割机 (TXT版)</h3>
    <div id="msg" style="height:120px; overflow-y:auto; font-size:12px; color:#aaa; margin-bottom:10px;">等待启动...</div>
    <button id="btnRun" style="width:100%; padding:10px; background:#e11d48; color:white; border:none; font-weight:bold; cursor:pointer; border-radius:4px;">🔥 启动全量扫描</button>
    <button id="btnTxt" style="width:100%; padding:10px; background:#2563eb; color:white; border:none; font-weight:bold; cursor:pointer; border-radius:4px; margin-top:5px; display:none;">💾 下载 TXT 结果</button>
`;
document.body.appendChild(div);

function updatePanel(text) {
    const el = document.getElementById('msg');
    el.innerHTML = `<div>${text}</div>` + el.innerHTML;
}

// 5. 暴力点击逻辑
document.getElementById('btnRun').onclick = async () => {
    const btn = document.getElementById('btnRun');
    btn.disabled = true;
    btn.innerText = "正在疯狂扫描中...";

    // 获取左侧所有菜单项
    const items = document.querySelectorAll('.doraemon-list-item');

    if (items.length === 0) {
        alert("❌ 没找到菜单！请确保网页已加载完毕！");
        btn.disabled = false;
        return;
    }

    updatePanel(`🎯 锁定 ${items.length} 个大类，开始逐个击破...`);

    // 遍历每一个
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const name = item.innerText.split('\n')[0];

        // 模拟点击
        item.click();
        item.scrollIntoView({ block: "center" }); // 这一步是为了触发懒加载

        updatePanel(`👆 [${i + 1}/${items.length}] 点击: ${name}`);

        // 动态等待：随机 1.5 - 2 秒，模拟真人，确保数据加载完成
        await new Promise(r => setTimeout(r, 1500 + Math.random() * 500));
    }

    updatePanel(`✅✅✅ 全部完成！共抓取 ${totalItems} 条数据！`);
    document.getElementById('btnTxt').style.display = "block";
    btn.innerText = "扫描结束";
};

// 6. 导出 TXT 逻辑
document.getElementById('btnTxt').onclick = () => {
    if (totalItems === 0) {
        alert("⚠️ 还没抓到数据，可能是网页卡了，请刷新重试！");
        return;
    }

    // 格式化内容
    let content = "ID\t类目名称\t父级ID\t类目编码\n";
    content += "--------------------------------------------------------\n";
    Object.values(db).forEach(row => {
        content += `${row.id}\t${row.name}\t${row.pid}\t${row.code}\n`;
    });

    // 创建下载
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `政采云全量库_覆盖${Object.keys(db).length}类.txt`;
    a.click();
};
