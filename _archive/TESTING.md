# 政采云智能助手 - 测试指南

## 🎯 测试目标

验证以下核心功能：
1. ✅ 后端 API（AI 分析、图片搜索、License 验证）
2. ✅ Chrome Extension 构建
3. ✅ 自动化上传流程（需要真实政采云页面）

---

## 📋 前置准备

### 1. 确保后端服务运行中

```bash
cd G:\gravops\zhengcaiyun-backend
pnpm dev
```

服务应该在 `http://localhost:3000` 运行。

### 2. 获取测试 License Key

运行以下脚本生成测试 License：

```bash
node scripts/test-db.mjs
```

记下输出的 License Key（格式：`TEST-xxxxxxxxxx`）

---

## 🧪 测试 1: 后端 API 功能

### 1.1 测试 AI 分析 API

```bash
node scripts/test-ai-api.mjs
```

**预期结果**：
```json
{
  "category": "办公设备/计算机/笔记本电脑",
  "riskLevel": "low",
  "reasoning": "Mock: Safe product",
  "suggestedAction": "direct_upload"
}
```

### 1.2 测试图片搜索 API

```bash
node scripts/test-crawler.mjs
```

**预期结果**：
```
✅ Success! Found 3 images.
First image: {
  url: 'https://img14.360buyimg.com/...',
  title: '联想ThinkPad X1 Carbon 2024款',
  source: 'jd'
}
```

### 1.3 测试 License 验证

打开浏览器，访问：
```
http://localhost:3000/api/verify-license
```

使用 POST 请求测试：
```json
{
  "licenseKey": "TEST-1763872629014",
  "companyName": "测试公司"
}
```

---

## 🔌 测试 2: Chrome Extension 加载

### 2.1 加载扩展到 Chrome

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择目录：`G:\gravops\zhengcaiyun-ai-assistant\build\chrome-mv3-prod`

### 2.2 验证扩展加载成功

- ✅ 扩展图标出现在工具栏
- ✅ 点击图标应弹出 Popup 界面
- ✅ 查看扩展详情，无错误提示

### 2.3 激活 License

1. 点击扩展图标
2. 输入 License Key: `TEST-1763872629014`
3. 输入公司名称: `测试公司`
4. 点击 **激活**

**预期结果**：显示 "激活成功" 提示

---

## 🚀 测试 3: 智能上传功能（模拟）

### 3.1 创建测试页面

由于无法直接访问政采云，我创建了一个模拟页面来测试 DOM 操作。

在浏览器控制台运行：

```javascript
// 模拟政采云表单
document.body.innerHTML = `
  <div>
    <h1>模拟政采云商品上传</h1>
    <input type="text" name="productName" placeholder="商品名称" />
    <div class="category-selector">选择类目</div>
    <div style="display:none;" class="category-options">
      <div class="category-option">办公设备</div>
      <div class="category-option">计算机</div>
      <div class="category-option">笔记本电脑</div>
    </div>
    <input type="file" accept="image/*" id="imageUpload" />
    <button type="submit" class="submit">提交</button>
  </div>
`;

document.querySelector('.category-selector').addEventListener('click', () => {
  document.querySelector('.category-options').style.display = 'block';
});
```

### 3.2 测试智能上传

在控制台运行：

```javascript
// 测试智能上传
window.zcyAssistant.smartUpload({
  productName: 'ThinkPad笔记本',
  licenseKey: 'TEST-1763872629014',
  enableAI: true,
  enableImageSearch: true,
  autoSubmit: false
}).then(result => {
  console.log('上传结果:', result);
});
```

**预期结果**：
```javascript
{
  success: true,
  steps: {
    aiAnalysis: {
      success: true,
      category: "办公设备/计算机/笔记本电脑",
      riskLevel: "low"
    },
    imageSearch: {
      success: true,
      imageCount: 3
    },
    fillForm: {
      success: true
    }
  }
}
```

---

## 🌐 测试 4: 真实政采云页面测试（可选）

### 4.1 访问政采云

1. 登录政采云平台: https://zcygov.cn
2. 进入商品上传页面
3. 打开浏览器控制台

### 4.2 检查扩展注入

查看是否出现：
- ✅ 右下角浮动按钮 "🤖 AI助手"
- ✅ 控制台输出: `[政采云智能助手] Content Script已加载`

### 4.3 手动触发上传

在控制台执行：

```javascript
chrome.runtime.sendMessage({
  action: 'startSmartUpload',
  data: {
    productName: '测试商品名称',
    licenseKey: 'TEST-1763872629014',
    enableAI: true,
    enableImageSearch: true,
    autoSubmit: false
  }
}, response => {
  console.log('响应:', response);
});
```

### 4.4 观察自动化过程

观察页面是否自动执行：
1. ✅ 填写商品名称
2. ✅ 打开类目选择器
3. ✅ 选择对应类目
4. ✅ 上传图片（如果有）

---

## 🐛 常见问题排查

### 问题 1: 后端 API 返回 500 错误

**原因**: OpenAI SDK 或其他依赖未加载

**解决**:
```bash
cd G:\gravops\zhengcaiyun-backend
pnpm install
# 重启服务
```

### 问题 2: Chrome Extension 加载失败

**原因**: 构建产物不完整

**解决**:
```bash
cd G:\gravops\zhengcaiyun-ai-assistant
pnpm install
pnpm build
```

### 问题 3: Content Script 未注入

**原因**: Manifest 权限配置或页面 URL 不匹配

**检查**:
- 确认在 `*.zcygov.cn` 域名下
- 查看 `chrome://extensions/` 中的错误日志

### 问题 4: DOM 选择器找不到元素

**原因**: 政采云页面结构与预期不符

**解决**:
1. 打开政采云页面
2. 在控制台运行: `document.querySelector('input[name="productName"]')`
3. 调整 `src/utils/zcy-dom.ts` 中的选择器数组

---

## 📊 测试检查清单

- [ ] 后端服务启动正常 (`http://localhost:3000`)
- [ ] 数据库初始化成功（有测试 License）
- [ ] AI 分析 API 返回正确结果
- [ ] 图片搜索 API 返回 Mock 数据
- [ ] Chrome Extension 构建成功
- [ ] Extension 加载到浏览器无错误
- [ ] License 激活成功
- [ ] 智能上传流程（模拟页面）成功
- [ ] 真实政采云页面注入成功（可选）
- [ ] 真实政采云自动化测试（可选）

---

## 📝 测试报告模板

完成测试后，请填写：

```
测试时间: ___________
测试人员: ___________

✅ 通过测试:
- [ ] 后端 API
- [ ] Extension 加载
- [ ] License 激活
- [ ] 模拟页面自动化
- [ ] 真实页面自动化

❌ 失败测试:
- 问题描述: ___________
- 错误信息: ___________
- 复现步骤: ___________

💡 改进建议:
___________
```

---

**准备好了吗？从测试 1 开始逐步验证！** 🚀
