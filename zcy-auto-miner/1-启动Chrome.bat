@echo off
echo 🚀 启动Chrome调试模式
echo.
echo 关闭你所有的Chrome窗口，然后运行此脚本
echo.
pause

"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%USERPROFILE%\ChromeDebug"

echo.
echo Chrome已启动！请登录政采云后，运行下一个脚本
pause
