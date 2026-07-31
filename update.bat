@echo off
title RemaLab WMS Sunucu Guncelleme Sihirbazi
cd /d "%~dp0"

cls
echo ===================================================
echo   RemaLab WMS Sunucu Guncelleme Sihirbazi
echo ===================================================
echo.

rem .env dosyasından GH_TOKEN oku
set GH_TOKEN=
if not exist .env goto CHECK_GIT
for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    if "%%a"=="GH_TOKEN" set "GH_TOKEN=%%b"
    if "%%a"=="GITHUB_TOKEN" set "GH_TOKEN=%%b"
)

:CHECK_GIT
rem Git var mı kontrol et
where git >nul 2>nul
if %errorlevel% neq 0 goto DOWNLOAD_ZIP

echo [1/4] Git bulundu, GitHub'dan en son kodlar cekiliyor (git pull)...
git pull origin main
if %errorlevel% equ 0 goto AFTER_DOWNLOAD
echo [WARN] Git pull yapilamadi, Private GitHub API yontemine geciliyor...

:DOWNLOAD_ZIP
echo [1/4] Private GitHub deposundan en son paket indiriliyor...

if defined GH_TOKEN goto WITH_TOKEN

echo [INFO] Token bulunamadi, direkt indiriliyor...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/YusufPEKERR/remalab/archive/refs/heads/main.zip' -OutFile 'latest_update.zip'"
goto DO_UNZIP

:WITH_TOKEN
echo [INFO] GitHub Token (.env GH_TOKEN) ile yetkilendiriliyor...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Headers @{ Authorization = 'token %GH_TOKEN%' } -Uri 'https://api.github.com/repos/YusufPEKERR/remalab/zipball/main' -OutFile 'latest_update.zip'"

:DO_UNZIP
if not exist latest_update.zip (
    echo.
    echo ===================================================
    echo   [HATA] Guncelleme paketi indirilemedi!
    echo   Lutfen .env dosyasina GH_TOKEN ekleyin.
    echo ===================================================
    echo.
    pause
    exit /b 1
)

echo [INFO] Guncelleme paketi aciliyor ve dosyalar aktariliyor...
if exist temp_update rmdir /s /q temp_update
powershell -Command "Expand-Archive -Path 'latest_update.zip' -DestinationPath 'temp_update' -Force"

set EXTRACTED=
for /d %%G in (temp_update\*) do (
    xcopy /s /e /y "%%G\*" "." >nul
    set EXTRACTED=1
)

if exist temp_update rmdir /s /q temp_update
if exist latest_update.zip del /f /q latest_update.zip

if not defined EXTRACTED (
    echo.
    echo ===================================================
    echo   [HATA] ZIP paketinin icerigi okunamadi! Token yetkisini kontrol edin.
    echo ===================================================
    echo.
    pause
    exit /b 1
)

echo [SUCCESS] Dosyalar Private GitHub deposundan basariyla guncellendi.

:AFTER_DOWNLOAD
echo.
echo [2/4] Python bagimliliklari kontrol ediliyor...
if exist .venv\Scripts\pip.exe (
    .venv\Scripts\pip.exe install -r requirements.txt
) else (
    pip install -r requirements.txt
)

echo.
echo [3/4] React Frontend arayuzu kontrol ediliyor...
where npm >nul 2>nul
if %errorlevel% neq 0 goto NO_NPM

echo [INFO] Node.js/npm bulundu, frontend derleniyor...
cd frontend
call npm install
call npm run build
cd ..
goto FINISHED

:NO_NPM
echo [INFO] Sunucuda npm bulunamadi. Hazir derlenmis (dist) arayuz kullaniliyor.

:FINISHED
echo.
echo ===================================================
echo   GUNCELLEME BASARIYLA TAMAMLANDI!
echo ===================================================
echo.

if exist version.json (
    type version.json
    echo.
)

echo Sunucu simdi yeniden baslatilsin mi?
echo [R] Evet (Sunucuyu Yeniden Baslat)
echo [Q] Hayir (Cikis Yap)
echo.
choice /c RQ /m "Seciminiz [R/Q]:"
if errorlevel 2 goto EXIT_UPDATE
if errorlevel 1 goto LAUNCH_SERVER

:LAUNCH_SERVER
call start.bat
exit /b

:EXIT_UPDATE
echo Guncelleme bitti. Kapatmak icin bir tusa basin...
pause
