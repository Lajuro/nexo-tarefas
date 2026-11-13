@echo off
title Nexo
cd /d "%~dp0"
if "%~1"=="--abrir" goto abrir
echo.
echo   Nexo rodando em http://127.0.0.1:3210
echo   Deixe esta janela aberta enquanto usa. Feche para parar.
echo.
start "" /min "%~f0" --abrir
npm start
goto :eof

:abrir
rem Espera o servidor subir e abre o Nexo em janela propria (modo aplicativo do Edge,
rem sem abas nem barra de endereco). Sem Edge, abre no navegador padrao.
timeout /t 4 /nobreak >nul
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if exist "%EDGE%" (start "" "%EDGE%" --app=http://127.0.0.1:3210) else (explorer http://127.0.0.1:3210)
exit
