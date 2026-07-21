@echo off
title RemaLab WMS Auto-Setup Launcher
cd /d "%~dp0"

echo [INFO] Python sanal ortami (.venv) kontrol ediliyor...
if not exist .venv\Scripts\python.exe (
    echo [WARNING] .venv bulunamadi. Sanal ortam olusturuluyor...
    python -m venv .venv
    if %errorlevel% neq 0 (
        echo [ERROR] Sanal ortam olusturulamadi! Lutfen bilgisayarinizda Python'in kurulu ve PATH'e ekli oldugundan emin olun.
        pause
        exit /b
    )
)

echo [INFO] Python paketleri kontrol ediliyor / yukleniyor...
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\pip.exe install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Python kutuphaneleri yuklenirken hata olustu!
    pause
    exit /b
)

echo [INFO] React modulleri (node_modules) kontrol ediliyor...
if not exist frontend\node_modules (
    echo [WARNING] node_modules bulunamadi. npm install calistiriliyor...
    cd frontend
    call npm install
    cd ..
)

echo [INFO] Uygulama baslatiliyor...
.venv\Scripts\python.exe main.py

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Uygulama %errorlevel% koduyla sonlandi.
    pause
)
