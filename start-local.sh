#!/bin/bash
# OpSentra Platform - Local Development Startup Script
# Phase 3: Enhanced startup with Core Aggregator and service dependencies

echo "=================================================="
echo "OpSentra Platform - Local Development Environment"
echo "Starting all services for local development"
echo "Phase 3: Backend-Node Core Aggregator Integration"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Print functions
print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
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

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_service() {
    echo -e "${PURPLE}🚀 $1${NC}"
}

# Configuration
FRONTEND_PORT=${FRONTEND_PORT:-5050}
BACKEND_NODE_PORT=${BACKEND_NODE_PORT:-5051}
BACKEND_FASTAPI_PORT=${BACKEND_FASTAPI_PORT:-5052}
BACKEND_SERVICE_PORT=${BACKEND_SERVICE_PORT:-5053}

# Process tracking
declare -a PIDS=()
declare -a SERVICES=()

# Cleanup function
cleanup() {
    print_header "Cleaning Up Services"
    
    for i in "${!PIDS[@]}"; do
        if [ -n "${PIDS[$i]}" ]; then
            print_info "Stopping ${SERVICES[$i]} (PID: ${PIDS[$i]})"
            kill -TERM "${PIDS[$i]}" 2>/dev/null || true
        fi
    done
    
    # Wait for graceful shutdown
    sleep 2
    
    # Force kill if still running
    for pid in "${PIDS[@]}"; do
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            print_warning "Force killing process $pid"
            kill -KILL "$pid" 2>/dev/null || true
        fi
    done
    
    print_success "All services stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    local errors=0
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js not found"
        errors=$((errors + 1))
    else
        print_success "Node.js: $(node --version)"
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm not found"
        errors=$((errors + 1))
    fi
    
    # Check Python for FastAPI
    if ! command -v python3 &> /dev/null; then
        print_warning "Python3 not found - FastAPI service will be skipped"
    else
        print_success "Python3: $(python3 --version)"
    fi
    
    # Check if services exist
    for service in "frontend" "backend-node" "backend-service"; do
        if [ ! -d "$service" ]; then
            print_error "$service directory not found"
            errors=$((errors + 1))
        elif [ ! -f "$service/package.json" ]; then
            print_error "$service/package.json not found"
            errors=$((errors + 1))
        fi
    done
    
    if [ $errors -gt 0 ]; then
        print_error "Prerequisites check failed. Please run ./install-all.sh first."
        exit 1
    fi
    
    print_success "All prerequisites satisfied"
}

# Check if port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 1
    else
        return 0
    fi
}

# Wait for service to be ready
wait_for_service() {
    local name=$1
    local port=$2
    local max_attempts=${3:-30}
    local attempt=0
    
    print_info "Waiting for $name to be ready on port $port..."
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s "http://localhost:$port" >/dev/null 2>&1 || \
           curl -s "http://localhost:$port/health" >/dev/null 2>&1; then
            print_success "$name is ready"
            return 0
        fi
        
        attempt=$((attempt + 1))
        sleep 1
        echo -n "."
    done
    
    print_warning "$name may not be fully ready (timeout after ${max_attempts}s)"
    return 1
}

# Start Backend-Node (Phase 3 Core Aggregator)
start_backend_node() {
    print_service "Starting Backend-Node (Core Aggregator) on port $BACKEND_NODE_PORT"
    
    if ! check_port $BACKEND_NODE_PORT; then
        print_error "Port $BACKEND_NODE_PORT is already in use"
        return 1
    fi
    
    cd backend-node
    
    # Set environment variables
    export NODE_ENV=development
    export PORT=$BACKEND_NODE_PORT
    export DEBUG=opsentra:*
    
    # Start the service
    npm run dev > ../logs/backend-node.log 2>&1 &
    local pid=$!
    
    PIDS+=($pid)
    SERVICES+=("Backend-Node")
    
    print_success "Backend-Node started (PID: $pid)"
    
    cd ..
    
    # Wait for service to be ready
    wait_for_service "Backend-Node" $BACKEND_NODE_PORT
}

# Start Backend-FastAPI (AI Analysis Layer)
start_backend_fastapi() {
    if ! command -v python3 &> /dev/null; then
        print_warning "Skipping Backend-FastAPI (Python3 not found)"
        return 0
    fi
    
    print_service "Starting Backend-FastAPI (AI Analysis) on port $BACKEND_FASTAPI_PORT"
    
    if ! check_port $BACKEND_FASTAPI_PORT; then
        print_error "Port $BACKEND_FASTAPI_PORT is already in use"
        return 1
    fi
    
    cd backend-fastapi
    
    # Check if FastAPI is installed
    if ! python3 -c "import fastapi" 2>/dev/null; then
        print_error "FastAPI not installed. Run: pip3 install -r requirements.txt"
        cd ..
        return 1
    fi
    
    # Set environment variables
    export PYTHONPATH="$(pwd):$PYTHONPATH"
    export ENVIRONMENT=development
    export PORT=$BACKEND_FASTAPI_PORT
    
    # Start the service
    python3 -m uvicorn main:app --host 0.0.0.0 --port $BACKEND_FASTAPI_PORT --reload > ../logs/backend-fastapi.log 2>&1 &
    local pid=$!
    
    PIDS+=($pid)
    SERVICES+=("Backend-FastAPI")
    
    print_success "Backend-FastAPI started (PID: $pid)"
    
    cd ..
    
    # Wait for service to be ready
    wait_for_service "Backend-FastAPI" $BACKEND_FASTAPI_PORT
}

# Start Backend-Service (Phase 2 Log Shipper)
start_backend_service() {
    print_service "Starting Backend-Service (Log Shipper) on port $BACKEND_SERVICE_PORT"
    
    if ! check_port $BACKEND_SERVICE_PORT; then
        print_error "Port $BACKEND_SERVICE_PORT is already in use"
        return 1
    fi
    
    cd backend-service
    
    # Set environment variables
    export NODE_ENV=development
    export PORT=$BACKEND_SERVICE_PORT
    export DEBUG=logshipper:*
    
    # Start the service
    npm run dev > ../logs/backend-service.log 2>&1 &
    local pid=$!
    
    PIDS+=($pid)
    SERVICES+=("Backend-Service")
    
    print_success "Backend-Service started (PID: $pid)"
    
    cd ..
    
    # Wait for service to be ready
    wait_for_service "Backend-Service" $BACKEND_SERVICE_PORT
}

# Start Frontend (React + Vite)
start_frontend() {
    print_service "Starting Frontend (React + Vite) on port $FRONTEND_PORT"
    
    if ! check_port $FRONTEND_PORT; then
        print_error "Port $FRONTEND_PORT is already in use"
        return 1
    fi
    
    cd frontend
    
    # Set environment variables
    export NODE_ENV=development
    export VITE_PORT=$FRONTEND_PORT
    export VITE_BACKEND_NODE_URL="http://localhost:$BACKEND_NODE_PORT"
    export VITE_BACKEND_FASTAPI_URL="http://localhost:$BACKEND_FASTAPI_PORT"
    export VITE_BACKEND_SERVICE_URL="http://localhost:$BACKEND_SERVICE_PORT"
    
    # Start Vite dev server
    npm run dev -- --port $FRONTEND_PORT --host 0.0.0.0 > ../logs/frontend.log 2>&1 &
    local pid=$!
    
    PIDS+=($pid)
    SERVICES+=("Frontend")
    
    print_success "Frontend started (PID: $pid)"
    
    cd ..
    
    # Wait for service to be ready
    wait_for_service "Frontend" $FRONTEND_PORT 45
}

# Create logs directory
setup_logging() {
    print_header "Setting Up Logging"
    
    mkdir -p logs
    
    # Clear previous logs
    for log in logs/*.log; do
        if [ -f "$log" ]; then
            > "$log"
        fi
    done
    
    print_success "Log directory prepared"
}

# Display service status
show_service_status() {
    print_header "Service Status"
    
    echo -e "${PURPLE}OpSentra Platform Services:${NC}"
    echo ""
    
    # Check each service
    for i in "${!SERVICES[@]}"; do
        local service="${SERVICES[$i]}"
        local pid="${PIDS[$i]}"
        
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            print_success "$service (PID: $pid) - Running"
        else
            print_error "$service - Not Running"
        fi
    done
    
    echo ""
    echo -e "${BLUE}Access URLs:${NC}"
    echo "  🌐 Dashboard:      http://localhost:$FRONTEND_PORT"
    echo "  🔧 Backend API:    http://localhost:$BACKEND_NODE_PORT/health"
    echo "  🤖 AI Service:     http://localhost:$BACKEND_FASTAPI_PORT/health"
    echo "  📊 Log Shipper:    http://localhost:$BACKEND_SERVICE_PORT/health"
    echo "  📡 SSE Stream:     http://localhost:$BACKEND_NODE_PORT/stream"
    echo ""
    echo -e "${BLUE}Monitoring Commands:${NC}"
    echo "  📋 Service Status: pm2 status"
    echo "  📝 View Logs:      tail -f logs/*.log"
    echo "  🔄 Restart:        pm2 restart all"
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
}

# Monitor services
monitor_services() {
    print_header "Monitoring Services"
    
    while true; do
        local failed=0
        
        for i in "${!PIDS[@]}"; do
            if [ -n "${PIDS[$i]}" ] && ! kill -0 "${PIDS[$i]}" 2>/dev/null; then
                print_error "${SERVICES[$i]} has stopped unexpectedly"
                failed=$((failed + 1))
            fi
        done
        
        if [ $failed -gt 0 ]; then
            print_warning "$failed service(s) have failed. Check logs for details."
            break
        fi
        
        sleep 5
    done
}

# Main startup flow
main() {
    echo "Starting OpSentra Platform local development environment..."
    echo "Started at: $(date)"
    echo ""
    
    # Setup
    check_prerequisites
    setup_logging
    
    # Start services in order
    print_header "Starting Services"
    
    # Start backend services first
    start_backend_node
    sleep 2
    
    start_backend_fastapi
    sleep 2
    
    start_backend_service
    sleep 2
    
    # Start frontend last
    start_frontend
    sleep 3
    
    # Show status and monitor
    show_service_status
    
    # Keep running and monitor
    monitor_services
}

# Handle command line arguments
case "${1:-start}" in
    "start")
        main
        ;;
    "stop")
        print_info "Stopping all services..."
        pkill -f "npm run dev" 2>/dev/null || true
        pkill -f "uvicorn" 2>/dev/null || true
        print_success "Services stopped"
        ;;
    "status")
        print_info "Checking service status..."
        if pgrep -f "npm run dev" >/dev/null || pgrep -f "uvicorn" >/dev/null; then
            print_success "Services are running"
            netstat -tulpn | grep -E ":(5050|5051|5052|5053)" || true
        else
            print_warning "No services appear to be running"
        fi
        ;;
    "logs")
        print_info "Showing recent logs..."
        if [ -d "logs" ]; then
            for log in logs/*.log; do
                if [ -f "$log" ]; then
                    echo -e "\n${BLUE}=== $(basename $log) ===${NC}"
                    tail -20 "$log"
                fi
            done
        else
            print_warning "No logs directory found"
        fi
        ;;
    *)
        echo "Usage: $0 [start|stop|status|logs]"
        echo ""
        echo "Commands:"
        echo "  start   - Start all services (default)"
        echo "  stop    - Stop all services"
        echo "  status  - Check service status"
        echo "  logs    - Show recent logs"
        exit 1
        ;;
esac