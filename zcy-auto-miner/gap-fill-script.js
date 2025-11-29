// 🚀 26大类 - 查漏补缺专用脚本
(function () {
    console.clear();
    console.log("🕵️‍♀️ 查漏补缺模式启动！目标：覆盖 26 大类...");

    // 1. 定义缺失的目标 (你还没抓到的)
    const MISSING_TARGETS = [
        "机电", "教学", "科研", "安全", "橡胶",
        "图书", "档案", "仪器", "仪表", "专用设备",
        "建材", "食品", "酒水", "鲜花", "绿植",
        "教育", "体育", "防护"
    ];

    // 存储数据
    let newCollection = {};

    // 2. 拦截器
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const response = await originalFetch(...args);
        const clone = response.clone();
        clone.json().then(data => {
            const list = data.result || data.data || data.list || data;
            if (Array.isArray(list)) {
                list.forEach(item => {
                    if (item.name && item.id) {
                        // 存下来
                        if (!newCollection[item.id]) {
                            newCollection[item.id] = { id: item.id, name: item.name, pid: item.parentId };
                            // 如果是我们要补缺的，高亮显示
                            if (MISSING_TARGETS.some(t => item.name.includes(t))) {
                                console.log(`🔥 补全成功: [${item.name}] ID: ${item.id}`);
                            }
                        }
                    }
                });
            }
        }).catch(() => { });
        return response;
    };

    // 3. 自动扫描左侧菜单并提示
    setTimeout(() => {
        const items = document.querySelectorAll('.doraemon-list-item'); // 请确认类名是否还是这个
        console.log(`📋 左侧菜单共找到 ${items.length} 项。正在寻找缺失类目...`);

        items.forEach(item => {
            const text = item.innerText;
            if (MISSING_TARGETS.some(t => text.includes(t))) {
                console.log(`👇 请点击: ${text}`);
                // 自动点击 (取消注释可启用)
                item.click();
            }
        });

        console.log("✅ 自动点击已触发，请留意控制台的【🔥 补全成功】日志！");
        console.log("⏳ 等待 10 秒后，输入 exportMissing() 导出新数据。");
    }, 2000);

    // 4. 导出函数
    window.exportMissing = function () {
        console.log(JSON.stringify(Object.values(newCollection), null, 2));
    };
})();
