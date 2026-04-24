# 政采云桌面采集原型

这个目录用于验证“桌面软件 + 受控浏览器”的可行性，不是正式产品。

目标：

- 复用用户本机 Edge/Chrome，避免软件内置完整 Chromium 导致体积大、卡顿。
- 使用独立浏览器用户数据目录保存登录态。
- 先验证京东商品主图、详情图、参数文字、型号货号、销售规格能否稳定采集。
- 后续再接入政采云自动发布流程。

运行：

```powershell
pnpm install
pnpm collect:jd:cdp -- --url https://item.jd.com/100011969414.html
```

第一次运行会打开浏览器。如果跳到京东登录页，先在这个浏览器窗口登录，然后重新运行采集命令。

输出：

- `output/jd-cdp-collection-result.json`
- `output/jd-cdp-collection-{sku}.json`
- 控制台显示主图、详情图、参数、规格/SKU 摘要。

默认采集主图和详情图。只做字段验证、不需要详情图时可以加 `--no-detail-images`：

```powershell
pnpm collect:jd:cdp -- --url https://item.jd.com/100011969414.html --no-detail-images
```

## 2026-04-24 JD CDP smoke result

Test URL: `https://item.jd.com/100011969414.html`

Stable result after three consecutive runs:
- main images: 9
- detail images: 16
- no JD 403 redirect

This confirms the `Edge + CDP` route is more reliable than the old extension-only scraper for this JD product. The next validation step is to test more JD products and then test Zhengcaiyun publishing.
