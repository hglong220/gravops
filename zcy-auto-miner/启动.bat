@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   🚀 政采云类目自动提取工具
echo ========================================
echo.

REM 检查 Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 错误: 未安装 Node.js
    echo 请访问 https://nodejs.org 下载安装
    pause
    exit /b 1
)

echo ✅ Node.js 版本:
node --version
echo.

REM 检查依赖
if not exist "node_modules" (
    echo 📦 首次运行，正在安装依赖...
    call npm install
    echo.
    echo 📥 正在下载 Chromium 浏览器...
    call npm run install-browser
    echo.
)

echo 🎯 选择运行模式:
echo.
echo [1] 正常模式 (可视化，需要手动登录)
echo [2] 调试模式 (浏览器保持打开)
echo [3] 查看已提取的数据
echo [4] 退出
echo.

set /p choice=请输入选项 (1-4): 

if "%choice%"=="1" (
    echo.
    echo 🚀 启动正常模式...
    echo 💡 提示: 浏览器打开后，请手动登录政采云账号
    echo.
    call npm run extract
    goto end
)

if "%choice%"=="2" (
    echo.
    echo 🔍 启动调试模式...
    echo 💡 提示: 浏览器不会自动关闭，按 Ctrl+C 停止脚本
    echo.
    call npm run extract-debug
    goto end
)

if "%choice%"=="3" (
    echo.
    echo 📂 打开输出目录...
    if exist "output" (
        explorer output
    ) else (
        echo ⚠️  还没有提取过数据
    )
    goto end
)

if "%choice%"=="4" (
    echo.
    echo 👋 再见！
    exit /b 0
)

echo.
echo ❌ 无效的选项
pause
exit /b 1

:end
echo.
echo ========================================
echo   ✅ 执行完成
echo ========================================
echo.
if exist "output\categories_flat.json" (
    echo 📊 提取结果:
    for %%F in (output\categories_flat.json) do (
        powershell -Command "Get-Content 'output\categories_flat.json' | ConvertFrom-Json | Measure-Object | Select-Object -ExpandProperty Count" > temp_count.txt
        set /p count=<temp_count.txt
        del temp_count.txt
        echo    - 类目数量: !count! 个
    )
    echo    - 文件位置: %cd%\output
    echo.
    echo 🎉 数据已保存! 是否打开输出目录?
    echo.
    set /p open=输入 Y 打开, 其他键跳过: 
    if /i "!open!"=="Y" explorer output
)

echo.
pause
