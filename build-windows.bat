@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is required. Install Node.js 20+ first.&pause&exit /b 1)
if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (echo npm install failed.&pause&exit /b 1)
)
echo.
echo IMPORTANT: Before building a public release, set DEFAULT_RELAY_SERVER
in src\preload.js to your public HTTPS relay URL.
echo.
echo Building Virtual B2B DJ installer and portable EXE...
call npm run build
if errorlevel 1 (echo Build failed.&pause&exit /b 1)
echo.
echo Build complete. Check the dist folder for:
echo   Virtual-B2B-DJ-Portable.exe
echo   Virtual B2B DJ installer
pause
