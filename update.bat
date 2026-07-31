@echo off
title RemaLab WMS Sunucu Guncelleme Sihirbazi
cd /d "%~dp0"

cls
echo ===================================================
echo   RemaLab WMS Sunucu Guncelleme Sihirbazi
echo ===================================================
echo.

rem .env dosyasından GH_TOKEN veya GITHUB_TOKEN oku
set GH_TOKEN=
if exist .env (
    for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
        if "%%a"=="GH_TOKEN" set GH_TOKEN=%%b
        if "%%a"=="GITHUB_TOKEN" set GH_TOKEN=%%b
    )
)

rem Git kurulu mu kontrol et
where git >nul 2>nul
if %errorlevel% equ 0 (
    echo [1/4] Git bulundu, GitHub'dan en son kodlar cekiliyor (git pull)...
    git pull origin main
    if %errorlevel% neq 0 (
        echo [WARN] Git pull yapilamadi, Private GitHub API indirme yontemine geciliyor...
        goto DOWNLOAD_ZIP
    )
) else (
    :DOWNLOAD_ZIP
    echo [1/4] Private GitHub deposundan en son paket indiriliyor...
    
    if defined GH_TOKEN (
        echo [INFO] GitHub Token (.env GH_TOKEN) ile yetkilendiriliyor...
        powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Headers @{ Authorization = 'token %GH_TOKEN%' } -Uri 'https://api.github.com/repos/YusufPEKERR/remalab/zipball/main' -OutFile 'latest_update.zip'"
    ) else (
        echo [INFO] Token bulunamadi, direkt indiriliyor...
        powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/YusufPEKERR/remalab/archive/refs/heads/main.zip' -OutFile 'latest_update.zip'"
    )
    
    if exist latest_update.zip (
        echo [INFO] Guncelleme paketi aciliyor ve dosyalar aktariliyor...
        if exist temp_update rmdir /s /q temp_update
        powershell -Command "Expand-Archive -Path 'latest_update.zip' -DestinationPath 'temp_update' -Force"
        
        set "EXTRACTED="
        for /d %%G in (temp_update\*) do (
            xcopy /s /e /y "%%G\*" "." >nul
            set EXTRACTED=1
        )
        
        rmdir /s /q temp_update
        del /f /q latest_update.zip
        
        if defined EXTRACTED (
            echo [SUCCESS] Dosyalar Private GitHub deposundan basariyla guncellendi.
        ) else (
            echo [ERROR] ZIP paketinin icerigi okunamadi! Token yetkisini kontrol edin.
            pause
            exit /b
        )
    ) else (
        echo [ERROR] Guncelleme paketi indirilemedi! Lutfen .env dosyasina GH_TOKEN ekleyin.
        pause
        exit /b
    )
)

echo.
echo [2/4] Python bagimliliklari kontrol ediliyor...
if exist .venv\Scripts\python.exe (
    .venv\Scripts\pip.exe install -r requirements.txt
) else (
    pip install -r requirements.txt
)

echo.
echo [3/4] React Frontend arayuzu yeniden derleniyor...
cd frontend
call npm install
call npm run build
cd ..

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
echo Guncelleme bitti.
pause
