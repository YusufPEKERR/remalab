@echo off
title RemaLab WMS Headless Server Launcher
cd /d "%~dp0"

:START_SERVER
cls
echo ===================================================
echo   RemaLab WMS Headless Sunucu Launcher
echo ===================================================
echo.

rem 1. Python Komutunu Bul
set PY_CMD=python

python --version >nul 2>&1
if %errorlevel% equ 0 goto HAVE_PYTHON

py -3 --version >nul 2>&1
if %errorlevel% equ 0 (
    set PY_CMD=py -3
    goto HAVE_PYTHON
)

if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    set "PY_CMD=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    goto HAVE_PYTHON
)

if exist "C:\Program Files\Python312\python.exe" (
    set "PY_CMD=C:\Program Files\Python312\python.exe"
    goto HAVE_PYTHON
)

if exist "C:\Python312\python.exe" (
    set "PY_CMD=C:\Python312\python.exe"
    goto HAVE_PYTHON
)

rem Python bulunamadı, otomatik indirelim ve kuralım
echo [WARNING] Python sisteminizde yuklu degil.
echo [INFO] Python 3.12 otomatik olarak indiriliyor...

powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.12.2/python-3.12.2-amd64.exe' -OutFile 'python_installer.exe'"
if not exist python_installer.exe (
    echo [HATA] Python yukleme paketi indirilemedi!
    pause
    exit /b 1
)

echo [INFO] Python kuruluyor, lutfen bekleyin...
python_installer.exe /passive InstallAllUsers=1 PrependPath=1
del /f /q python_installer.exe

python --version >nul 2>&1
if %errorlevel% equ 0 goto HAVE_PYTHON

if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    set "PY_CMD=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    goto HAVE_PYTHON
)

if exist "C:\Program Files\Python312\python.exe" (
    set "PY_CMD=C:\Program Files\Python312\python.exe"
    goto HAVE_PYTHON
)

echo.
echo ===================================================
echo   [HATA] Python kurulamadi veya yol bulunamadi!
echo   Lutfen Python 3'u elle kurup tekrar deneyiniz.
echo ===================================================
echo.
pause
exit /b 1

:HAVE_PYTHON
echo [INFO] Kullanilan Python: %PY_CMD%

rem 2. Sanal Ortam (.venv) Kontrolü
if exist .venv\Scripts\python.exe goto RUN_SERVER

echo [INFO] .venv sanal ortami olusturuluyor...
"%PY_CMD%" -m venv .venv
if %errorlevel% neq 0 (
    echo [HATA] Sanal ortam olusturulamadi!
    pause
    exit /b 1
)

echo [INFO] Kutuphaneler yukleniyor (requirements.txt)...
.venv\Scripts\pip.exe install -r requirements.txt
if %errorlevel% neq 0 (
    echo [HATA] Kutuphaneler yuklenemedi!
    pause
    exit /b 1
)

:RUN_SERVER
echo [INFO] RemaLab Sunucusu baslatiliyor...
echo.
.venv\Scripts\python.exe server.py

if %errorlevel% equ 42 goto START_SERVER

echo.
echo ===================================================
echo   Sunucu kapandi veya durduruldu.
echo   Kapatmak icin bir tusa basiniz...
echo ===================================================
echo.
pause
