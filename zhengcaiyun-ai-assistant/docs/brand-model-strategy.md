# AI 品牌与型号选择策略

## 目标
自动填写品牌和型号字段，有 fallback 机制，无法确定时交给人工。

---

## 输出格式

```json
{
    "brand": "得力",
    "model": "DL-888B",
    "require_manual": false
}
```

或：

```json
{
    "brand": "得力",
    "model": null,
    "require_manual": true,
    "manual_reason": "采集型号不在下拉列表中，近似匹配也失败"
}
```

---

## 品牌选择策略

### 流程

```
1. 获取采集品牌 (scraped_brand)
2. 获取 ZCY 页面品牌下拉列表 (zcy_brand_list)
3. 执行匹配 ↓

┌─────────────────────────────────────────────────────────┐
│  品牌匹配流程                                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Step 1: 精确匹配                                       │
│  ─────────────────                                      │
│  IF scraped_brand IN zcy_brand_list:                   │
│      → 选择该品牌 ✓                                     │
│                                                         │
│  Step 2: 归一化匹配                                     │
│  ─────────────────                                      │
│  归一化规则:                                            │
│    - 统一大小写                                         │
│    - 去除空格、特殊符号                                 │
│    - 中英文品牌对照 (如 "惠普" = "HP")                  │
│                                                         │
│  IF normalize(scraped_brand) == normalize(zcy_brand):  │
│      → 选择该品牌 ✓                                     │
│                                                         │
│  Step 3: 包含匹配                                       │
│  ─────────────────                                      │
│  IF any zcy_brand CONTAINS scraped_brand:              │
│      → 选择该品牌 ✓                                     │
│  IF scraped_brand CONTAINS any zcy_brand:              │
│      → 选择该品牌 ✓                                     │
│                                                         │
│  Step 4: 无品牌兜底                                     │
│  ─────────────────                                      │
│  IF zcy_brand_list 有 "无品牌" 或 "其他":              │
│      → 选择 "无品牌" ✓                                  │
│  ELSE:                                                  │
│      → require_manual = true                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 品牌归一化对照表

| 采集品牌 | 归一化 | ZCY品牌 |
|---------|--------|---------|
| HP | hp | 惠普 |
| 惠普 | hp | 惠普 |
| DELL | dell | 戴尔 |
| Lenovo | lenovo | 联想 |
| Canon | canon | 佳能 |
| EPSON | epson | 爱普生 |
| Brother | brother | 兄弟 |
| 得力 | deli | 得力 |
| 齐心 | comix | 齐心 |
| 晨光 | mg | 晨光 |

---

## 型号选择策略

### 流程

```
1. 获取采集型号 (scraped_model)
2. 从标题提取备用型号 (title_model)
3. 获取 ZCY 页面型号下拉列表 (zcy_model_list)
4. 执行匹配 ↓

┌─────────────────────────────────────────────────────────┐
│  型号匹配流程                                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Step 1: 精确匹配（采集型号）                           │
│  ─────────────────────────                              │
│  IF scraped_model IN zcy_model_list:                   │
│      → 选择该型号 ✓                                     │
│                                                         │
│  Step 2: 归一化匹配                                     │
│  ─────────────────                                      │
│  归一化规则:                                            │
│    - 去除空格、横杠、斜杠                               │
│    - 统一大小写                                         │
│    - 去除常见后缀 (如 "(套)", "【新款】")              │
│                                                         │
│  IF normalize(scraped_model) == normalize(zcy_model):  │
│      → 选择该型号 ✓                                     │
│                                                         │
│  Step 3: 前缀/后缀匹配                                  │
│  ─────────────────────                                  │
│  IF any zcy_model STARTS_WITH scraped_model:           │
│      → 候选列表                                         │
│  IF any zcy_model ENDS_WITH scraped_model:             │
│      → 候选列表                                         │
│  候选列表长度 == 1 → 选择 ✓                            │
│  候选列表长度 > 1 → 继续下一步                         │
│                                                         │
│  Step 4: 标题型号兜底                                   │
│  ─────────────────────                                  │
│  IF title_model IN zcy_model_list:                     │
│      → 选择该型号 ✓                                     │
│                                                         │
│  Step 5: 编辑距离近似匹配                               │
│  ─────────────────────────                              │
│  计算 scraped_model 与每个 zcy_model 的编辑距离        │
│  IF 最小距离 <= 2 且 相似度 >= 80%:                    │
│      → 选择最相似的 ✓                                   │
│                                                         │
│  Step 6: 放弃，交给人工                                 │
│  ─────────────────────────                              │
│  → require_manual = true                               │
│  → manual_reason = "型号无法自动匹配"                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 型号提取规则（从标题）

```
标题: "得力(deli) DL-888B 热敏标签打印机"

提取规则:
1. 匹配模式: /[A-Z]{1,3}[-]?\d{2,5}[A-Z]?/i
   → 匹配到: DL-888B

2. 匹配模式: /\b[A-Z0-9]{4,15}\b/
   → 匹配到: DL-888B

3. 括号内容排除品牌后的部分
   → (deli) 是品牌，跳过
```

---

## Fallback 优先级

```
型号来源优先级（从高到低）:

1. 采集数据中的 model 字段（精确匹配）
2. 采集数据中的 model 字段（归一化匹配）
3. 采集数据中的 model 字段（近似匹配）
4. 标题中提取的型号
5. 属性中的"型号"字段
6. → 无法确定，require_manual = true
```

---

## 决策表

| 品牌匹配 | 型号匹配 | 结果 |
|---------|---------|------|
| ✓ 成功 | ✓ 成功 | 全自动 |
| ✓ 成功 | ✗ 失败 | require_manual (型号) |
| ✗ 失败 | ✓ 成功 | 使用"无品牌" |
| ✗ 失败 | ✗ 失败 | require_manual (品牌+型号) |

---

## 特殊情况处理

### 1. 型号下拉列表很长（>100项）
- 先按品牌筛选
- 使用搜索框输入型号前缀

### 2. 页面有"新增型号"入口
- 如果检测到此入口，且匹配失败
- 输出 `can_create_model: true`
- 让人工决定是否新增

### 3. 品牌和型号联动
- 某些页面选完品牌后型号列表会变
- 必须先选品牌，等型号列表刷新后再选型号

---

## 输出示例

### 成功
```json
{
    "brand": "得力",
    "model": "DL-888B",
    "require_manual": false,
    "match_details": {
        "brand_method": "exact",
        "model_method": "normalize"
    }
}
```

### 需要人工
```json
{
    "brand": "得力",
    "model": null,
    "require_manual": true,
    "manual_reason": "采集型号 'DL-888BX' 不在下拉列表，最相似的是 'DL-888B' (相似度75%)",
    "suggestions": ["DL-888B", "DL-888A", "DL-889B"]
}
```
