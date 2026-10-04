@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (
  echo Installing required components for the first run...
  call npm install
  if errorlevel 1 (echo Installation failed.&pause&exit /b 1)
)
start "Virtual B2B DJ" cmd /c "npm start"
