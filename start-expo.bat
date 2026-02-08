@echo off
cd /d "%~dp0"

REM Install dependencies if needed
if not exist "node_modules" (
    echo Installing dependencies... This may take a minute.
    call npm install
    if errorlevel 1 (
        echo npm install failed.
        pause
        exit /b 1
    )
)

REM Use npm run start - uses local expo from node_modules, no npx needed
echo Starting Expo...
call npm run start
