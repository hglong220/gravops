# 后端 API 使用手册

## 基础信息

- **Base URL**: `http://localhost:3000` (开发环境)
- **Content-Type**: `application/json`
- **认证方式**: License Key 验证

---

## 📌 核心 API 列表

### 1. License 验证

**验证 License 是否有效**

```http
POST /api/verify-license
Content-Type: application/json

{
  "licenseKey": "ZCAI-XXXX-XXXX-XXXX-XXXX",
  "companyName": "杭州政采云科技有限公司"
}
```

**响应示例**：
```json
{
  "valid": true,
  "companyName": "杭州政采云科技有限公司",
  "expiresAt": 1735660800000,
  "plan": "professional"
}
```

---

### 2. AI 商品分析

**分析商品风险和类目**

```http
POST /api/ai/analyze
Content-Type: application/json

{
  "productName": "联想ThinkPad X1 Carbon 笔记本电脑",
  "description": "14英寸轻薄商务本 酷睿i7 16G 512G",
  "licenseKey": "ZCAI-XXXX-XXXX-XXXX-XXXX"
}
```

**响应示例**：
```json
{
  "category": "办公设备/计算机/笔记本电脑",
  "riskLevel": "low",
  "reasoning": "普通办公用品，无敏感关键词",
  "suggestedAction": "direct_upload"
}
```

**参数说明**：
- `productName` (必填): 商品名称
- `description` (可选): 商品描述
- `licenseKey` (必填): 用户的 License Key

**suggestedAction 取值**：
- `direct_upload` - 直接上传
- `trojan_strategy` - 建议使用木马策略
- `manual_review` - 需要人工审核

---

### 3. 图片搜索

**根据关键词搜索商品图片**

```http
GET /api/search-images?keyword=ThinkPad&licenseKey=ZCAI-XXXX-XXXX-XXXX-XXXX
```

**响应示例**：
```json
{
  "keyword": "ThinkPad",
  "count": 3,
  "images": [
    {
      "url": "https://img14.360buyimg.com/n1/s450x450_jfs/...",
      "title": "联想ThinkPad X1 Carbon 2024款",
      "source": "jd"
    },
    {
      "url": "https://img14.360buyimg.com/n1/s450x450_jfs/...",
      "title": "ThinkPad T14 Gen3 酷睿i7",
      "source": "jd"
    }
  ]
}
```

**参数说明**：
- `keyword` (必填): 搜索关键词
- `licenseKey` (必填): 用户的 License Key

---

## 🔐 用户认证 API

### 1. 用户注册

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "SecurePassword123",
  "name": "张三",
  "companyName": "杭州测试科技有限公司",
  "creditCode": "91330100MA27XXXXXX",
  "phone": "13800138000"
}
```

**响应示例**：
```json
{
  "message": "注册成功",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "clxxx...",
    "email": "admin@example.com",
    "name": "张三",
    "companyName": "杭州测试科技有限公司"
  }
}
```

---

### 2. 用户登录

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "SecurePassword123"
}
```

**响应示例**：
```json
{
  "message": "登录成功",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "clxxx...",
    "email": "admin@example.com",
    "name": "张三",
    "companyName": "杭州测试科技有限公司"
  }
}
```

---

## 🛠️ Chrome Extension 集成示例

### 存储 License Key

```javascript
// background.js
chrome.storage.local.set({
  licenseKey: 'ZCAI-XXXX-XXXX-XXXX-XXXX',
  companyName: '杭州政采云科技有限公司'
});
```

### 调用 AI 分析 API

```javascript
// content.js
async function analyzeProduct(productName) {
  const { licenseKey } = await chrome.storage.local.get('licenseKey');
  
  const response = await fetch('http://localhost:3000/api/ai/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productName,
      licenseKey
    })
  });
  
  const result = await response.json();
  console.log('AI 分析结果:', result);
  
  return result;
}
```

### 调用图片搜索 API

```javascript
async function searchProductImages(keyword) {
  const { licenseKey } = await chrome.storage.local.get('licenseKey');
  
  const response = await fetch(
    `http://localhost:3000/api/search-images?keyword=${encodeURIComponent(keyword)}&licenseKey=${licenseKey}`
  );
  
  const result = await response.json();
  console.log('找到图片:', result.images);
  
  return result.images;
}
```

---

## ❌ 错误处理

所有 API 在出错时返回统一格式：

```json
{
  "error": "错误描述信息"
}
```

**常见错误码**：
- `400` - 请求参数错误
- `401` - 授权无效或已过期
- `403` - 公司名称不匹配
- `404` - 资源不存在
- `500` - 服务器内部错误

---

## 📝 注意事项

1. **License Key 安全**
   - 不要在前端代码中硬编码 License Key
   - 使用 `chrome.storage.local` 安全存储
   - 定期验证 License 有效性

2. **API 限流**
   - 生产环境将实施 API 限流
   - 建议实现本地缓存减少请求

3. **跨域问题**
   - 开发环境已配置 CORS
   - Chrome Extension 需在 manifest.json 中声明权限

---

**API 版本**: v1.0  
**最后更新**: 2025-11-23
