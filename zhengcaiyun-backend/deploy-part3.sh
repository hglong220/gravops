#!/bin/bash

# 政采云部署脚本 - 第三阶段
# 数据库迁移、构建和启动应用

echo "=========================================="
echo "政采云部署 - 第三阶段"
echo "=========================================="
echo ""

# 设置工作目录
cd /var/www/gravops/zhengcaiyun-backend

echo "步骤 1/10: 生成 Prisma Client..."
npx prisma generate
if [ $? -ne 0 ]; then
    echo "❌ Prisma Client 生成失败"
    exit 1
fi
echo "✅ Prisma Client 生成成功"
echo ""

echo "步骤 2/10: 运行数据库迁移..."
npx prisma migrate deploy
if [ $? -ne 0 ]; then
    echo "❌ 数据库迁移失败"
    exit 1
fi
echo "✅ 数据库迁移成功"
echo ""

echo "步骤 3/10: 验证数据库表..."
sudo -u postgres psql -d zhengcaiyun -c "\dt"
echo ""

echo "步骤 4/10: 构建 Next.js 应用（这可能需要 1-2 分钟）..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ 应用构建失败"
    exit 1
fi
echo "✅ 应用构建成功"
echo ""

echo "步骤 5/10: 创建 PM2 配置文件..."
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'zhengcaiyun',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/gravops/zhengcaiyun-backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
EOF
echo "✅ PM2 配置文件创建成功"
echo ""

echo "步骤 6/10: 启动应用..."
pm2 start ecosystem.config.js
echo ""

echo "步骤 7/10: 保存 PM2 进程列表..."
pm2 save
echo ""

echo "步骤 8/10: 设置 PM2 开机自启..."
pm2 startup
echo ""

echo "步骤 9/10: 检查 PM2 状态..."
pm2 status
echo ""

echo "步骤 10/10: 查看应用日志..."
pm2 logs zhengcaiyun --lines 30 --nostream
echo ""

echo "=========================================="
echo "✅ 部署第三阶段完成！"
echo "=========================================="
echo ""
echo "应用已启动在端口 3000"
echo "服务器内网 IP: 172.19.237.22"
echo "服务器公网 IP: 8.137.85.26"
echo ""
echo "下一步："
echo "1. 检查应用是否正常运行: curl http://localhost:3000"
echo "2. 配置 Nginx 反向代理（如需外网访问）"
echo "3. 配置防火墙和安全组规则"
echo ""
