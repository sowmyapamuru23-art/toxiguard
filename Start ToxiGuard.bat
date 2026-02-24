@echo off
title ToxiGuard
color 0A

set NODE="C:\Program Files\nodejs\node.exe"
set NPX="C:\Program Files\nodejs\npx.cmd"
set APP_DIR=%~dp0

echo.
echo  ==========================================
echo       ToxiGuard - One Click Start
echo  ==========================================
echo.

:: Kill anything already using port 3000
echo  Clearing port 3000 if busy...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 2 /nobreak >nul

:: Start ToxiGuard server
echo  [1/3] Starting ToxiGuard server...
start "ToxiGuard Server" cmd /k "cd /d %APP_DIR% && %NODE% server.js"
timeout /t 4 /nobreak >nul

:: Start LocalTunnel
echo  [2/3] Connecting to internet (toxiguard.loca.lt)...
start "ToxiGuard Tunnel" cmd /k "%NPX% localtunnel --port 3000 --subdomain toxiguard"
timeout /t 6 /nobreak >nul

:: Get tunnel password
echo  [3/3] Getting tunnel password...
for /f "delims=" %%i in ('powershell -Command "(Invoke-WebRequest -Uri 'https://ipv4.icanhazip.com' -UseBasicParsing).Content.Trim()"') do set MY_IP=%%i

:: Open browser
start "" "http://localhost:3000"

echo.
echo  ==========================================
echo.
echo   App is LIVE!
echo.
echo   LOCAL  --^>  http://localhost:3000
echo   PUBLIC --^>  https://toxiguard.loca.lt
echo.
echo   Tunnel Password for visitors:
echo   >>> %MY_IP% <<<
echo.
echo  ==========================================
echo.
echo  IMPORTANT: Keep the two black windows
echo  (Server + Tunnel) open while using app.
echo.
pause
