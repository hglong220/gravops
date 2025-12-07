# 三层类目匹配 API v2 - 使用指南

## 架构概述

```
商品标题 → [第1层] 模板缓存 → 命中? → 返回结果 ✓
           ↓ 未命中
        [第2层] 本地规则匹配 → 置信度高? → 保存+返回 ✓
           ↓ 低
        [第3层] DeepSeek AI → 筛选20个候选 → 选最佳 → 保存+返回 ✓
```

**省钱效果：**
- 第1层命中率：60-80% (0成本)
- 第2层命中率：15-25% (0成本)
- 第3层才调用AI：5-20% (低成本，每次只发20个候选)

## API 端点

```
POST /api/category-match-v2
```

## 请求参数

```json
{
  "licenseKey": "xxx",
  "title": "得力(deli) A4复印纸 70g 500张/包",
  "platform": "JD",  // 可选
  "brand": "得力"     // 可选
}
```

## 响应示例

### 成功（模板缓存命中）

```json
{
  "success": true,
  "data": {
    "categoryPath": ["办公设备/耗材", "办公用纸", "打印/复印纸"],
    "confidence": 0.95,
    "source": "template"
  },
  "logs": [
    "[匹配] 标题: 得力(deli) A4复印纸 70g 500张/包",
    "[关键词] a4复印纸",
    "[第1层] 查询模板缓存...",
    "[第1层] ✓ 命中缓存! 路径: 办公设备/耗材 > 办公用纸 > 打印/复印纸",
    "[第1层] 历史命中次数: 125"
  ],
  "meta": {
    "version": "v2",
    "timestamp": "2025-12-08T02:00:00.000Z"
  }
}
```

### 成功（规则匹配）

```json
{
  "success": true,
  "data": {
    "categoryPath": ["五金/工具", "电动工具", "电钻"],
    "confidence": 0.82,
    "source": "rule"
  },
  "logs": [
    "[匹配] 标题: 博世(BOSCH) 电动冲击钻 GSB550",
    "[关键词] 博世 电动 冲击钻",
    "[第1层] 查询模板缓存...",
    "[第1层] 缓存未命中",
    "[第2层] 本地规则匹配...",
    "[第2层] ✓ 规则匹配成功! 置信度: 0.82",
    "[第2层] 路径: 五金/工具 > 电动工具 > 电钻",
    "[第2层] 已保存到模板库"
  ]
}
```

### 成功（AI匹配）

```json
{
  "success": true,  
  "data": {
    "categoryPath": ["日用百货", "清洁用品", "垃圾袋"],
    "confidence": 0.85,
    "source": "ai"
  },
  "logs": [
    "[匹配] 标题: 家用加厚垃圾袋黑色50*60cm",
    "[关键词] 家用 加厚 垃圾袋",
    "[第1层] 查询模板缓存...",
    "[第1层] 缓存未命中",
    "[第2层] 本地规则匹配...",
    "[第2层] 规则匹配置信度较低: 0.45",
    "[第3层] 准备调用 DeepSeek...",
    "[第3层] 筛选出 20 个候选",
    "[第3层] ✓ DeepSeek 匹配成功!",
    "[第3层] 路径: 日用百货 > 清洁用品 > 垃圾袋",
    "[第3层] 已保存到模板库"
  ]
}
```

## 环境配置

在 `.env` 文件中添加：

```bash
DEEPSEEK_API_KEY=sk-xxxxxxxxxx
```

## 前端调用示例

```typescript
async function matchCategory(title: string, brand?: string) {
  const response = await fetch('/api/category-match-v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      licenseKey: 'your-license-key',
      title,
      platform: 'JD',
      brand
    })
  });

  const result = await response.json();
  
  if (result.success) {
    console.log('匹配来源:', result.data.source);
    console.log('类目路径:', result.data.categoryPath);
    console.log('置信度:', result.data.confidence);
    console.log('详细日志:', result.logs);
  }
}
```

## 数据库表

### CategoryTemplate（模板缓存）

| 字段 | 说明 |
|------|------|
| titleKey | 标题关键词（如 "a4复印纸"） |
| platform | 平台（JD/TMALL/etc） |
| brand | 品牌 |
| categoryPath | 类目路径JSON |
| hitCount | 命中次数 |
| confidence | 置信度 |
| source | 来源（template/rule/ai） |

### UserCategoryPermission（用户权限）

| 字段 | 说明 |
|------|------|
| licenseKey | 许可证Key |
| level1Category | 一级类目名 |
| subCategories | 子类目JSON |

## 性能优化

1. **模板库预热**：手动添加常见商品的模板
2. **定期清理**：清除 hitCount=1 且创建时间>30天的模板
3. **批量匹配**：同时匹配多个商品时，共享类目树缓存

## 费用估算

假设每天处理 10,000 个商品链接：

- 第1层命中（70%）：7,000个，成本 ¥0
- 第2层命中（20%）：2,000个，成本 ¥0
- 第3层AI（10%）：1,000个，成本 ≈ ¥0.2（每次0.0002元）

**总成本：每天 ¥0.2**

相比全量调用AI（每天约 ¥20），**节省99%费用**。
