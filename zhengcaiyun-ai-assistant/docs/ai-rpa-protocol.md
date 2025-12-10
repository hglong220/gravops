# AI → RPA 统一指令协议

## 概述
定义 AI 输出给 RPA 执行的标准化指令格式，RPA 必须严格按指令逐条执行。

---

## 指令格式

```json
{
    "category_path": ["一级类目", "二级类目", "三级类目", "四级类目", "五级类目"],
    "brand": "品牌名",
    "model": "型号名",
    "useCategory": true
}
```

---

## 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `category_path` | `string[]` | ✅ 是 | 类目路径数组，1-5级，按顺序排列 |
| `brand` | `string \| null` | ✅ 是 | 品牌名称，null 表示选"无品牌" |
| `model` | `string \| null` | ✅ 是 | 型号名称，null 表示需人工填写 |
| `useCategory` | `boolean` | ✅ 是 | 是否执行类目选择，false 时跳过类目 |

---

## 完整指令结构（扩展版）

```typescript
interface AiToRpaCommand {
    // ===== 必填字段 =====
    
    /** 类目路径，1-5级 */
    category_path: string[]
    
    /** 品牌名称，null = 选择"无品牌" */
    brand: string | null
    
    /** 型号名称，null = 需人工 */
    model: string | null
    
    /** 是否执行类目选择 */
    useCategory: boolean
    
    // ===== 可选字段 =====
    
    /** AI 对类目匹配的置信度 0-1 */
    confidence?: number
    
    /** 是否需要人工介入 */
    require_manual?: boolean
    
    /** 人工介入原因 */
    manual_reason?: string
    
    /** 型号候选列表（供人工选择） */
    model_suggestions?: string[]
    
    /** 额外属性填写 */
    extra_attrs?: Record<string, string>
}
```

---

## 执行顺序

RPA 收到指令后，**必须按以下顺序执行**：

```
┌─────────────────────────────────────────────────────────┐
│  RPA 执行顺序                                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Step 1: 解析指令                                       │
│  ──────────────────                                     │
│  - 验证 JSON 格式                                       │
│  - 检查必填字段                                         │
│  - 若格式错误 → 立即报错                               │
│                                                         │
│  Step 2: 类目选择（若 useCategory = true）              │
│  ──────────────────────────────────                     │
│  - 严格按 category_path 逐级点击                       │
│  - 找不到 → 立即报错（参见任务3）                      │
│  - 每级验证选中状态                                     │
│                                                         │
│  Step 3: 填写品牌                                       │
│  ────────────────                                       │
│  - IF brand != null:                                   │
│      打开品牌下拉 → 搜索/选择品牌                      │
│  - IF brand == null:                                   │
│      选择"无品牌"或勾选"无品牌"复选框                 │
│  - 验证品牌已填写                                       │
│                                                         │
│  Step 4: 填写型号                                       │
│  ────────────────                                       │
│  - IF model != null:                                   │
│      打开型号下拉 → 搜索/选择型号                      │
│  - IF model == null && require_manual:                 │
│      停止执行 → 通知用户手动填写                       │
│  - 验证型号已填写                                       │
│                                                         │
│  Step 5: 填写额外属性（若有）                           │
│  ────────────────────────                               │
│  - FOR each attr in extra_attrs:                       │
│      找到对应表单字段 → 填写值                         │
│                                                         │
│  Step 6: 完成或暂停                                     │
│  ──────────────────                                     │
│  - IF require_manual:                                  │
│      暂停，提示用户："请手动填写型号后继续"            │
│  - ELSE:                                               │
│      点击"下一步"或"保存"                              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 指令示例

### 示例 1：完全自动化
```json
{
    "category_path": ["办公设备/耗材", "打印机及配件", "激光打印机"],
    "brand": "惠普",
    "model": "LaserJet Pro M404dn",
    "useCategory": true,
    "confidence": 0.95,
    "require_manual": false
}
```
→ RPA 全自动执行：选类目 → 选品牌 → 选型号 → 下一步

---

### 示例 2：型号需人工
```json
{
    "category_path": ["办公设备/耗材", "办公用纸", "打印/复印纸"],
    "brand": "得力",
    "model": null,
    "useCategory": true,
    "confidence": 0.88,
    "require_manual": true,
    "manual_reason": "采集型号不在下拉列表中",
    "model_suggestions": ["7401", "7402", "7403"]
}
```
→ RPA 执行到型号时暂停，提示用户选择

---

### 示例 3：无品牌
```json
{
    "category_path": ["日用百货", "清洁用品", "垃圾袋"],
    "brand": null,
    "model": "中号加厚款",
    "useCategory": true,
    "confidence": 0.72,
    "require_manual": false
}
```
→ RPA 选择"无品牌"，型号直接填写

---

### 示例 4：跳过类目（已选好）
```json
{
    "category_path": [],
    "brand": "佳能",
    "model": "MF113w",
    "useCategory": false,
    "require_manual": false
}
```
→ RPA 跳过类目选择，只填品牌和型号

---

## 错误处理

RPA 遇到以下情况必须停止并报告：

| 错误码 | 说明 | 用户提示 |
|-------|------|---------|
| `INVALID_COMMAND` | 指令格式错误 | "AI 指令解析失败" |
| `CATEGORY_NOT_FOUND` | 类目路径中某级不存在 | "第X级类目不存在：XXX" |
| `BRAND_NOT_FOUND` | 品牌不在列表中 | "品牌不存在：XXX" |
| `MODEL_NOT_FOUND` | 型号不在列表中 | "型号不存在：XXX" |
| `PAGE_TIMEOUT` | 页面加载超时 | "页面响应超时" |
| `UNEXPECTED_PAGE` | 不在预期页面 | "当前页面不是发布页" |

---

## RPA 返回格式

执行完成后，RPA 向系统报告：

```typescript
interface RpaExecutionResult {
    /** 是否成功 */
    success: boolean
    
    /** 实际执行的操作 */
    executed: {
        category?: string[]    // 实际选中的类目
        brand?: string         // 实际填写的品牌
        model?: string         // 实际填写的型号
    }
    
    /** 失败信息 */
    error?: {
        code: string
        message: string
        failedStep: 'category' | 'brand' | 'model' | 'other'
        failedAt?: number      // 失败在第几级（类目）
    }
    
    /** 是否需要人工继续 */
    pendingManual: boolean
    
    /** 执行日志 */
    log: string[]
}
```

---

## 协议版本

```
Version: 1.0
Last Updated: 2025-12-08
```

---

## 对接流程图

```
┌──────────────┐      指令JSON      ┌──────────────┐
│              │  ───────────────>  │              │
│   AI 服务    │                    │   RPA 执行   │
│              │  <───────────────  │              │
└──────────────┘    执行结果JSON    └──────────────┘
       │                                   │
       │                                   │
       v                                   v
  ┌─────────┐                        ┌─────────┐
  │ 类目树  │                        │ ZCY页面 │
  │ 匹配    │                        │ 操作    │
  └─────────┘                        └─────────┘
```
