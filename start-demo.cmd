@echo off
setlocal
cd /d "%~dp0"

echo [1/4] Checking dependencies...
if not exist node_modules (
  call npm install
  if errorlevel 1 goto :error
)

echo [2/4] Building the application...
call npm run build
if errorlevel 1 goto :error

echo [3/4] Starting local server and simulator...
start "Hybrid Mini-Grid Server" cmd /k "cd /d %~dp0 && npm start"
timeout /t 2 /nobreak >nul
start "Hybrid Mini-Grid Simulator" cmd /k "cd /d %~dp0 && npm run simulator"
timeout /t 2 /nobreak >nul

echo [4/4] Opening dashboard...
start "" "http://127.0.0.1:3000"
exit /b 0

:error
echo Setup failed. Review the error above.
pause
exit /b 1
