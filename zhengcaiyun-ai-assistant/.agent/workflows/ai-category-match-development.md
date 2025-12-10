# 政采云自动类目匹配 + RPA 执行系统 - 完整实现方案

## 一、系统架构总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           政采云自动发布系统                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ① 权限层（服务器）        ② 类目推导层（服务器）       ③ RPA 执行层（插件）     │
│  ┌──────────────────┐    ┌──────────────────────┐    ┌──────────────────┐   │
│  │ 用户账号权限       │    │ 商品标题 + 完整类目    │    │ AI 指令执行器    │   │
│  │ (一级类目列表)     │ →  │ → 类目路径推导        │ →  │ 逐条执行 RPA     │   │
│  │                  │    │ → 品牌/型号提取       │    │                  │   │
│  └──────────────────┘    └──────────────────────┘    └──────────────────┘   │
│                                                                             │
│  ⚠ 类目从政采云完整类目.json 获取，绝不允许 AI 猜测                            │
│  ⚠ AI 只负责生成执行指令，不参与类目决策                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、核心数据源

### 2.1 政采云完整类目（固定，不可修改）

**文件位置**: `public/api/政采云完整类目.json`

**结构**:
```json
{
  "meta": {
    "name": "政采云完整类目树",
    "totalCategories": 16674,
    "level1Count": 13
  },
  "categories": [
    {
      "id": 1,
      "name": "办公设备",
      "level": 1,
      "children": [
        {
          "id": 101,
          "name": "办公用纸",
          "level": 2,
          "children": [
            { "id": 10101, "name": "打印/复印纸", "level": 3 },
            { "id": 10102, "name": "收银纸", "level": 3 }
          ]
        }
      ]
    }
  ]
}
```

### 2.2 用户权限（从数据库读取）

**表**: `UserCategoryPermission`

**字段**:
- `licenseKey`: 用户 License
- `level1Category`: 用户有权限的一级类目名称

**示例数据**:
```
licenseKey: "ABC123"
level1Category: "办公设备"

licenseKey: "ABC123"
level1Category: "3C数码"
```

---

## 三、完整 API 流程

### 3.1 类目匹配 API（已实现）

**端点**: `POST /api/category-match`

**请求**:
```json
{
  "licenseKey": "用户License",
  "productTitle": "得力A4复印纸70g 500张/包",
  "mode": "full"
}
```

**处理流程**:
1. 验证 License
2. 从数据库获取用户的一级类目权限列表
3. 加载 `政采云完整类目.json`
4. 预检：商品标题是否包含权限内类目的关键词
5. 深度匹配：在权限范围内的类目树中搜索最匹配的路径
6. 提取品牌和型号

**响应**:
```json
{
  "success": true,
  "data": {
    "productTitle": "得力A4复印纸70g 500张/包",
    "categoryPath": ["办公设备", "办公用纸", "打印/复印纸"],
    "brand": "得力",
    "model": "70g",
    "confidence": "high"
  }
}
```

### 3.2 RPA 指令生成 API（已实现）

**端点**: `POST /api/rpa-commands`

**请求**:
```json
{
  "categoryPath": ["办公设备", "办公用纸", "打印/复印纸"],
  "brand": "得力",
  "model": "70g",
  "productTitle": "得力A4复印纸70g 500张/包",
  "useAI": true
}
```

**处理流程**:
1. 检查学习记录缓存
2. 如果有成功记录，直接返回缓存的指令
3. 否则调用 AI 或模板生成指令

**响应**:
```json
{
  "success": true,
  "source": "template",
  "data": {
    "commands": [
      {"type": "OPEN_DIALOG"},
      {"type": "WAIT", "waitMs": 2000},
      {"type": "EXPAND_MARKET", "value": "网上超市"},
      {"type": "WAIT", "waitMs": 2000},
      {"type": "SELECT_BID", "value": "办公设备"},
      {"type": "CONFIRM_DIALOG"},
      {"type": "WAIT", "waitMs": 3000},
      {"type": "SELECT_CATEGORY", "value": "办公用纸"},
      {"type": "WAIT", "waitMs": 1500},
      {"type": "SELECT_CATEGORY", "value": "打印/复印纸"},
      {"type": "WAIT", "waitMs": 1500},
      {"type": "INPUT_BRAND", "value": "得力"},
      {"type": "WAIT", "waitMs": 500},
      {"type": "SELECT_BRAND", "value": "得力"},
      {"type": "WAIT", "waitMs": 1000},
      {"type": "INPUT_MODEL", "value": "70g"},
      {"type": "WAIT", "waitMs": 500},
      {"type": "SELECT_MODEL", "value": "70g"},
      {"type": "WAIT", "waitMs": 1000},
      {"type": "CLICK_NEXT"}
    ],
    "pathHash": "abc123"
  }
}
```

---

## 四、前端插件调用流程（已实现）

**文件**: `src/contents/publisher.tsx`

```typescript
// 1. 获取草稿
const draft = await fetchDraft(draftId);

// 2. 调用类目匹配 API（服务器决定类目，不是 AI 猜）
const aiResult = await fetch(`${BACKEND_URL}/api/category-match`, {
  method: 'POST',
  body: JSON.stringify({
    licenseKey,
    productTitle: draft.title,
    mode: 'full'
  })
});

// 3. 获取类目路径、品牌、型号（服务器返回的）
const { categoryPath, brand, model } = aiResult.data;

// 4. 调用 RPA 指令生成 API
const commandResult = await fetch(`${BACKEND_URL}/api/rpa-commands`, {
  method: 'POST',
  body: JSON.stringify({
    categoryPath,
    brand,
    model,
    productTitle: draft.title,
    useAI: true
  })
});

// 5. 执行 RPA 指令
const { commands } = commandResult.data;
await runAIPlan(commands);
```

---

## 五、RPA 执行器（已实现）

**文件**: `src/utils/ai-plan-executor.ts`

**核心函数**: `runAIPlan(commands)`

**指令类型**:
| 类型 | 说明 | 执行函数 |
|------|------|----------|
| `OPEN_DIALOG` | 打开电子卖场弹窗 | `executeOpenDialog()` |
| `EXPAND_MARKET` | 展开网上超市 | `executeExpandMarket(value)` |
| `SELECT_BID` | 选择标项（一级类目） | `executeSelectBid(value)` |
| `CONFIRM_DIALOG` | 点击确定 | `executeConfirmDialog()` |
| `SELECT_CATEGORY` | 选择类目 | `executeSelectCategory(value)` |
| `INPUT_BRAND` | 输入品牌 | `executeInputBrand(value)` |
| `SELECT_BRAND` | 选择品牌 | `executeSelectBrand(value)` |
| `INPUT_MODEL` | 输入型号 | `executeInputModel(value)` |
| `SELECT_MODEL` | 选择型号 | `executeSelectModel(value)` |
| `CLICK_NEXT` | 点击下一步 | `executeClickNext()` |
| `WAIT` | 等待 | `executeWait(waitMs)` |

---

## 六、点击方案（已实现）

**文件**: `src/utils/real-click-utils.ts`

### 6.1 forceReactClick（终极方案）

直接调用 React 内部的 onClick 处理函数：

```typescript
export function forceReactClick(el: HTMLElement) {
    const key = Object.keys(el).find(k =>
        k.startsWith("__reactEventHandlers") || 
        k.startsWith("__reactProps")
    );

    if (key && props.onClick) {
        props.onClick({...}); // 直接调用
        return true;
    }
    
    // fallback: realClick
    realClick(el);
}
```

### 6.2 expandRow（展开行）

按顺序尝试 5 种方法：
1. forceReactClick(展开图标)
2. forceReactClick(整行)
3. realClick(展开图标)
4. realClick(整行)
5. 双击

---

## 七、当前文件结构

```
zhengcaiyun-backend/
├── app/api/
│   ├── category-match/route.ts    # 类目匹配 API ✅
│   └── rpa-commands/route.ts      # RPA 指令生成 API ✅
├── lib/
│   ├── ai-command-generator.ts    # AI 指令生成 ✅
│   └── rpa-protocol.ts            # RPA 协议定义
└── public/api/
    └── 政采云完整类目.json         # 完整类目（不可修改） ✅

zhengcaiyun-ai-assistant/
└── src/
    ├── contents/
    │   └── publisher.tsx          # 插件入口 ✅
    └── utils/
        ├── ai-plan-executor.ts    # 主执行器 ✅
        ├── ai-command-handlers.ts # 指令处理函数 ✅
        ├── ai-command-brand-model.ts # 品牌型号处理 ✅
        └── real-click-utils.ts    # 真实点击工具 ✅
```

---

## 八、核心原则（不可违反）

1. **类目来源唯一**：只能从 `政采云完整类目.json` 获取
2. **类目决策在服务器**：`/api/category-match` 负责决定类目，不是 AI 猜
3. **权限过滤强制**：必须先获取用户权限，只在权限范围内匹配
4. **AI 只生成指令**：AI 不参与类目推测，只负责生成 RPA 执行步骤
5. **指令格式固定**：所有指令必须是标准格式，不允许 AI 自创新类型

---

## 九、测试检查清单

1. [ ] 服务器 `pnpm dev` 已启动
2. [ ] 插件已重新构建 `pnpm build`
3. [ ] 插件已在 Chrome 中刷新
4. [ ] 用户有类目权限记录（数据库中有 UserCategoryPermission）
5. [ ] 控制台显示 `[AI执行器] ▶ runAIPlan 已被调用`
6. [ ] 控制台显示完整的指令表格
7. [ ] 每个步骤都有 `[AI执行器] > 执行动作: XXX` 日志
