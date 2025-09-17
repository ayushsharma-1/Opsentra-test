    @echo off
REM OpSentra Platform - Complete Dependency Installation Script (Windows)
REM Phase 3: Enhanced installation for all services with dependency resolution

echo ==================================================
echo OpSentra Platform - Complete Installation
echo Installing dependencies for all services
echo Phase 3: Backend-Node Core Aggregator Integration
echo ==================================================

REM Set console colors
color 0B

REM Enable delayed variable expansion
setlocal enabledelayedexpansion

REM Error handling
set "ERRORS=0"

:check_prerequisites
echo.
echo === Checking Prerequisites ===

REM Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install Node.js 18+ from https://nodejs.org/
    set /a ERRORS+=1
) else (
    for /f "delims=" %%i in ('node --version') do set NODE_VERSION=%%i
    echo [SUCCESS] Node.js found: !NODE_VERSION!
)

REM Check npm
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm not found. Please install npm.
    set /a ERRORS+=1
) else (
    for /f "delims=" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo [SUCCESS] npm found: v!NPM_VERSION!
)

REM Check Python
where python >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Python not found. Backend-FastAPI will not work without Python 3.9+
) else (
    for /f "delims=" %%i in ('python --version') do set PYTHON_VERSION=%%i
    echo [SUCCESS] Python found: !PYTHON_VERSION!
)

REM Check pip
where pip >nul 2>&1
if errorlevel 1 (
    echo [WARNING] pip not found. Python dependencies will not install.
) else (
    echo [SUCCESS] pip found
)

if %ERRORS% gtr 0 (
    echo [ERROR] Prerequisites check failed. Please install missing dependencies.
    pause
    exit /b 1
)

:install_root_dependencies
echo.
echo === Installing Root Dependencies ===

if exist package.json (
    echo [INFO] Installing root package dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install root dependencies
        set /a ERRORS+=1
    ) else (
        echo [SUCCESS] Root dependencies installed successfully
    )
) else (
    echo [WARNING] No root package.json found, skipping root installation
)

:install_frontend
echo.
echo === Installing Frontend Dependencies (React + Vite) ===

if exist frontend (
    pushd frontend
    
    if exist package.json (
        echo [INFO] Installing React + Vite dependencies...
        call npm install
        if errorlevel 1 (
            echo [ERROR] Failed to install frontend dependencies
            set /a ERRORS+=1
        ) else (
            echo [SUCCESS] Frontend dependencies installed successfully
            
            echo [INFO] Building React app for production...
            call npm run build
            if errorlevel 1 (
                echo [WARNING] Frontend build failed
            ) else (
                echo [SUCCESS] Frontend built successfully
            )
        )
    ) else (
        echo [ERROR] frontend\package.json not found
        set /a ERRORS+=1
    )
    
    popd
) else (
    echo [ERROR] frontend\ directory not found
    set /a ERRORS+=1
)

:install_backend_node
echo.
echo === Installing Backend-Node Dependencies (Phase 3 Core Aggregator) ===

if exist backend-node (
    pushd backend-node
    
    if exist package.json (
        echo [INFO] Installing Node.js backend dependencies...
        echo [INFO] Including: express@5.1.0, mongodb@6.19.0, amqplib@0.10.9, @aws-sdk/client-s3@3.890.0
        call npm install
        if errorlevel 1 (
            echo [ERROR] Failed to install backend-node dependencies
            set /a ERRORS+=1
        ) else (
            echo [SUCCESS] Backend-Node dependencies installed successfully
            
            REM Verify critical dependencies
            call npm list express >nul 2>&1
            if not errorlevel 1 (
                echo [SUCCESS] Express.js installed
            )
            
            call npm list mongodb >nul 2>&1
            if not errorlevel 1 (
                echo [SUCCESS] MongoDB driver installed
            )
            
            call npm list amqplib >nul 2>&1
            if not errorlevel 1 (
                echo [SUCCESS] AMQP library installed
            )
        )
    ) else (
        echo [ERROR] backend-node\package.json not found
        set /a ERRORS+=1
    )
    
    popd
) else (
    echo [ERROR] backend-node\ directory not found
    set /a ERRORS+=1
)

:install_backend_fastapi
echo.
echo === Installing Backend-FastAPI Dependencies (AI Analysis Layer) ===

if exist backend-fastapi (
    pushd backend-fastapi
    
    if exist requirements.txt (
        where pip >nul 2>&1
        if not errorlevel 1 (
            echo [INFO] Installing Python FastAPI dependencies...
            call pip install -r requirements.txt
            if errorlevel 1 (
                echo [ERROR] Failed to install FastAPI dependencies
                set /a ERRORS+=1
            ) else (
                echo [SUCCESS] Backend-FastAPI dependencies installed successfully
            )
        ) else (
            echo [ERROR] pip not found. Cannot install Python dependencies.
            echo [INFO] Please install Python 3.9+ and pip, then run: pip install -r backend-fastapi\requirements.txt
        )
    ) else (
        echo [ERROR] backend-fastapi\requirements.txt not found
        set /a ERRORS+=1
    )
    
    popd
) else (
    echo [ERROR] backend-fastapi\ directory not found
    set /a ERRORS+=1
)

:install_backend_service
echo.
echo === Installing Backend-Service Dependencies (Phase 2 Log Shipper) ===

if exist backend-service (
    pushd backend-service
    
    if exist package.json (
        echo [INFO] Installing log shipper dependencies...
        echo [INFO] Including: @sematext/logagent@3.3.1, pino@9.9.5, @aws-sdk/client-s3@3.890.0
        call npm install
        if errorlevel 1 (
            echo [ERROR] Failed to install backend-service dependencies
            set /a ERRORS+=1
        ) else (
            echo [SUCCESS] Backend-Service dependencies installed successfully
        )
    ) else (
        echo [ERROR] backend-service\package.json not found
        set /a ERRORS+=1
    )
    
    popd
) else (
    echo [ERROR] backend-service\ directory not found
    set /a ERRORS+=1
)

:install_pm2
echo.
echo === Installing PM2 Process Manager ===

where pm2 >nul 2>&1
if not errorlevel 1 (
    for /f "delims=" %%i in ('pm2 --version') do set PM2_VERSION=%%i
    echo [SUCCESS] PM2 already installed: v!PM2_VERSION!
) else (
    echo [INFO] Installing PM2 globally...
    call npm install -g pm2
    if errorlevel 1 (
        echo [ERROR] Failed to install PM2
        set /a ERRORS+=1
    ) else (
        echo [SUCCESS] PM2 installed successfully
    )
)

:verify_installation
echo.
echo === Verifying Installation ===

REM Check if all directories have node_modules
for %%d in (frontend backend-node backend-service) do (
    if exist %%d\node_modules (
        echo [SUCCESS] %%d: dependencies installed
    ) else (
        echo [ERROR] %%d: node_modules not found
        set /a ERRORS+=1
    )
)

REM Check if frontend build exists
if exist frontend\dist (
    echo [SUCCESS] Frontend: production build created
) else (
    echo [WARNING] Frontend: production build not found
)

REM Check Python installation
if exist backend-fastapi (
    where python >nul 2>&1
    if not errorlevel 1 (
        pushd backend-fastapi
        python -c "import fastapi" >nul 2>&1
        if not errorlevel 1 (
            echo [SUCCESS] FastAPI: Python dependencies verified
        ) else (
            echo [ERROR] FastAPI: Python dependencies not properly installed
            set /a ERRORS+=1
        )
        popd
    )
)

:completion
echo.
echo === Installation Complete ===

if %ERRORS% equ 0 (
    echo.
    echo [SUCCESS] OpSentra Platform installation completed successfully!
    echo.
    echo Next steps:
    echo 1. Configure environment variables (if not already done):
    echo    - Copy .env.example to .env and fill in your credentials
    echo    - Each service has .env.local with production-ready values
    echo.
    echo 2. Start the development environment:
    echo    npm run dev
    echo.
    echo 3. Start the production environment:
    echo    npm run start
    echo.
    echo 4. Access the services:
    echo    - Dashboard: http://localhost:5050
    echo    - Backend API: http://localhost:5051/health
    echo    - AI Service: http://localhost:5052/health
    echo    - SSE Stream: http://localhost:5050/stream
    echo.
    echo 5. Monitor services:
    echo    pm2 status
    echo    pm2 logs
    echo.
    echo For troubleshooting, check individual service logs and the deployment guide.
) else (
    echo [ERROR] Installation completed with %ERRORS% error(s).
    echo Please review the output above and fix any issues before proceeding.
)

echo.
echo Installation completed at: %date% %time%
pause