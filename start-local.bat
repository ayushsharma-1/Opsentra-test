@echo off
REM OpSentra Platform - Local Development Startup Script (Windows)
REM Phase 3: Enhanced startup with Core Aggregator and service dependencies

echo ==================================================
echo OpSentra Platform - Local Development Environment
echo Starting all services for local development
echo Phase 3: Backend-Node Core Aggregator Integration
echo ==================================================

REM Set console colors
color 0A

REM Enable delayed variable expansion
setlocal enabledelayedexpansion

REM Configuration
set "FRONTEND_PORT=5050"
set "BACKEND_NODE_PORT=5051"
set "BACKEND_FASTAPI_PORT=5052"
set "BACKEND_SERVICE_PORT=5053"

REM Process tracking arrays (simulated with variables)
set "PID_COUNT=0"

REM Handle command line arguments
if "%1"=="stop" goto stop_services
if "%1"=="status" goto show_status
if "%1"=="logs" goto show_logs
if "%1"=="help" goto show_help

:main
echo Starting OpSentra Platform local development environment...
echo Started at: %date% %time%
echo.

call :check_prerequisites
if errorlevel 1 goto error_exit

call :setup_logging
call :start_services
call :show_service_status
call :monitor_services

goto end

:check_prerequisites
echo.
echo === Checking Prerequisites ===

set "ERRORS=0"

REM Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found
    set /a ERRORS+=1
) else (
    for /f "delims=" %%i in ('node --version') do set NODE_VERSION=%%i
    echo [SUCCESS] Node.js: !NODE_VERSION!
)

REM Check npm
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm not found
    set /a ERRORS+=1
)

REM Check Python for FastAPI
where python >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Python not found - FastAPI service will be skipped
    set "SKIP_FASTAPI=1"
) else (
    for /f "delims=" %%i in ('python --version') do set PYTHON_VERSION=%%i
    echo [SUCCESS] Python: !PYTHON_VERSION!
)

REM Check if services exist
for %%s in (frontend backend-node backend-service) do (
    if not exist %%s (
        echo [ERROR] %%s directory not found
        set /a ERRORS+=1
    ) else if not exist %%s\package.json (
        echo [ERROR] %%s\package.json not found
        set /a ERRORS+=1
    )
)

if %ERRORS% gtr 0 (
    echo [ERROR] Prerequisites check failed. Please run install-all.bat first.
    exit /b 1
)

echo [SUCCESS] All prerequisites satisfied
exit /b 0

:setup_logging
echo.
echo === Setting Up Logging ===

if not exist logs mkdir logs

REM Clear previous logs
for %%f in (logs\*.log) do (
    if exist "%%f" (
        type nul > "%%f"
    )
)

echo [SUCCESS] Log directory prepared
exit /b 0

:start_services
echo.
echo === Starting Services ===

call :start_backend_node
timeout /t 3 /nobreak >nul

if not defined SKIP_FASTAPI (
    call :start_backend_fastapi
    timeout /t 3 /nobreak >nul
)

call :start_backend_service
timeout /t 3 /nobreak >nul

call :start_frontend
timeout /t 5 /nobreak >nul

exit /b 0

:start_backend_node
echo [SERVICE] Starting Backend-Node (Core Aggregator) on port %BACKEND_NODE_PORT%

REM Check if port is in use
netstat -an | findstr ":%BACKEND_NODE_PORT%" >nul
if not errorlevel 1 (
    echo [ERROR] Port %BACKEND_NODE_PORT% is already in use
    exit /b 1
)

pushd backend-node

REM Set environment variables
set NODE_ENV=development
set PORT=%BACKEND_NODE_PORT%
set DEBUG=opsentra:*

REM Start the service
start "Backend-Node" cmd /c "npm run dev > ..\logs\backend-node.log 2>&1"

echo [SUCCESS] Backend-Node started
popd
exit /b 0

:start_backend_fastapi
echo [SERVICE] Starting Backend-FastAPI (AI Analysis) on port %BACKEND_FASTAPI_PORT%

REM Check if port is in use
netstat -an | findstr ":%BACKEND_FASTAPI_PORT%" >nul
if not errorlevel 1 (
    echo [ERROR] Port %BACKEND_FASTAPI_PORT% is already in use
    exit /b 1
)

pushd backend-fastapi

REM Check if FastAPI is installed
python -c "import fastapi" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] FastAPI not installed. Run: pip install -r requirements.txt
    popd
    exit /b 1
)

REM Set environment variables
set PYTHONPATH=%cd%;%PYTHONPATH%
set ENVIRONMENT=development
set PORT=%BACKEND_FASTAPI_PORT%

REM Start the service
start "Backend-FastAPI" cmd /c "python -m uvicorn main:app --host 0.0.0.0 --port %BACKEND_FASTAPI_PORT% --reload > ..\logs\backend-fastapi.log 2>&1"

echo [SUCCESS] Backend-FastAPI started
popd
exit /b 0

:start_backend_service
echo [SERVICE] Starting Backend-Service (Log Shipper) on port %BACKEND_SERVICE_PORT%

REM Check if port is in use
netstat -an | findstr ":%BACKEND_SERVICE_PORT%" >nul
if not errorlevel 1 (
    echo [ERROR] Port %BACKEND_SERVICE_PORT% is already in use
    exit /b 1
)

pushd backend-service

REM Set environment variables
set NODE_ENV=development
set PORT=%BACKEND_SERVICE_PORT%
set DEBUG=logshipper:*

REM Start the service
start "Backend-Service" cmd /c "npm run dev > ..\logs\backend-service.log 2>&1"

echo [SUCCESS] Backend-Service started
popd
exit /b 0

:start_frontend
echo [SERVICE] Starting Frontend (React + Vite) on port %FRONTEND_PORT%

REM Check if port is in use
netstat -an | findstr ":%FRONTEND_PORT%" >nul
if not errorlevel 1 (
    echo [ERROR] Port %FRONTEND_PORT% is already in use
    exit /b 1
)

pushd frontend

REM Set environment variables
set NODE_ENV=development
set VITE_PORT=%FRONTEND_PORT%
set VITE_BACKEND_NODE_URL=http://localhost:%BACKEND_NODE_PORT%
set VITE_BACKEND_FASTAPI_URL=http://localhost:%BACKEND_FASTAPI_PORT%
set VITE_BACKEND_SERVICE_URL=http://localhost:%BACKEND_SERVICE_PORT%

REM Start Vite dev server
start "Frontend" cmd /c "npm run dev -- --port %FRONTEND_PORT% --host 0.0.0.0 > ..\logs\frontend.log 2>&1"

echo [SUCCESS] Frontend started
popd
exit /b 0

:show_service_status
echo.
echo === Service Status ===
echo.
echo OpSentra Platform Services:
echo.

REM Check each service by looking for running processes
tasklist | findstr "node.exe" >nul
if not errorlevel 1 (
    echo [SUCCESS] Node.js services - Running
) else (
    echo [ERROR] Node.js services - Not Running
)

tasklist | findstr "python.exe" >nul
if not errorlevel 1 (
    echo [SUCCESS] Python services - Running
) else (
    if not defined SKIP_FASTAPI (
        echo [ERROR] Python services - Not Running
    )
)

echo.
echo Access URLs:
echo   Dashboard:      http://localhost:%FRONTEND_PORT%
echo   Backend API:    http://localhost:%BACKEND_NODE_PORT%/health
echo   AI Service:     http://localhost:%BACKEND_FASTAPI_PORT%/health
echo   Log Shipper:    http://localhost:%BACKEND_SERVICE_PORT%/health
echo   SSE Stream:     http://localhost:%BACKEND_NODE_PORT%/stream
echo.
echo Monitoring Commands:
echo   Service Status: pm2 status
echo   View Logs:      type logs\*.log
echo   Restart:        pm2 restart all
echo.
echo Press Ctrl+C to stop services or close this window
exit /b 0

:monitor_services
echo.
echo === Monitoring Services ===
echo Services are running. Check individual console windows for output.
echo Log files are being written to the logs\ directory.
echo.
echo Press any key to stop monitoring (services will continue running)...
pause >nul
exit /b 0

:stop_services
echo.
echo === Stopping Services ===

REM Kill all Node.js processes that might be our services
for /f "tokens=2" %%i in ('tasklist /fi "imagename eq node.exe" /fo table /nh 2^>nul') do (
    if not "%%i"=="" (
        echo Stopping Node.js process %%i
        taskkill /pid %%i /f >nul 2>&1
    )
)

REM Kill Python processes (uvicorn)
for /f "tokens=2" %%i in ('tasklist /fi "imagename eq python.exe" /fo table /nh 2^>nul') do (
    if not "%%i"=="" (
        echo Stopping Python process %%i
        taskkill /pid %%i /f >nul 2>&1
    )
)

echo [SUCCESS] All services stopped
goto end

:show_status
echo.
echo === Service Status Check ===

netstat -an | findstr ":%FRONTEND_PORT% :%BACKEND_NODE_PORT% :%BACKEND_FASTAPI_PORT% :%BACKEND_SERVICE_PORT%"
if errorlevel 1 (
    echo [WARNING] No services appear to be running on expected ports
) else (
    echo [SUCCESS] Services are running on expected ports
)
goto end

:show_logs
echo.
echo === Recent Logs ===

if not exist logs (
    echo [WARNING] No logs directory found
    goto end
)

for %%f in (logs\*.log) do (
    if exist "%%f" (
        echo.
        echo === %%f ===
        powershell "Get-Content '%%f' | Select-Object -Last 20"
    )
)
goto end

:show_help
echo.
echo Usage: %0 [start^|stop^|status^|logs^|help]
echo.
echo Commands:
echo   start   - Start all services (default)
echo   stop    - Stop all services
echo   status  - Check service status
echo   logs    - Show recent logs
echo   help    - Show this help message
goto end

:error_exit
echo.
echo [ERROR] Script failed. Please check the output above for errors.
pause
exit /b 1

:end
echo.
echo Script completed at: %date% %time%
pause