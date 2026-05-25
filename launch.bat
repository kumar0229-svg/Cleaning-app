@echo off
setlocal

set "APP_DIR=E:\Softwares\cleaning-carryover-app"
set "GEMINI_API_KEY=AIzaSyAXBoAhJ88X2L8U5nofZhREf9OusFJ9SwU"
set "BROWSER=none"

echo ============================================
echo   Cleaning Carryover App
echo ============================================

start "Backend"  cmd /k "%APP_DIR%\backend\start_backend.bat"
timeout /t 3 /nobreak > nul
start "Frontend" cmd /k "set BROWSER=none && %APP_DIR%\frontend\start_frontend.bat"

echo Waiting for React to compile (25s)...
timeout /t 25 /nobreak > nul
start "" "http://localhost:3000"

endlocal
