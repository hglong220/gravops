# 生产上线检查清单（后端）

## 1) 必填环境变量
- `DATABASE_URL`
- `JWT_SECRET`（用户 JWT）
- `PLUGIN_JWT_SECRET`（插件 token，建议与 `JWT_SECRET` 不同）
- `DEEPSEEK_API_KEY`（AI 类目匹配）

## 2) 强烈建议
- `REDIS_URL`（队列/限流/并发控制）
- `ADMIN_EMAILS`（逗号分隔，允许访问 `/admin` 与 `/api/admin/*` 的账号邮箱）
- `ADMIN_SECRET_TOKEN`（可选：用于脚本/运维调用的 `x-admin-token`）

## 3) Puppeteer/采集稳定性
- Linux 推荐安装系统 Chrome，并设置 `PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome`
- 并发保护（避免瞬间起太多浏览器）：
  - `SCRAPE_MAX_CONCURRENCY=2`
  - `SCRAPE_MAX_WAIT_MS=20000`

## 4) 频控（避免被刷爆）
- `RATE_LIMIT_PLUGIN_SESSION_MAX / RATE_LIMIT_PLUGIN_SESSION_WINDOW_MS`
- `RATE_LIMIT_PLUGIN_COPY_MAX / RATE_LIMIT_PLUGIN_COPY_WINDOW_MS`

## 5) 健康检查
- `GET /api/health`：返回 `ok/db/redis`

## 6) 发布流程自检（冒烟）
1. 后台用户登录（拿到 `token`）
2. 访问 `/dashboard/tasks` 能拉到草稿列表
3. 插件 Options 配置 `apiUrl` 为生产域名（首次会弹权限授权）
4. 插件激活（`/api/plugin/session` 返回 `valid:true` 且 `userId` 不为空）
5. 电商页点击采集按钮（`/api/plugin/copy` 返回 `success:true`）
6. 政采云页面点击发布（插件能读取草稿并执行自动化）

