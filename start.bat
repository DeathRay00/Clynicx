@echo off
title Clynicx - Starting Servers

echo Clearing ports 3001 and 5173 if already in use...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo Starting Clynicx Backend...
start "Clynicx Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"

echo Starting Clynicx Frontend...
start "Clynicx Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Both servers are starting:
echo   Backend  -^> http://localhost:3001
echo   Frontend -^> http://localhost:5173
echo.
