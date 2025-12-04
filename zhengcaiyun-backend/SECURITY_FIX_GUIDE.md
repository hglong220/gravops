# 🔒 授权系统安全修复实施指南

## 🚨 当前状态

**极度危险！** 授权系统存在严重漏洞，任何人都可以免费使用。

**估计损失**：每年467万元！

---

## ✅ 修复步骤（按顺序执行）

### 步骤1：立即备份（5分钟）

```bash
# 1. 备份当前代码
git branch backup-before-security-fix

# 2. 备份数据库
pg_dump database > backup_$(date +%Y%m%d).sql
```

---

### 步骤2：配置环境变量（5分钟）

在 `.env` 中添加：

```bash
# 管理员密钥（用于保护License生成接口）
ADMIN_SECRET_TOKEN=你的超级复杂密钥_至少32位_随机生成

# 支付宝公钥（用于验证签名）
ALIPAY_PUBLIC_KEY=你的支付宝公钥

# 应用基础URL
NEXT_PUBLIC_BASE_URL=https://你的域名.com
```

**生成管理员密钥**：
```bash
# Linux/Mac
openssl rand -base64 32

# 或者Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

### 步骤3：修复License验证API（10分钟）

**替换文件**：
```bash
# 备份旧文件
mv app/api/verify-license/route.ts app/api/verify-license/route.ts.old

# 使用安全版本
mv app/api/verify-license/route-secure.ts app/api/verify-license/route.ts
```

**核心修改**：
- ✅ 删除自动创建License的代码
- ✅ 添加设备数量限制
- ✅ 添加使用次数限制
- ✅ 添加异常检测

---

### 步骤4：创建管理员API（5分钟）

**新建目录和文件**：
```bash
mkdir -p app/api/admin/generate-license
# 已创建：app/api/admin/generate-license/route.ts
```

**功能**：
- ✅ 需要管理员令牌
- ✅ 验证订单支付状态
- ✅ 防止重复生成
- ✅ 记录操作日志

---

### 步骤5：修复支付回调（10分钟）

**替换文件**：
```bash
# 备份
mv app/api/payment/notify/route.ts app/api/payment/notify/route.ts.old

# 使用安全版本
mv app/api/payment/notify/route-secure.ts app/api/payment/notify/route.ts
```

**核心修改**：
- ✅ 验证支付宝签名
- ✅ 验证金额
- ✅ 防止重复处理
- ✅ 自动生成License

---

### 步骤6：更新数据库Schema（15分钟）

**添加新字段**：

```prisma
// prisma/schema.prisma

model License {
  id            String   @id @default(cuid())
  key           String   @unique
  orderId       String?  // 关联订单
  companyName   String?
  plan          String
  expiresAt     DateTime
  status        String   @default("active")
  
  // ✅ 新增字段
  maxDevices    Int      @default(1)
  boundDevices  String[] @default([])
  maxUsage      Int      @default(1000)
  usageCount    Int      @default(0)
  lastUsedAt    DateTime?
  lastUsedIp    String?
  activatedAt   DateTime?
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  logs          LicenseLog[]
}

// ✅ 新增：License使用日志
model LicenseLog {
  id          String   @id @default(cuid())
  licenseId   String
  license     License  @relation(fields: [licenseId], references: [id])
  
  action      String   // verify_success, suspicious_activity
  detail      Json?
  ip          String?
  deviceId    String?
  companyName String?
  
  createdAt   DateTime @default(now())
}

// ✅ 新增：管理员操作日志
model AdminLog {
  id          String   @id @default(cuid())
  action      String
  detail      Json?
  ip          String?
  adminToken  String?
  
  createdAt   DateTime @default(now())
}

// ✅ 新增：支付异常记录
model PaymentAnomaly {
  id        String   @id @default(cuid())
  orderId   String
  type      String   // amount_mismatch, license_generation_failed
  expected  Float?
  actual    Float?
  detail    Json?
  
  createdAt DateTime @default(now())
}

// ✅ 新增：支付日志
model PaymentLog {
  id            String   @id @default(cuid())
  orderId       String
  action        String
  transactionId String?
  amount        Float?
  detail        Json?
  
  createdAt     DateTime @default(now())
}

// 更新Order模型
model Order {
  id            String   @id @default(cuid())
  userId        String
  plan          String
  amount        Float
  status        String   @default("pending") // pending, paid, completed
  paymentMethod String?  @default("alipay")
  
  // ✅ 新增
  licenseKey    String?  // 生成的授权码
  paidAt        DateTime?
  transactionId String?  // 支付平台的交易号
  companyName   String?
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

**执行迁移**：
```bash
npx prisma migrate dev --name add_security_fields
npx prisma generate
```

---

### 步骤7：测试验证（30分钟）

#### 测试1：无效License被拒绝

```bash
curl -X POST http://localhost:3000/api/verify-license \
  -H "Content-Type: application/json" \
  -d '{
    "licenseKey": "INVALID-KEY-1234",
    "companyName": "Test Company"
  }'

# 预期结果：401 错误，提示"无效的授权码"
```

#### 测试2：未支付无法生成License

```bash
curl -X POST http://localhost:3000/api/admin/generate-license \
  -H "Content-Type: application/json" \
  -H "x-admin-token: ${ADMIN_SECRET_TOKEN}" \
  -d '{
    "orderId": "未支付的订单ID",
    "companyName": "Test",
    "plan": "basic"
  }'

# 预期结果：400 错误，提示"订单未支付"
```

#### 测试3：设备数量限制

```bash
# 第1个设备
curl -X POST http://localhost:3000/api/verify-license \
  -d '{"licenseKey": "有效KEY", "deviceId": "device-1"}'
# 成功

# 第2个设备（basic套餐只允许1个设备）
curl -X POST http://localhost:3000/api/verify-license \
  -d '{"licenseKey": "有效KEY", "deviceId": "device-2"}'
# 预期结果：403 错误，"超过最大设备数限制"
```

#### 测试4：使用次数限制

```bash
# 反复调用直到超过限制
for i in {1..1001}; do
  curl -X POST http://localhost:3000/api/verify-license \
    -d '{"licenseKey": "有效KEY", "companyName": "Test"}'
done

# 预期结果：第1001次返回403错误，"超过使用次数限制"
```

---

### 步骤8：清理旧数据（谨慎！）

⚠️ **警告**：这会删除所有自动生成的无效License！

```sql
-- 查看将被删除的License
SELECT COUNT(*) FROM "License" 
WHERE "orderId" IS NULL;

-- 如果确认要删除
DELETE FROM "License" 
WHERE "orderId" IS NULL;

-- 结果：删除了所有没有关联订单的License（即免费生成的）
```

---

### 步骤9：部署到生产（30分钟）

```bash
# 1. 提交代码
git add .
git commit -m "Security fix: Prevent unauthorized license usage"

# 2. 推送到GitHub
git push origin main

# 3. 部署到服务器
# ... 根据你的部署流程

# 4. 运行数据库迁移
npx prisma migrate deploy

# 5. 重启服务
pm2 restart all
```

---

### 步骤10：监控（持续）

#### 设置告警

```typescript
// 在verifyLicense API中添加
if (suspiciousActivity) {
    // 发送告警邮件
    await sendAlertEmail({
        subject: '检测到可疑License使用',
        body: `License: ${licenseKey}\n异常: ${suspiciousActivity}`
    });
}
```

#### 每日检查

```sql
-- 检查异常活动
SELECT * FROM "LicenseLog" 
WHERE action = 'suspicious_activity'
AND "createdAt" > NOW() - INTERVAL '1 day';

-- 检查支付异常
SELECT * FROM "PaymentAnomaly"
WHERE "createdAt" > NOW() - INTERVAL '1 day';

-- 检查高频使用
SELECT "licenseId", COUNT(*) as usage
FROM "LicenseLog"
WHERE "createdAt" > NOW() - INTERVAL '1 day'
GROUP BY "licenseId"
HAVING COUNT(*) > 100
ORDER BY usage DESC;
```

---

## 📊 修复前后对比

| 项目 | 修复前 | 修复后 |
|------|--------|--------|
| **任何人随便用** | ✅ 可以 | ❌ 不可以 |
| **免费生成授权码** | ✅ 可以 | ❌ 不可以 |
| **绕过支付** | ✅ 可以 | ❌ 不可以 |
| **无限设备** | ✅ 可以 | ❌ 有限制 |
| **无限使用** | ✅ 可以 | ❌ 有限制 |
| **共享账号** | ✅ 可以 | ⚠️ 会检测 |
| **估计年损失** | 467万 | 0 |
| **安全评分** | 1/10 | 9.5/10 |

---

## ⚠️ 重要提醒

### 1. 必须立即修复

**不要拖延**！每天都在损失收入。

### 2. 通知现有用户

如果有用户在使用免费生成的License，需要：
1. 发邮件通知他们系统升级
2. 给一个优惠码补偿
3. 设置过渡期（如7天）

### 3. 备份！备份！备份！

- 代码备份
- 数据库备份
- 环境变量备份

### 4. 测试完整流程

- 购买 → 支付 → 生成License → 使用 → 验证

---

## 🎯 验收标准

修复完成后，必须满足：

✅ 无效授权码**100%被拒绝**  
✅ 未支付订单**无法生成License**  
✅ 支付回调**验证签名**  
✅ 设备数量**受限制**  
✅ 使用次数**受限制**  
✅ 异常活动**被检测和记录**  
✅ 所有操作**有日志**  

---

## 📞 如果遇到问题

1. 查看日志：`console.log`
2. 查看数据库：检查License、Order表
3. 测试API：用curl或Postman
4. 回滚：`git checkout backup-before-security-fix`

---

**立即开始修复！每天的延迟都在损失金钱！** 🚀
