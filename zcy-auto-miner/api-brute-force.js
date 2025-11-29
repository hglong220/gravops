// 终极暴力方案：直接调用政采云API
// 复制到政采云页面的控制台运行

(async function () {
    console.log('🚀 启动终极API调用器...');

    // 常见的政采云类目API地址（尝试所有可能性）
    const possibleAPIs = [
        '/api/category/queryAll',
        '/api/category/list',
        '/api/category/tree',
        '/api/item/category/list',
        '/category/queryTree',
        '/category/getAllCategory',
        '/shop/category/list',
        '/seller/category/tree',
        '/product/category/list',
        '/goods/category/tree'
    ];

    const baseURLs = [
        'https://shop.zcygov.cn',
        'https://seller.zcygov.cn',
        'https://api.zcygov.cn',
        window.location.origin  // 当前页面的域名
    ];

    let foundData = null;

    // 暴力尝试所有组合
    for (const base of baseURLs) {
        for (const api of possibleAPIs) {
            const url = base + api;

            try {
                console.log(`🔍 尝试: ${url}`);

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({})
                });

                if (response.ok) {
                    const data = await response.json();

                    if (data && (data.result || data.data || data.list)) {
                        console.log(`✅✅✅ 找到了！API: ${url}`);
                        console.log('数据:', data);
                        foundData = data;

                        // 下载数据
                        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                        const downloadUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = downloadUrl;
                        a.download = `政采云类目_API_${Date.now()}.json`;
                        a.click();

                        return data;
                    }
                }
            } catch (e) {
                // console.log(`❌ 失败: ${url}`);
            }

            // 避免请求太快被封
            await new Promise(r => setTimeout(r, 100));
        }
    }

    if (!foundData) {
        console.log('❌ 所有API都尝试失败！');
        console.log('');
        console.log('👉 请按照以下步骤手动查找API：');
        console.log('1. 按F12打开开发者工具');
        console.log('2. 切换到 Network 标签');
        console.log('3. 在Filter输入：category');
        console.log('4. 点击左侧的类目菜单');
        console.log('5. 查看Network中出现的请求');
        console.log('6. 找到返回类目数据的请求');
        console.log('7. 右键 → Copy → Copy as fetch');
        console.log('8. 粘贴给我，我帮你改成脚本');
    }
})();
