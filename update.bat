@echo off
title RemaLab WMS Sunucu Guncelleme Sihirbazi
cd /d "%~dp0"

cls
echo ===================================================
echo   RemaLab WMS Sunucu Guncelleme Sihirbazi
echo ===================================================
echo.

rem Git kurulu mu kontrol et
where git >nul 2>nul
if %errorlevel% equ 0 (
    echo [1/4] Git bulundu, GitHub'dan en son kodlar cekiliyor (git pull)...
    git pull origin main
    if %errorlevel% neq 0 (
        echo [WARN] Git pull sirasinda hata olustu, ZIP indirme yontemine geciliyor...
        goto DOWNLOAD_ZIP
    )
) else (
    :DOWNLOAD_ZIP
    echo [1/4] Git bulunamadi. GitHub'dan en son ZIP paketi indiriliyor...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/YusufPEKERR/remalab/archive/refs/heads/main.zip' -OutFile 'latest_update.zip'"
    
    if exist latest_update.zip (
        echo [INFO] ZIP paketi aciliyor ve dosyalar guncelleniyor...
        powershell -Command "Expand-Archive -Path 'latest_update.zip' -DestinationPath 'temp_update' -Force"
        if exist temp_update\remalab-main (
            xcopy /s /e /y "temp_update\remalab-main\*" "." >nul
            rmdir /s /q temp_update
            del /f /q latest_update.zip
            echo [SUCCESS] Dosyalar ZIP paketinden basariyla guncellendi.
        ) else (
            echo [ERROR] ZIP icerigi cikartilamadi!
            pause
            exit /b
        )
    ) else (
        echo [ERROR] Guncelleme paketi indirilemedi! Lutfen internet baglantinizi kontrol edin.
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
