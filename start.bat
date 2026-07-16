@echo off
title RemaLab WMS Launcher
cd /d "%~dp0"

if exist .venv\Scripts\python.exe (
    echo [INFO] Starting RemaLab WMS using virtual environment...
    .venv\Scripts\python.exe main.py
) else (
    echo [WARNING] .venv directory or python.exe not found!
    echo Trying to run using global python...
    python main.py
)

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Application exited with error code %errorlevel%.
    pause
)
