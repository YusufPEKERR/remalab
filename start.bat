@echo off
title RemaLab WMS Headless Server Launcher
cd /d "%~dp0"

:START_SERVER
cls
echo ===================================================
echo   RemaLab WMS Headless Sunucu Launcher
echo ===================================================
echo.

rem 1. En Son Python Komutunu Tespit Et veya Kur
set "PY_CMD="
python --version >nul 2>&1 && set "PY_CMD=python"
if not defined PY_CMD py -3 --version >nul 2>&1 && set "PY_CMD=py -3"

rem Dinamik Klasör Arama (Python 3.13, 3.12, 3.11 vb. en güncel hangisi varsa)
if not defined PY_CMD (
    for /d %%D in ("%LOCALAPPDATA%\Programs\Python\Python3*") do if exist "%%D\python.exe" set "PY_CMD="%%D\python.exe""
    for /d %%D in ("C:\Program Files\Python3*") do if exist "%%D\python.exe" set "PY_CMD="%%D\python.exe""
    for /d %%D in ("C:\Python3*") do if exist "%%D\python.exe" set "PY_CMD="%%D\python.exe""
)

if not defined PY_CMD (
    echo [WARNING] Python sisteminizde yuklu degil.
    echo [INFO] En son resmi Python 3 surumu otomatik olarak indirilip kuruluyor...
    
    where winget >nul 2>&1
    if %errorlevel% equ 0 (
        winget install --id Python.Python.3 --silent --override "/passive InstallAllUsers=1 PrependPath=1"
    ) else (
        powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.13.2/python-3.13.2-amd64.exe' -OutFile 'python_installer.exe'"
        python_installer.exe /passive InstallAllUsers=1 PrependPath=1
        del /f /q python_installer.exe
    )
    
    echo [INFO] Python kuruldu. Yeniden tespit ediliyor...
    python --version >nul 2>&1 && set "PY_CMD=python"
    if not defined PY_CMD py -3 --version >nul 2>&1 && set "PY_CMD=py -3"
    for /d %%D in ("%LOCALAPPDATA%\Programs\Python\Python3*") do if exist "%%D\python.exe" set "PY_CMD="%%D\python.exe""
    for /d %%D in ("C:\Program Files\Python3*") do if exist "%%D\python.exe" set "PY_CMD="%%D\python.exe""
)

if not defined PY_CMD (
    echo.
    echo ===================================================
    echo   [HATA] Python kurulumu tamamlanamadi veya PATH'e eklenemedi!
    echo   Lutfen bilgisayarinizi yeniden baslatip tekrar deneyin.
    echo ===================================================
    echo.
    pause
    exit /b 1
)

echo [INFO] Kullanilan Python: %PY_CMD%

rem 2. Python Sanal Ortamı (.venv) Kontrolü
echo [INFO] Python sanal ortami (.venv) kontrol ediliyor...
if not exist .venv\Scripts\python.exe (
    echo [WARNING] .venv bulunamadi. Sanal ortam olusturuluyor...
    %PY_CMD% -m venv .venv
    if %errorlevel% neq 0 (
        echo.
        echo [HATA] Sanal ortam olusturulamadi!
        pause
        exit /b 1
    )
    echo [INFO] Python paketleri yukleniyor (requirements.txt)...
    .venv\Scripts\python.exe -m pip install --upgrade pip >nul 2>&1
    .venv\Scripts\pip.exe install -r requirements.txt
    if %errorlevel% neq 0 (
        echo.
        echo [HATA] Python kutuphaneleri yuklenirken hata olustu!
        pause
        exit /b 1
    )
)

rem 3. Node.js ve Frontend Derleme Kontrolü
if not exist frontend\dist (
    node --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo [WARNING] Node.js bulunamadi ve frontend/dist derlemesi eksik.
        echo [INFO] Node.js otomatik kuruluyor...
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
echo Sunucu kapatildi. Kapatmak icin bir tusa basin...
pause
