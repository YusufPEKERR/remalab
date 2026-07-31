@echo off
title RemaLab WMS Headless Server Launcher
cd /d "%~dp0"

:START_SERVER
cls
echo ===================================================
echo   RemaLab WMS Headless Sunucu Launcher
echo ===================================================
echo.

echo [INFO] Python sanal ortami (.venv) kontrol ediliyor...
if not exist .venv\Scripts\python.exe (
    echo [WARNING] .venv bulunamadi. Sanal ortam olusturuluyor...
    python -m venv .venv
    if %errorlevel% neq 0 (
        echo [ERROR] Sanal ortam olusturulamadi! Lutfen bilgisayarinizda Python'in kurulu ve PATH'e ekli oldugundan emin olun.
        pause
        exit /b
    )
    echo [INFO] Python paketleri yukleniyor...
    .venv\Scripts\pip.exe install -r requirements.txt
    if %errorlevel% neq 0 (
        echo [ERROR] Python kutuphaneleri yuklenirken hata olustu!
        pause
        exit /b
    )
)

echo [INFO] React modulleri (node_modules) kontrol ediliyor...
if not exist frontend\node_modules (
    echo [WARNING] node_modules bulunamadi. npm install calistiriliyor...
    cd frontend
    call npm install
    cd ..
)

echo [INFO] RemaLab WMS Sunucusu baslatiliyor...
echo.
.venv\Scripts\python.exe server.py

rem 42 kodu R tusuna basildiginda verilir - dogrudan aninda yeniden baslat
if %errorlevel% equ 42 (
    echo.
    echo [INFO] Yeniden baslatma istegi alindi, sunucu baslatiliyor...
    timeout /t 1 /nobreak >nul
    goto START_SERVER
)

echo.
echo ===================================================
echo   Sunucu durduruldu veya kapandi.
echo   [R] Yeniden Baslat (Restart)
echo   [Q] Cikis (Exit)
echo ===================================================
choice /c RQ /m "Seciminiz [R/Q]:"
if errorlevel 2 goto EXIT_APP
if errorlevel 1 goto START_SERVER

:EXIT_APP
echo Sunucu kapatildi.
exit /b
