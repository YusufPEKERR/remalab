@echo off
title RemaLab WMS Headless Server Launcher
cd /d "%~dp0"

:START_SERVER
cls
echo ===================================================
echo   RemaLab WMS Headless Sunucu Launcher
echo ===================================================
echo.

rem 1. Python Kontrolü & Otomatik Kurulum
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Python sisteminizde bulunamadi veya PATH'e ekli degil.
    echo [INFO] Python 3.12 otomatik olarak indirilip kuruluyor...
    
    where winget >nul 2>&1
    if %errorlevel% equ 0 (
        winget install --id Python.Python.3.12 --silent --override "/passive InstallAllUsers=1 PrependPath=1"
    ) else (
        powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.12.2/python-3.12.2-amd64.exe' -OutFile 'python_installer.exe'"
        python_installer.exe /passive InstallAllUsers=1 PrependPath=1
        del /f /q python_installer.exe
    )
    
    echo.
    echo [INFO] Python kuruldu. PATH ortami guncelleniyor...
    set "PATH=%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python312\Scripts;C:\Program Files\Python312;C:\Program Files\Python312\Scripts;%PATH%"
)

rem 2. Python Sanal Ortamı (.venv) Kontrolü
echo [INFO] Python sanal ortami (.venv) kontrol ediliyor...
if not exist .venv\Scripts\python.exe (
    echo [WARNING] .venv bulunamadi. Sanal ortam olusturuluyor...
    python -m venv .venv
    if %errorlevel% neq 0 (
        echo [ERROR] Sanal ortam olusturulamadi! Lutfen Python kurulumunu kontrol edin.
        pause
        exit /b
    )
    echo [INFO] Python paketleri yukleniyor (requirements.txt)...
    .venv\Scripts\python.exe -m pip install --upgrade pip >nul 2>&1
    .venv\Scripts\pip.exe install -r requirements.txt
    if %errorlevel% neq 0 (
        echo [ERROR] Python kutuphaneleri yuklenirken hata olustu!
        pause
        exit /b
    )
)

rem 3. Node.js ve Frontend Derleme Kontrolü
if not exist frontend\dist (
    node --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo [WARNING] Node.js bulunamadi ve frontend/dist derlemesi eksik.
        echo [INFO] Node.js otomatik olarak indirilip kuruluyor...
        where winget >nul 2>&1
        if %errorlevel% equ 0 (
            winget install --id OpenJS.NodeJS.LTS --silent
        ) else (
            powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi' -OutFile 'node_installer.msi'"
            msiexec /i node_installer.msi /qn
            del /f /q node_installer.msi
        )
    )
    echo [INFO] React arayuzu derleniyor (npm run build)...
    cd frontend
    call npm install
    call npm run build
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
