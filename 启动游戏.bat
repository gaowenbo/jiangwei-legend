@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "jiangwei-legend.html" (
  echo 找不到 jiangwei-legend.html
  pause
  exit /b 1
)
echo 正在用默认浏览器打开《姜维传》HTML 重制版...
start "" "%~dp0jiangwei-legend.html"
exit /b 0
