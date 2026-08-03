@echo off
cd /d "%~dp0"
echo ===================================================
echo ERP Web App - Android APK Derleyici
echo ===================================================
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0build_apk.ps1"
echo.
pause
