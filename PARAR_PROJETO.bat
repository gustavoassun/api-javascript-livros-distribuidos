@echo off
cd /d "%~dp0"
title Parar projeto - Sistemas Distribuidos

docker compose down

echo.
echo Projeto encerrado. Os dados dos bancos foram preservados.
pause
