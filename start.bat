@echo off
title Clynicx - Starting Servers

echo Clearing ports 3001 and 5173 if already in use...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo Starting Clynicx Python Backend...
start "Clynicx Backend (Python)" cmd /k "cd /d "%~dp0backend" && venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 3001 --reload"

echo Starting Clynicx Frontend...
start "Clynicx Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Both servers are starting:
echo   Backend  (Python/FastAPI) -^> http://localhost:3001
echo   Frontend (Vite/React)     -^> http://localhost:5173
echo   API Docs (Swagger UI)     -^> http://localhost:3001/docs
echo.
