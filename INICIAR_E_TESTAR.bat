@echo off
cd /d "%~dp0"
title API JavaScript - Sistemas Distribuidos

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\iniciar-e-testar.ps1"

echo.
pause
