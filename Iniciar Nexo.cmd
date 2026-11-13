@echo off
title Nexo
cd /d "%~dp0"
echo.
echo   Nexo rodando em http://127.0.0.1:3210
echo   Deixe esta janela aberta enquanto usa. Feche para parar.
echo.
start "" /min cmd /c "timeout /t 4 /nobreak >nul && explorer http://127.0.0.1:3210"
npm start
