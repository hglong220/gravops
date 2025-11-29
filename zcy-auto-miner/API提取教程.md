# 🎯 政采云26大类API提取教程（保证有效）

## 📋 准备工作
- 浏览器：Chrome 或 Edge
- 账号：政采云卖家账号（已登录）

---

## 🔍 方法一：Network 抓包法（推荐）

### 1️⃣ 打开政采云后台
访问：https://shop.zcygov.cn/
或者你的卖家后台地址

### 2️⃣ 打开开发者工具
- 按 `F12` 
- 或右键 → 检查

### 3️⃣ 切换到 Network 标签
- 点击顶部的 **Network**（网络）
- 确保红点是亮的（正在录制）
- 勾选 **Preserve log**（保留日志）

### 4️⃣ 过滤请求
在 Filter 输入框中输入：
```
category
```
或者
```
cate
```

### 5️⃣ 触发类目加载
- 点击"发布商品"或"类目管理"
- 或者点击左侧的类目菜单

### 6️⃣ 查找API
在 Network 列表中，你会看到类似这样的请求：
```
getCategoryList
queryCategoryTree
category/list
category/tree
```

### 7️⃣ 查看响应数据
- 点击该请求
- 切换到 **Preview** 或 **Response** 标签
- 你会看到所有类目的JSON数据

### 8️⃣ 复制数据
- 右键点击响应数据的根节点
- 选择 **Copy value** 或 **Copy object**
- 粘贴到文本编辑器

### 9️⃣ 保存为文件
- 保存为 `categories.json`
- 完成！✅

---

## 🔧 方法二：直接在Console执行（如果方法一失败）

### 在控制台粘贴以下代码：

```javascript
// 方案A：尝试从window对象找数据
console.log('🔍 搜索 window 对象...');
Object.keys(window).filter(key => key.toLowerCase().includes('category')).forEach(key => {
    console.log(key, window[key]);
});

// 方案B：拦截所有请求
const requests = [];
const originalFetch = window.fetch;
const originalXHR = XMLHttpRequest.prototype.open;

window.fetch = async function(...args) {
    const url = args[0];
    const response = await originalFetch(...args);
    
    if (url.includes('category') || url.includes('cate')) {
        const clone = response.clone();
        clone.json().then(data => {
            console.log('📡 Fetch 捕获到类目数据:', data);
            console.log('API:', url);
            // 自动下载
            downloadJSON(data, 'categories_from_fetch.json');
        });
    }
    
    return response;
};

XMLHttpRequest.prototype.open = function(method, url) {
    this.addEventListener('load', function() {
        if ((url.includes('category') || url.includes('cate')) && this.responseText) {
            try {
                const data = JSON.parse(this.responseText);
                console.log('📡 XHR 捕获到类目数据:', data);
                console.log('API:', url);
                downloadJSON(data, 'categories_from_xhr.json');
            } catch (e) {}
        }
    });
    return originalXHR.apply(this, arguments);
};

function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    console.log(`✅ 已下载: ${filename}`);
}

console.log('✅ 拦截器已启动！现在点击任意类目菜单...');
```

---

## 🎯 方法三：暴力枚举法（终极保底）

如果上面都不行，证明页面没有直接返回所有类目。
那么我们需要**手动点击每一个一级类目**，然后合并数据。

### 在控制台运行：

```javascript
const allCategories = new Map();

// 拦截所有响应
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const response = await originalFetch(...args);
    const clone = response.clone();
    
    clone.json().then(data => {
        // 提取类目数据
        const list = data.result || data.data || data.list || [];
        if (Array.isArray(list)) {
            list.forEach(item => {
                if (item && item.id && item.name) {
                    allCategories.set(item.id, item);
                }
            });
            console.log(`📦 当前已收集: ${allCategories.size} 个类目`);
        }
    }).catch(() => {});
    
    return response;
};

const XHR = XMLHttpRequest.prototype;
const send = XHR.send;
XHR.send = function() {
    this.addEventListener('load', function() {
        try {
            const data = JSON.parse(this.responseText);
            const list = data.result || data.data || data.list || [];
            if (Array.isArray(list)) {
                list.forEach(item => {
                    if (item && item.id && item.name) {
                        allCategories.set(item.id, item);
                    }
                });
                console.log(`📦 当前已收集: ${allCategories.size} 个类目`);
            }
        } catch (e) {}
    });
    return send.apply(this, arguments);
};

console.log('✅ 数据收集器已启动！');
console.log('👉 现在请手动点击每一个一级类目...');
console.log('👉 点完后，在控制台输入: exportCategories()');

// 导出函数
window.exportCategories = function() {
    const result = Array.from(allCategories.values());
    console.log(`📊 总共收集到 ${result.length} 个类目`);
    
    // 下载JSON
    const blob = new Blob([JSON.stringify(result, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `政采云全量类目_${result.length}条.json`;
    a.click();
    
    // 下载TXT
    let txt = 'ID\t类目名称\t父级ID\t类目编码\n';
    txt += '='.repeat(100) + '\n';
    result.forEach(item => {
        txt += `${item.id}\t${item.name}\t${item.parentId || item.pid || 0}\t${item.code || ''}\n`;
    });
    const txtBlob = new Blob([txt], {type: 'text/plain;charset=utf-8'});
    const txtUrl = URL.createObjectURL(txtBlob);
    const txtA = document.createElement('a');
    txtA.href = txtUrl;
    txtA.download = `政采云全量类目_${result.length}条.txt`;
    txtA.click();
    
    console.log('✅ 导出完成！');
    return result;
};
```

### 使用步骤：
1. 粘贴上面代码到控制台，按回车
2. 手动点击左侧的每一个一级类目（26个）
3. 每点一个，等2秒，让数据加载完
4. 点完后，在控制台输入：`exportCategories()`
5. 自动下载 JSON + TXT

---

## 📞 如果还是不行

请把以下信息发给我：

1. **页面URL**：你在哪个页面操作的？
2. **Network截图**：按F12，切到Network，刷新页面，截图发给我
3. **页面截图**：左侧菜单的样子
4. **控制台错误**：有没有红色报错？

我会根据实际情况给你定制方案！
