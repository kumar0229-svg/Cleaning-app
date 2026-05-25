@echo off
cd /d "%~dp0"

echo Stopping any process on port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8000" ^| find "LISTENING" 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo Starting backend (4 workers)...
"%~dp0venv\Scripts\python.exe" -m uvicorn main:app --workers 4 --host 0.0.0.0 --port 8000
