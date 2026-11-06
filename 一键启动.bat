@echo off
chcp 65001 >nul
title 政采云智能助手 - 一键启动
echo ================================
echo  政采云智能助手 一键启动
echo ================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [错误] 没找到 Node.js，请先去 https://nodejs.org 下载 LTS 版安装，装完再双击这个文件。
  pause
  exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do echo Node.js 版本: %%v

where pnpm >nul 2>&1
if errorlevel 1 (
  echo 正在安装 pnpm，请稍等...
  call npm i -g pnpm
)

cd /d %~dp0zhengcaiyun-backend

if not exist node_modules (
  echo 正在安装依赖，第一次会比较慢，请耐心等...
  call pnpm install
  if errorlevel 1 (
    echo [错误] 依赖安装失败，请把上面的报错截图发我。
    pause
    exit /b 1
  )
)

if not exist .env (
  echo 正在创建配置文件...
  copy .env.example .env >nul
)

if not exist prisma\dev.db (
  echo 正在初始化数据库...
  call npx prisma generate
  call npx prisma db push
)

echo.
echo 正在启动后端，启动后会自动打开浏览器...
echo 注意：不要关这个窗口，关了服务就停了。
echo.
start "" /min cmd /c "timeout /t 12 /nobreak >nul & start http://localhost:3000"
call pnpm dev
pause
