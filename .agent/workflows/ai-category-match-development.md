# 政采云AI类目匹配自动发布系统 - 开发接力文档

## 📍 当前状态：RPA V6 已集成，但类目匹配仍有问题

---

## 🔴 当前错误

从日志可以看到：
```
[RPA V6] AI 路径: 办公设备 > 点/验钞/戳机及配件 > 点砂机
[RPA V6] Level 1 实时读取: 6 项
[RPA V6] 匹配 "办公设备" → "橡胶及塑料制品" (0%)
[RPA V6] 候选: [橡胶及塑料制品, 橡胶及塑料制品, 文化用品, 文化用品, 文化玩乐...]
[RPA V6] 类目选择失败：无法匹配类目：办公设备
```

### 问题分析

1. **AI 返回的类目路径是 "办公设备 > ..."**
2. **但页面上显示的一级类目是 "橡胶及塑料制品"、"文化用品"、"文化玩乐"**
3. **这是因为选择了"办公用品"标项，其下的一级类目不包含"办公设备"**

---

## 🔵 系统架构

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  政采云完整类目.json │     │   标项映射.json    │     │ 用户权限数据库    │
│  (144个一级类目)    │     │ (标项→一级类目映射) │     │ UserCategoryPerm │
└────────┬────────┘     └────────┬─────────┘     └────────┬────────┘
         │                       │                        │
         ▼                       ▼                        ▼
┌────────────────────────────────────────────────────────────────────┐
│                    后端 API: /api/category-match                    │
│  1. 验证License获取用户权限                                          │
│  2. 预检（suggestedCategory）                                        │
│  3. 过滤类目树（只保留用户有权限的）                                   │
│  4. 关键词匹配 or AI匹配                                             │
│  5. 返回: { categoryPath, bid, brand, model }                       │
└────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│                    前端 RPA V6 执行引擎                              │
│  1. 前置流程: 打开弹窗 → 展开市场 → 选标项 → 确定                     │
│  2. 类目选择: Level1 → Level2 → Level3 (每次重新读取DOM)             │
│  3. 属性填写: 品牌、型号                                             │
│  4. 下一步 → 发布                                                   │
└────────────────────────────────────────────────────────────────────┘
```

---

## 🟡 关键文件

### 后端
| 文件 | 作用 |
|------|------|
| `zhengcaiyun-backend/lib/ai-category-match.ts` | AI类目匹配逻辑，加载标项映射 |
| `zhengcaiyun-backend/app/api/category-match/route.ts` | 类目匹配API入口 |
| `zhengcaiyun-backend/public/api/政采云完整类目.json` | 完整类目树(144个一级) |
| `zhengcaiyun-backend/public/api/标项映射.json` | 标项→一级类目映射 |

### 前端
| 文件 | 作用 |
|------|------|
| `zhengcaiyun-ai-assistant/src/utils/rpa-v6-engine.ts` | RPA V6 核心引擎 |
| `zhengcaiyun-ai-assistant/src/utils/rpa-v5-main.ts` | 统一入口 |
| `zhengcaiyun-ai-assistant/src/utils/rpa-v5-preflow.ts` | 前置流程(弹窗/标项选择) |
| `zhengcaiyun-ai-assistant/src/contents/publisher.tsx` | 发布页面入口 |

---

## 🔴 核心问题：类目映射不一致

### 标项映射.json 定义
```json
{
  "办公用品": {
    "level1Categories": ["橡胶及塑料制品", "文化用品", "文化玩乐"]
  },
  "办公设备": {
    "level1Categories": ["办公设备/耗材"]
  }
}
```

### 政采云完整类目.json 中的一级类目 (部分)
```
办公设备/耗材
机电设备
教学科研
文化用品
橡胶及塑料制品
文化玩乐
日用百货
五金/工具
...
```

### 问题
1. 用户选择了"办公用品"标项
2. AI返回 `办公设备 > 点/验钞/戳机及配件 > 点砂机`
3. 但"办公设备"不在"办公用品"标项下！
4. 页面上显示的是"橡胶及塑料制品"、"文化用品"、"文化玩乐"
5. RPA无法匹配"办公设备"

---

## 🟢 已完成的修复

### 1. RPA V6 引擎 (rpa-v6-engine.ts)
- ✅ 每次点击后重新读取DOM
- ✅ 解决React重绘问题
- ✅ 智能相似度匹配

### 2. 前置流程 (rpa-v5-preflow.ts)
- ✅ 多种选择器支持标项选择
- ✅ 不再跳过前置流程

### 3. 后端模糊匹配 (route.ts)
- ✅ 标项名"办公设备"匹配类目名"办公设备/耗材"
- ✅ 一级类目模糊匹配

---

## 🔴 待解决的问题

### 1. AI 返回的类目路径与选择的标项不匹配

**原因**: AI从整个类目树中匹配，没有限制在当前标项下

**解决方案**: 
- AI匹配时，根据预检的suggestedCategory过滤类目树
- 或者AI匹配时传入当前标项，只从该标项下的类目中选择

### 2. categoryPath验证

**已添加**: 前端验证categoryPath至少2级，否则报错

```typescript
if (!categoryPath || !Array.isArray(categoryPath) || categoryPath.length < 2) {
    showError(`类目路径不完整: ${JSON.stringify(categoryPath)}`)
    return
}
```

---

## 🔧 下一步修复建议

### 方案A: 让AI从正确的标项下选择

修改 `ai-category-match.ts` 的 `matchCategoryWithAI` 函数：
1. 接收 `bid` (标项名) 参数
2. 根据标项映射，获取该标项下的一级类目
3. 只从这些一级类目及其子类目中匹配

### 方案B: 前端智能纠正

在 `publisher.tsx` 中：
1. 如果AI返回的一级类目不在当前标项下
2. 自动从标项映射中找正确的一级类目
3. 重新匹配

---

## 📋 测试步骤

1. 启动后端: `cd zhengcaiyun-backend && pnpm dev`
2. 构建前端: `cd zhengcaiyun-ai-assistant && pnpm build`
3. 刷新Chrome扩展
4. 打开政采云发布页面
5. 查看Console日志

---

## 🧪 调试命令

```bash
# 查看一级类目
cd zhengcaiyun-backend
node -e "const d=require('./public/api/政采云完整类目.json'); d.categories.filter(c=>c.level===1).forEach(c=>console.log(c.name));"

# 查看用户权限
node check-perms.js
```

---

## 📌 环境变量

```
DEEPSEEK_API_KEY=sk-xxx (AI提供商)
AI_PROVIDER=deepseek
```

---

## 🔗 关键接口

```typescript
// AI匹配返回
interface CategoryMatchResult {
    path: string[]       // 类目路径 ["文化用品", "教学用具", "黑板"]
    confidence: string   // high/medium/low
    reason: string
    bid?: string         // 标项名
}

// RPA V6 入口参数
interface FullAIResult {
    bid: string                    // 标项
    categoryPath: string[]         // 类目路径
    attributes: Array<{label, value}>
    images?: string[]
    title?: string
}
```
