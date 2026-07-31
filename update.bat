@echo off
title RemaLab WMS Sunucu Guncelleme Sihirbazi
cd /d "%~dp0"

cls
echo ===================================================
echo   RemaLab WMS Sunucu Guncelleme Sihirbazi
echo ===================================================
echo.

echo [1/4] GitHub'dan en son kodlar cekiliyor (git pull)...
git pull origin main
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Git pull yapilamadi! Lutfen yetkilerinizi kontrol edin.
    pause
    exit /b
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
