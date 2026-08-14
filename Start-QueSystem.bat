@echo off
title QueSystem Launcher
cd /d "%~dp0"
cls
color 0B

echo =========================================================
echo               QueSystem Application Launcher
echo =========================================================
echo.

:: 1. Start PHP Laravel Server in background window
echo [1/3] Starting Laravel backend server...
start "QueSystem Backend Server" /min php artisan serve --port=8000

echo [2/3] Waiting for server to become ready at http://127.0.0.1:8000...
echo       (Please wait while checking connection...)
echo.

set ATTEMPTS=0

:CHECK_LOOP
set /a ATTEMPTS+=1

:: Use curl to check if the server is responding (curl is built into Windows 10/11)
curl.exe -s -o NUL --connect-timeout 1 http://127.0.0.1:8000/
if %ERRORLEVEL% EQU 0 (
    goto SERVER_READY
)

if %ATTEMPTS% GEQ 15 (
    goto TIMEOUT_ERROR
)

echo       Server starting... [attempt %ATTEMPTS%/15]
timeout /t 1 /nobreak >nul
goto CHECK_LOOP

:SERVER_READY
echo.
echo [3/3] Server is live and connected!
echo =========================================================
echo Opening QueSystem in your default browser...
echo URL: http://127.0.0.1:8000
echo =========================================================
echo.
start "" http://127.0.0.1:8000
exit

:TIMEOUT_ERROR
echo.
echo =========================================================
echo [ERROR] Server took too long to respond.
echo Trying to open browser anyway...
echo =========================================================
echo.
start "" http://127.0.0.1:8000
pause
exit
