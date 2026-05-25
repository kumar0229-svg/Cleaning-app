@echo off
cd /d "%~dp0"

echo Stopping any process on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING" 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo Starting frontend...
set BROWSER=none
npm start
