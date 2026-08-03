@echo off
title ERP Web App - Windows EXE Builder

echo ==================================================
echo ERP Web App - Windows EXE Builder
echo ==================================================

cd /d "%~dp0"

echo.
echo [1/3] Checking Python dependencies...
python -m pip install --quiet --upgrade pip
python -m pip install --quiet -r requirements.txt pyinstaller

echo.
echo [2/3] Cleaning previous build folders...
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist

echo.
echo [3/3] Building executable with PyInstaller...
python -m PyInstaller --noconfirm --onedir --windowed --name="ERPWebApp" --add-data "sites.json;." --add-data "logo.png;." main.py

echo.
if exist "dist\ERPWebApp\ERPWebApp.exe" (
    echo ==================================================
    echo SUCCESS: ERPWebApp.exe created successfully!
    echo Location: %~dp0dist\ERPWebApp\ERPWebApp.exe
    echo ==================================================
) else (
    echo ERROR: Build failed or output missing.
)

echo.
pause
