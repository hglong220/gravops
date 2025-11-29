# 部署与运行指南

## 1️⃣ 环境准备

- **Node.js** >= 20.x（已在项目根目录使用 `pnpm`）
- **pnpm** (推荐 `pnpm i -g pnpm`)
- **Python 3.9+**（仅用于某些验证码 OCR，可选）
- **Chrome 浏览器**（用于加载扩展）

## 2️⃣ 后端服务

```bash
# 进入后端目录
cd G:\gravops\zhengcyun-backend

# 安装依赖（首次）
pnpm install

# 复制 .env 示例并填写关键配置
cp .env.example .env
# 必填项：
#   DATABASE_URL=sqlite:./dev.db
#   JWT_SECRET=your_secret
#   OPENAI_API_KEY=your_openai_key   # 若不提供则使用 Mock
#   ALIPAY_APP_ID=your_alipay_app_id
#   ALIPAY_PRIVATE_KEY=your_private_key
#   CAPTCHA_API_KEY=your_2captcha_key

# 启动开发服务器
pnpm dev
```
服务器默认运行在 `http://localhost:3000`，所有 API 均可通过该地址访问。

## 3️⃣ 前端 Chrome Extension

```bash
# 进入扩展目录
cd G:\gravops\zhengcyun-ai-assistant

# 安装依赖
pnpm install

# 构建生产版（会生成 `build/chrome-mv3-prod`）
pnpm build
```
### 加载扩展
1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择目录 `G:\gravops\zhengcyun-ai-assistant\build\chrome-mv3-prod`
5. 扩展图标会出现在工具栏。

## 4️⃣ 使用流程（全自动）
1. 在政采云商品上传页面打开浏览器。
2. 扩展会自动注入浮动按钮 `🤖 AI助手`。
3. 点击按钮 → 弹出弹窗 → 输入 **License Key** 与 **公司名称** → 激活。
4. 在弹窗中填写商品名称或直接使用 **智能上传**（右下角按钮），系统会：
   - 调用 AI 分析获取类目与风险
   - 调用图片搜索获取商品图片
   - 自动填写表单、选择类目、上传图片
   - 如出现验证码，自动调用 2Captcha 进行识别
   - 若检测到高风险商品，自动走 **木马策略**（先上传相似商品，后替换）
5. 完成后页面会提示上传成功，后台会记录使用日志。

## 5️⃣ 生产部署（可选）
- 使用 Docker 将后端打包：`docker build -t zcy-backend .` 并在服务器上运行。
- 将环境变量写入容器或使用 `docker-compose` 管理。
- 前端扩展保持本地或通过企业内部 Chrome Web Store 分发。

## 6️⃣ 常见问题排查
- **API 返回 500**：检查 `.env` 中的 `OPENAI_API_KEY`、`ALIPAY`、`CAPTCHA_API_KEY` 是否正确。
- **扩展未注入**：确认页面 URL 包含 `zcygov.cn`，并在 `manifest.json` 中的 `matches` 已覆盖。
- **验证码识别失败**：2Captcha 余额不足或图片过于模糊，尝试手动输入或更换验证码服务。
- **木马策略未触发**：确认 AI 返回 `suggestedAction` 为 `trojan_strategy`，并在弹窗中确认执行。

---

> **备注**：本指南已在本地完整测试（后端 API、扩展加载、智能上传流程），如需进一步功能（真实 JD 爬虫、OCR）可在后续迭代中实现。
