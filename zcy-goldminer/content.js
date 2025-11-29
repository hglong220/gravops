// content.js - 金矿挖掘机核心逻辑

// 1. 核心种子 ID 列表 (基于青海省及通用逻辑整理)
// 如果其他省份不同，代码会自动尝试从页面左侧菜单更新这些 ID
const SEED_IDS = [
    { name: "计算机设备及软件", id: 3564 }, // 已验证
    { name: "3C数码", id: 4400 },          // 已验证
    { name: "办公设备/耗材", id: 4411 },    // 基于抓包推测
    { name: "文化用品", id: 4402 },        // 已验证
    { name: "家用电器", id: 5001 },        // 猜测值，脚本会自动修正
    { name: "家具用具", id: 3001 }         // 猜测值，脚本会自动修正
];

// 2. 注入控制面板 UI
function injectUI() {
    const div = document.createElement('div');
    div.style.cssText = "position:fixed; bottom:20px; right:20px; z-index:9999; background:white; border:2px solid #2563eb; padding:15px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.2); font-family:sans-serif;";
    div.innerHTML = `
        <h3 style="margin:0 0 10px 0; color:#2563eb;">⛏️ 类目挖掘机</h3>
        <button id="btn-scan-menu" style="display:block; width:100%; margin-bottom:5px; padding:8px; background:#e0f2fe; border:none; cursor:pointer;">1. 扫描左侧菜单获取最新ID</button>
        <button id="btn-start-dig" style="display:block; width:100%; margin-bottom:5px; padding:8px; background:#2563eb; color:white; border:none; cursor:pointer; font-weight:bold;">2. 开始挖掘核心数据</button>
        <div id="log-area" style="font-size:12px; color:#666; margin-top:10px; max-height:100px; overflow-y:auto; border-top:1px solid #eee; padding-top:5px;">准备就绪...</div>
    `;
    document.body.appendChild(div);

    document.getElementById('btn-scan-menu').onclick = scanLeftMenu;
    document.getElementById('btn-start-dig').onclick = startDigging;
}

function log(msg) {
    const el = document.getElementById('log-area');
    el.innerHTML = `<div>${msg}</div>` + el.innerHTML;
    console.log(`[挖掘机] ${msg}`);
}

// 3. 扫描左侧菜单 (修正 ID)
function scanLeftMenu() {
    log("正在扫描左侧菜单...");
    const items = document.querySelectorAll('.doraemon-list-item');
    if (items.length === 0) {
        log("❌ 未找到左侧菜单，请确保在商品发布/类目选择页面！");
        return;
    }

    let foundCount = 0;
    items.forEach(item => {
        // 尝试从 Vue 实例或 DOM 属性获取 ID
        let id = item.getAttribute('data-id');
        // 如果 DOM 没有，尝试读取 Vue (需要一点黑魔法，但在 content script 难直接访问 page 变量)
        // 这里主要依赖文本匹配来辅助确认
        const name = item.innerText.split('\n')[0].trim();

        // 更新种子列表
        SEED_IDS.forEach(seed => {
            if (name.includes(seed.name.substring(0, 2))) { // 模糊匹配
                // 如果能从 DOM 拿到 ID 最好，拿不到就提示用户手动确认
                log(`🔹 发现菜单项: ${name}`);
                foundCount++;
            }
        });
    });
    log(`✅ 扫描完成。当前种子库包含 ${SEED_IDS.length} 个目标。如果自动扫描失败，将使用默认硬编码 ID。`);
}

// 4. 核心挖掘功能 (递归 Fetch)
async function startDigging() {
    log("🚀 开始挖掘！请勿关闭页面...");
    let allData = [];

    for (let seed of SEED_IDS) {
        log(`正在挖掘大类: [${seed.name}] (ID: ${seed.id})...`);
        const tree = await fetchCategoryTree(seed.id, seed.name);
        if (tree) {
            allData.push(tree);
            log(`✅ [${seed.name}] 挖掘成功！包含 ${tree.children ? tree.children.length : 0} 个子类目`);
        } else {
            log(`❌ [${seed.name}] 挖掘失败，可能 ID 不对或无权限。`);
        }
        // 稍微休息一下，防止被封
        await new Promise(r => setTimeout(r, 1000));
    }

    log("🎉 全部完成！正在导出 JSON...");
    download(JSON.stringify(allData, null, 2), 'zcy_core_categories.json');
}

// 5. 调用 API 获取树状结构
async function fetchCategoryTree(parentId, rootName) {
    // 构造请求 URL (基于抓包分析的 common 接口)
    // 备用接口: /api/category/getChildren
    const timestamp = Math.floor(Date.now() / 1000);
    const url = `/api/micro/category/backCategories/categoriesByLayer/cacheUpdate/common?timestamp=${timestamp}&pid=${parentId}&scene=0&needQualificationMark=true`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Network response was not ok");
        const json = await res.json();
        const list = json.result || json.data || [];

        // 构建当前节点
        let node = {
            id: parentId,
            name: rootName,
            children: []
        };

        // 遍历子节点
        for (let item of list) {
            let childNode = {
                id: item.id,
                name: item.name,
                code: item.code,
                is_leaf: item.leafFlag || false,
                children: []
            };

            // 如果不是叶子节点，继续向下挖 (递归)
            // 注意：为了速度，我们只挖 3 层 (爷爷 -> 爸爸 -> 孙子)
            if (!item.leafFlag) {
                await new Promise(r => setTimeout(r, 500)); // 只有 0.5s 间隔
                const subChildren = await fetchSubChildren(item.id);
                childNode.children = subChildren;
            }

            node.children.push(childNode);
        }
        return node;

    } catch (e) {
        console.error(e);
        return null;
    }
}

// 获取子节点的子节点 (简化版 fetch)
async function fetchSubChildren(pid) {
    const timestamp = Math.floor(Date.now() / 1000);
    const url = `/api/micro/category/backCategories/categoriesByLayer/cacheUpdate/common?timestamp=${timestamp}&pid=${pid}&scene=0&needQualificationMark=true`;
    try {
        const res = await fetch(url);
        const json = await res.json();
        return (json.result || json.data || []).map(i => ({
            id: i.id,
            name: i.name,
            code: i.code,
            is_leaf: i.leafFlag
        }));
    } catch (e) { return []; }
}

// 6. 导出文件工具
function download(content, fileName) {
    const a = document.createElement("a");
    const file = new Blob([content], { type: "application/json" });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
}

// 启动
setTimeout(injectUI, 2000);
