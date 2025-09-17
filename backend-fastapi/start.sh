#!/bin/bash
# OpSentra FastAPI Startup Script with Virtual Environment
# Phase 4: Backend-FastAPI - Virtual Environment Wrapper

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    print_error "Virtual environment not found!"
    print_info "Please run the installation script first: ./install-all.sh"
    exit 1
fi

# Check if virtual environment has uvicorn
if [ ! -f "venv/bin/uvicorn" ]; then
    print_error "uvicorn not found in virtual environment!"
    print_info "Please run the installation script to install dependencies"
    exit 1
fi

print_info "Starting OpSentra FastAPI AI Layer..."
print_info "Activating virtual environment..."

# Activate virtual environment and start uvicorn
source venv/bin/activate

# Check if requirements are met
python -c "import fastapi, uvicorn, aio_pika" 2>/dev/null
if [ $? -ne 0 ]; then
    print_error "Required Python packages not found!"
    print_info "Please run: pip install -r requirements.txt"
    exit 1
fi

print_success "Virtual environment activated"
print_info "Starting uvicorn server on 0.0.0.0:8000..."

# Start uvicorn with proper configuration
exec uvicorn main:app --host 0.0.0.0 --port 8000 --reload --log-level info
