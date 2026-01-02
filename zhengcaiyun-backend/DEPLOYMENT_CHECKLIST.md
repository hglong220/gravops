# 服务器部署清单

## ✅ 已完成的安全加固

### 1. 环境文件保护
- ✅ `.env` 和 `.env.local` 已在 `.gitignore` 中
- ✅ 测试和调试文件已加入 `.gitignore`
- ✅ 不会被提交到 Git 仓库

### 2. 图片代理安全
- ✅ `/api/image-proxy` 强制执行域名白名单
- ✅ `/api/copy/image-proxy` 有完整的安全措施
- ✅ 防止 SSRF 攻击和内网探测

### 3. 支付验签加强
- ✅ 支付宝验签：生产环境强制验签
- ✅ 微信支付验签：生产环境强制验签
- ✅ 开发环境不受影响，保持原有功能

### 4. 测试接口保护
- ✅ `/api/test-ai-category` 只允许开发环境访问
- ✅ 生产环境自动禁用

### 5. 硬编码密钥清理
- ✅ 移除前端硬编码的测试 licenseKey
- ✅ 改为从用户登录信息中获取

### 6. 规则爬虫安全
- ✅ 添加域名白名单，只允许政采云官方域名
- ✅ 防止被用于探测任意网站

---

## 🔧 必须配置的环境变量

### **核心配置（必须）**
```bash
NODE_ENV=production            # 必须设置为 production
DATABASE_URL="postgresql://..." # 数据库连接字符串
JWT_SECRET="your_jwt_secret"   # JWT 密钥（强随机字符串）
```

### **AI 功能（如需使用）**
```bash
DEEPSEEK_API_KEY="sk-..."     # DeepSeek API 密钥
OPENAI_API_KEY="sk-..."        # OpenAI API 密钥（可选）
GOOGLE_API_KEY="..."           # Google Gemini API 密钥（可选）
```

### **队列功能（如需使用）**
```bash
REDIS_URL="redis://..."        # Redis 连接字符串
# 或者分开配置
REDIS_HOST="localhost"
REDIS_PORT="6379"
```

### **支付功能（如需使用）**
```bash
# 支付宝
ALIPAY_APP_ID="..."
ALIPAY_PRIVATE_KEY="..."
ALIPAY_PUBLIC_KEY="..."        # ⚠️ 生产环境必须配置

# 微信支付
WECHAT_MCH_ID="..."
WECHAT_APP_ID="..."
WECHAT_API_V3_KEY="..."        # ⚠️ 生产环境必须配置
```

### **爬虫功能（Linux 服务器）**
```bash
PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium-browser"
# 或其他chromium路径
```

---

## 📋 部署前检查清单

### 1. 环境变量
- [ ] 设置 `NODE_ENV=production`
- [ ] 配置数据库连接
- [ ] 配置 JWT_SECRET
- [ ] 根据需要配置其他环境变量

### 2. 数据库
- [ ] 运行数据库迁移：`npx prisma migrate deploy`
- [ ] 确认数据库连接正常

### 3. 依赖安装
- [ ] 运行 `npm install --production`
- [ ] 如果使用爬虫，确保安装 Chromium

### 4. 构建项目
- [ ] 运行 `npm run build`
- [ ] 确认构建成功

### 5. 防火墙和端口
- [ ] 开放必要的端口（默认 3000）
- [ ] 配置反向代理（推荐使用 Nginx）

### 6. HTTPS 配置
- [ ] 配置 SSL 证书
- [ ] 确保所有 API 使用 HTTPS

---

## ⚠️ 部署后注意事项

### 安全检查
1. **确认测试接口已禁用**
   - 访问 `/api/test-ai-category` 应返回 403

2. **确认支付验签正常**
   - 未配置公钥时，支付回调应该被拒绝

3. **确认图片代理白名单生效**
   - 非白名单域名应该被拒绝

### 功能验证
1. **用户登录功能**
   - 测试登录/注册流程

2. **AI 功能**（如已配置）
   - 测试类目匹配
   - 测试表单识别

3. **队列功能**（如已配置）
   - 测试发布任务

---

## 🚨 已知的剩余风险

### 低优先级（可以暂时接受）

1. **登录接口无速率限制**
   - 存在暴力破解风险
   - 建议后期添加 IP 限流

2. **部分接口仅靠 licenseKey 鉴权**
   - `/api/vision/*` - 视觉 AI 接口
   - `/api/tasks/check-permissions` - 权限检测
   - 如果 API 密钥泄露可能被滥用
   - 建议后期添加用户鉴权

3. **公开数据暴露**
   - `/public/api/` 下的类目数据可公开访问
   - 不是敏感信息，风险可控

### 中优先级（建议逐步优化）

1. **发布队列接口**
   - 建议确认扩展是否传 token，然后添加鉴权

2. **支付创建接口**
   - 建议从 token 获取 userId 而不是信任客户端

3. **CORS 白名单**
   - 当前允许任意源访问
   - 建议配置扩展 ID 和生产域名白名单

---

## 📞 遇到问题？

### 常见问题

**Q: 支付功能提示公钥未配置**
A: 这是正常的，生产环境必须配置支付宝/微信的公钥才能使用支付功能。开发环境可以跳过。

**Q: 图片代理返回 403**
A: 检查图片 URL 是否来自支持的电商网站（京东、天猫、苏宁）。

**Q: AI 功能不工作**
A: 确认已配置 `DEEPSEEK_API_KEY` 或其他 AI API 密钥。

**Q: 测试接口返回 403**
A: 这是正常的，生产环境会自动禁用测试接口。

---

## 🎯 下一步优化建议

1. 配置 CDN 加速静态资源
2. 添加监控和日志系统
3. 配置自动备份
4. 添加 API 限流中间件
5. 实施完整的 CORS 白名单策略
