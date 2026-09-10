@echo off
cd /d "%~dp0"
chcp 65001 > nul

echo Cleaning up previous Vite processes...
FOR /F "tokens=5" %%T IN ('netstat -a -n -o ^| findstr ":5177 "') DO (
  taskkill /F /PID %%T > nul 2>&1
)

echo Starting Vite Dev Server in background...
start /b npx vite

echo Compiling Electron backend...
call npx tsc -p tsconfig.electron.json

echo Waiting for Vite to start...
timeout /t 3 /nobreak > nul

echo Starting Electron...
set VITE_DEV_SERVER_URL=http://localhost:5177
call npm start

echo Development session ended. Closing Vite...
FOR /F "tokens=5" %%T IN ('netstat -a -n -o ^| findstr ":5177 "') DO (
  taskkill /F /PID %%T > nul 2>&1
)
