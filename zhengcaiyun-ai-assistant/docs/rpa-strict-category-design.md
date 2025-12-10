# RPA 严格类目选择模块 - 框架设计

## 任务目标
RPA **100% 听从 AI 指令**，严格按 `category_path` 逐级点击，绝不乱点、跳级、猜测。

---

## 核心原则

1. **找不到 = 立即报错**（不继续、不跳过）
2. **每级点击后必须验证**（确认展开/选中）
3. **三层找不到判定**（渲染、滚动、虚拟列表）
4. **所有操作可追溯**（详细日志）

---

## 函数结构

### 主入口函数

```
executeStrictCategorySelection(command: AiCategoryCommand): Promise<StrictSelectionResult>
```

**输入**:
```typescript
interface AiCategoryCommand {
    category_path: string[]   // AI 指定的类目路径，如 ["办公设备/耗材", "打印机及配件", "激光打印机"]
    confidence: number        // AI 置信度
}
```

**输出**:
```typescript
interface StrictSelectionResult {
    success: boolean
    selectedPath: string[]    // 实际选中的路径
    failedAt?: number         // 失败在第几级（1-based）
    failedReason?: FailReason // 失败原因枚举
    log: string[]             // 执行日志
}

enum FailReason {
    LEVEL_NOT_FOUND = 'LEVEL_NOT_FOUND',           // 该级类目不存在
    RENDER_NOT_COMPLETE = 'RENDER_NOT_COMPLETE',   // DOM 渲染未完成
    NOT_IN_VIEWPORT = 'NOT_IN_VIEWPORT',           // 元素不在可视区域
    VIRTUAL_SCROLL_NOT_LOADED = 'VIRTUAL_SCROLL_NOT_LOADED', // 虚拟滚动未加载
    CLICK_NOT_EFFECTIVE = 'CLICK_NOT_EFFECTIVE',   // 点击后未响应
    EXPAND_FAILED = 'EXPAND_FAILED',               // 下一级未展开
    TIMEOUT = 'TIMEOUT'                            // 等待超时
}
```

---

### 步骤函数

#### 1. 等待类目区域就绪
```
waitForCategoryAreaReady(): Promise<HTMLElement>
```
- 等待类目选择容器出现
- 超时报错

#### 2. 逐级选择（核心循环）
```
selectLevelByLevel(categoryPath: string[]): Promise<void>
```
- 循环 `categoryPath[0]` → `categoryPath[n]`
- 每一级调用 `selectSingleLevel()`
- 任何一级失败 → **立即抛出错误，不继续**

#### 3. 单级选择（最核心）
```
selectSingleLevel(levelIndex: number, categoryName: string): Promise<void>
```

**流程**:
```
1. waitForLevelContainer(levelIndex)    // 等待该级列表容器
2. findCategoryItem(categoryName)       // 在列表中查找目标
   └─ 找不到 → 进入三层判定 ↓
3. scrollToItem(item)                   // 滚动到可见
4. clickItem(item)                      // 点击
5. verifySelection(levelIndex, name)    // 验证选中
   └─ 未选中 → 重试或报错
6. waitForNextLevelExpand(levelIndex)   // 等待下一级展开
   └─ 未展开 → 报错
```

---

### 三层找不到判定

```
findCategoryItemWithRetry(container, categoryName): HTMLElement | null
```

**第一层：渲染未完成**
```
checkRenderComplete(container): boolean
```
- 检查 DOM 节点数量是否稳定
- 检查 loading 状态是否消失
- 不完成 → 等待并重试

**第二层：不在可视区域（需滚动）**
```
scrollAndSearch(container, categoryName): HTMLElement | null
```
- 分段滚动 container
- 每段滚动后重新搜索
- 滚到底还没找到 → 进入第三层

**第三层：虚拟滚动未加载**
```
triggerVirtualScrollLoad(container): void
```
- 检测是否虚拟列表 (el-virtual-scroll, react-window 等)
- 触发强制加载
- 加载后重新搜索
- 仍找不到 → **最终报错: LEVEL_NOT_FOUND**

---

### 验证函数

#### 验证选中状态
```
verifySelection(levelIndex: number, expectedName: string): boolean
```
- 检查元素是否有 `.is-active`, `.selected`, `[aria-selected="true"]`
- 检查文本是否匹配
- 不匹配 → 报错

#### 验证下一级展开
```
verifyNextLevelExpanded(levelIndex: number): boolean
```
- 检查下一级容器是否出现
- 检查下一级是否有内容
- 未展开 → 报错

---

## 执行流程图

```
┌─────────────────────────────────────────────────────────┐
│  executeStrictCategorySelection(command)                │
│    ├── 1. 验证 command.category_path 非空              │
│    ├── 2. waitForCategoryAreaReady()                   │
│    └── 3. FOR i = 0 to path.length - 1:                │
│            │                                            │
│            ├── selectSingleLevel(i, path[i])           │
│            │     ├── waitForLevelContainer(i)          │
│            │     ├── findCategoryItemWithRetry()       │
│            │     │     ├── [层1] checkRenderComplete   │
│            │     │     ├── [层2] scrollAndSearch       │
│            │     │     └── [层3] triggerVirtualScroll  │
│            │     ├── 找不到? → throw LEVEL_NOT_FOUND   │
│            │     ├── clickItem()                       │
│            │     ├── verifySelection()                 │
│            │     │     └── 未选中? → throw CLICK_FAIL  │
│            │     └── verifyNextLevelExpanded()         │
│            │           └── 未展开? → throw EXPAND_FAIL │
│            │                                            │
│            └── 成功 → 继续下一级                        │
│                                                         │
│    4. 全部成功 → return { success: true }              │
└─────────────────────────────────────────────────────────┘
```

---

## 日志规范

每一步操作都必须记录：
```
[RPA][Level 1] 正在选择: 办公设备/耗材
[RPA][Level 1] 容器就绪，共 12 个选项
[RPA][Level 1] 找到目标，位置: 第3项
[RPA][Level 1] 点击成功
[RPA][Level 1] ✓ 选中验证通过
[RPA][Level 1] ✓ 下一级已展开

[RPA][Level 2] 正在选择: 打印机及配件
[RPA][Level 2] 需要滚动搜索...
[RPA][Level 2] 滚动 50%，未找到
[RPA][Level 2] 滚动 100%，找到

[RPA][Level 3] ✗ 错误: 未找到类目 "激光打印机123"
[RPA][Level 3] 三层判定结果: LEVEL_NOT_FOUND
[RPA] 执行中止，返回错误
```

---

## 绝对禁止的行为

| 禁止行为 | 说明 |
|---------|------|
| ❌ 自动猜测相似类目 | 找不到就报错，不找相近的 |
| ❌ 跳过某一级 | 必须按顺序逐级点击 |
| ❌ 静默失败 | 必须抛出明确错误 |
| ❌ 多次乱点尝试 | 只点 AI 指定的那个 |
| ❌ 使用模糊匹配 | 必须精确匹配类目名 |

---

## 与 AI 指令的对接

```typescript
// AI 返回的指令
const aiCommand = {
    category_path: ["办公设备/耗材", "打印机及配件", "激光打印机"],
    confidence: 0.92
}

// RPA 严格执行
const result = await executeStrictCategorySelection(aiCommand)

if (!result.success) {
    // 报告给用户，不自动处理
    showError(`类目选择失败: 第${result.failedAt}级 "${aiCommand.category_path[result.failedAt-1]}" - ${result.failedReason}`)
}
```
