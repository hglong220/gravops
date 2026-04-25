# JD 商品读取冻结规则

这份规则用于保护已经验证可用的桌面端京东商品读取逻辑。后续修改 `jd-webview-reader.js` 和 `MainForm.cs` 时必须遵守。

## 主图

- 主图逻辑已经稳定，不要重构。
- 主图只能优先来自商品左侧预览/轮播区域，例如 `.image-carousel-track`、`#spec-list`、`#spec-n1`、`.preview`、`#preview`。
- 不允许在已经有主图时用全页面 `img`、评论区、店铺区、推荐区、右侧 SKU 图片或全局网络资源补主图。
- 资源兜底只能在主图数量为 0 时使用。

## 详情图

详情图按以下优先级采集：

1. WebView 网络响应中的详情 HTML / 详情接口内容。
2. 页面详情 DOM 容器。
3. 网络图片响应兜底。

详情图是图片 URL，不下载图片文件。

## WebView 捕获

- 页面开始导航时清空当前商品的网络捕获缓存。
- 从页面加载期间持续监听响应，不要等点击读取后才监听。
- 监听范围包括 document、script、XHR/fetch、image。
- 响应 body 只保留疑似详情内容，关键词包括 `360buyimg.com`、`jfs`、`pcpubliccms`、`ssd-module`、`detail`、`description`、`商品详情`、`graphic`、`content`。
- 网络图片只能作为兜底，不能替代详情 HTML 和详情 DOM。

## 详情 DOM

从以下容器中提取详情图：

```js
[
  '#graphic-content',
  '#J-detail-content',
  '#detail',
  '.detail-content',
  '.ssd-module-detail',
  '.ssd-module-wrap',
  '.ssd-module',
  '.p-parameter',
  '.detail'
]
```

提取来源包括：

- `img.src`
- `img.currentSrc`
- `img.dataset.src`
- `img.dataset.lazyload`
- `img.dataset.original`
- `data-src`
- `data-lazyload`
- `data-original`
- `source.srcset`
- `background-image: url(...)`

## URL 规则

候选详情图路径至少包括：

- `/sku/jfs/`
- `/imgzone/jfs/`
- `/img/jfs/`
- `/popWaterMark/`
- `pcpubliccms`
- `jfs/`

必须兼容 `//img10.360buyimg.com/...`、`http://...`、`https://...`，并统一规范化为 `https://...`。

## 过滤规则

采用来源打分和过滤原因记录，不做无日志的一票否决。

高可信来源：

- `detail_html`
- `detail_dom`

低可信来源：

- `network_image`

必须过滤：

- logo、icon、sprite、loading、二维码、头像。
- 评论晒单图、店铺图、推荐图、通用 UI 图。
- `misc.360buyimg.com`、`storage.360buyimg.com`、`retail-mall`、`mall-common-component`、`uba`、`babel`、`common` 等页面/广告资源。
- 明显过小图片。
- 已确认是主图的图片。

每张候选图必须在日志中记录：

- URL。
- 来源。
- 是否保留。
- 过滤原因。
- 宽高。
- 命中规则。

## 合并顺序

最终详情图合并顺序：

1. 详情接口 HTML 图片。
2. 详情 DOM 图片。
3. 网络图片兜底。

合并时必须：

- URL 标准化。
- 去重。
- 排除主图。
- 保持详情图原始顺序。
- 对同一图片不同尺寸 URL 做归一化。
- 优先保留更高清版本。

## SKU / 货号一致性

采集时必须检查页面货号、当前 SKU、型号、详情内容中的型号是否一致。

如果发现详情内容里出现和当前 SKU/货号不一致的型号，要写入 `jd-detail-warning` 日志，不要静默上传。

## 验收标准

- 主图不回退、不混入评论图、SKU 小图、店铺 logo、推荐图。
- 详情图能从详情 HTML 或详情 DOM 中优先提取。
- 详情图不大量混入京东 UI 图标、会员图、loading、广告图。
- 允许少量页面运营图，后续通过过滤规则逐步收紧。
- 参数、SKU、主图、详情图能保存到任务中心。
