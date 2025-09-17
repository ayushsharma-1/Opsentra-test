#!/bin/bash
# OpSentra Platform - Complete Dependency Installation Script
# Phase 3: Enhanced installation for all services with dependency resolution

echo "=================================================="
echo "OpSentra Platform - Complete Installation"
echo "Installing dependencies for all services"
echo "Phase 3: Backend-Node Core Aggregator Integration"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Error handling
set -e
trap 'print_error "Installation failed. Check the output above for errors."; exit 1' ERR

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
        if [ "$NODE_MAJOR" -ge 18 ]; then
            print_success "Node.js found: $NODE_VERSION (✓ Compatible)"
        else
            print_error "Node.js version $NODE_VERSION is too old. Please install Node.js 18 or higher."
            exit 1
        fi
    else
        print_error "Node.js not found. Please install Node.js 18 or higher from https://nodejs.org/"
        exit 1
    fi
    
    # Check npm
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        print_success "npm found: v$NPM_VERSION"
    else
        print_error "npm not found. Please install npm."
        exit 1
    fi
    
    # Check Python
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version)
        print_success "Python3 found: $PYTHON_VERSION"
    else
        print_warning "Python3 not found. Backend-FastAPI will not work without Python 3.9+"
    fi
    
    # Check pip
    if command -v pip3 &> /dev/null; then
        PIP_VERSION=$(pip3 --version)
        print_success "pip3 found: $PIP_VERSION"
    else
        print_warning "pip3 not found. Python dependencies will not install."
    fi
}

# Install root dependencies
install_root_dependencies() {
    print_header "Installing Root Dependencies"
    
    if [ -f package.json ]; then
        print_info "Installing root package dependencies..."
        npm install
        print_success "Root dependencies installed successfully"
    else
        print_warning "No root package.json found, skipping root installation"
    fi
}

# Install frontend dependencies
install_frontend() {
    print_header "Installing Frontend Dependencies (React + Vite)"
    
    if [ -d "frontend" ]; then
        cd frontend
        
        if [ -f package.json ]; then
            print_info "Installing React + Vite dependencies..."
            npm install
            print_success "Frontend dependencies installed successfully"
            
            # Build frontend for production
            print_info "Building React app for production..."
            npm run build
            print_success "Frontend built successfully"
        else
            print_error "frontend/package.json not found"
            exit 1
        fi
        
        cd ..
    else
        print_error "frontend/ directory not found"
        exit 1
    fi
}

# Install backend-node dependencies
install_backend_node() {
    print_header "Installing Backend-Node Dependencies (Phase 3 Core Aggregator)"
    
    if [ -d "backend-node" ]; then
        cd backend-node
        
        if [ -f package.json ]; then
            print_info "Installing Node.js backend dependencies..."
            print_info "Including: express@5.1.0, mongodb@6.19.0, amqplib@0.10.9, @aws-sdk/client-s3@3.890.0"
            npm install
            print_success "Backend-Node dependencies installed successfully"
            
            # Verify critical dependencies
            if npm list express > /dev/null 2>&1; then
                EXPRESS_VERSION=$(npm list express --depth=0 | grep express | cut -d'@' -f2)
                print_success "Express.js installed: v$EXPRESS_VERSION"
            fi
            
            if npm list mongodb > /dev/null 2>&1; then
                MONGODB_VERSION=$(npm list mongodb --depth=0 | grep mongodb | cut -d'@' -f2)
                print_success "MongoDB driver installed: v$MONGODB_VERSION"
            fi
            
            if npm list amqplib > /dev/null 2>&1; then
                print_success "AMQP library installed"
            fi
            
        else
            print_error "backend-node/package.json not found"
            exit 1
        fi
        
        cd ..
    else
        print_error "backend-node/ directory not found"
        exit 1
    fi
}

# Install backend-fastapi dependencies
install_backend_fastapi() {
    print_header "Installing Backend-FastAPI Dependencies (AI Analysis Layer)"
    
    if [ -d "backend-fastapi" ]; then
        cd backend-fastapi
        
        if [ -f requirements.txt ]; then
            if command -v pip3 &> /dev/null; then
                print_info "Installing Python FastAPI dependencies..."
                pip3 install -r requirements.txt
                print_success "Backend-FastAPI dependencies installed successfully"
            else
                print_error "pip3 not found. Cannot install Python dependencies."
                print_info "Please install Python 3.9+ and pip3, then run: pip3 install -r backend-fastapi/requirements.txt"
            fi
        else
            print_error "backend-fastapi/requirements.txt not found"
            exit 1
        fi
        
        cd ..
    else
        print_error "backend-fastapi/ directory not found"
        exit 1
    fi
}

# Install backend-service dependencies (Phase 2 Log Shipper)
install_backend_service() {
    print_header "Installing Backend-Service Dependencies (Phase 2 Log Shipper)"
    
    if [ -d "backend-service" ]; then
        cd backend-service
        
        if [ -f package.json ]; then
            print_info "Installing log shipper dependencies..."
            print_info "Including: @sematext/logagent@3.3.1, pino@9.9.5, @aws-sdk/client-s3@3.890.0"
            npm install
            print_success "Backend-Service dependencies installed successfully"
        else
            print_error "backend-service/package.json not found"
            exit 1
        fi
        
        cd ..
    else
        print_error "backend-service/ directory not found"
        exit 1
    fi
}

# Install PM2 globally if not present
install_pm2() {
    print_header "Installing PM2 Process Manager"
    
    if command -v pm2 &> /dev/null; then
        PM2_VERSION=$(pm2 --version)
        print_success "PM2 already installed: v$PM2_VERSION"
    else
        print_info "Installing PM2 globally..."
        npm install -g pm2
        print_success "PM2 installed successfully"
    fi
}

# Verify installation
verify_installation() {
    print_header "Verifying Installation"
    
    local errors=0
    
    # Check if all directories have node_modules
    for dir in "frontend" "backend-node" "backend-service"; do
        if [ -d "$dir/node_modules" ]; then
            print_success "$dir: dependencies installed"
        else
            print_error "$dir: node_modules not found"
            errors=$((errors + 1))
        fi
    done
    
    # Check if frontend build exists
    if [ -d "frontend/dist" ]; then
        print_success "Frontend: production build created"
    else
        print_warning "Frontend: production build not found"
    fi
    
    # Check Python installation
    if [ -d "backend-fastapi" ] && command -v python3 &> /dev/null; then
        cd backend-fastapi
        if python3 -c "import fastapi" 2>/dev/null; then
            print_success "FastAPI: Python dependencies verified"
        else
            print_error "FastAPI: Python dependencies not properly installed"
            errors=$((errors + 1))
        fi
        cd ..
    fi
    
    if [ $errors -eq 0 ]; then
        print_success "All installations verified successfully!"
    else
        print_error "$errors error(s) found during verification"
        return 1
    fi
}

# Create environment setup reminder
create_env_reminder() {
    print_header "Environment Configuration Reminder"
    
    print_info "Environment files status:"
    
    if [ -f ".env" ]; then
        print_success "Root .env file exists"
    else
        print_warning "Root .env file missing - copy from .env.example"
    fi
    
    for service in "frontend" "backend-node" "backend-fastapi" "backend-service"; do
        if [ -f "$service/.env.local" ]; then
            print_success "$service: .env.local exists"
        else
            print_warning "$service: .env.local missing"
        fi
    done
}

# Display post-installation information
show_completion_info() {
    print_header "Installation Complete!"
    
    echo -e "${GREEN}"
    echo "🎉 OpSentra Platform installation completed successfully!"
    echo -e "${NC}"
    
    print_info "Next steps:"
    echo "1. Configure environment variables (if not already done):"
    echo "   - Copy .env.example to .env and fill in your credentials"
    echo "   - Each service has .env.local with production-ready values"
    echo ""
    echo "2. Start the development environment:"
    echo "   npm run dev"
    echo ""
    echo "3. Start the production environment:"
    echo "   npm run start"
    echo ""
    echo "4. Access the services:"
    echo "   - Dashboard: http://localhost:5050"
    echo "   - Backend API: http://localhost:5051/health"
    echo "   - AI Service: http://localhost:5052/health"
    echo "   - SSE Stream: http://localhost:5050/stream"
    echo ""
    echo "5. Monitor services:"
    echo "   pm2 status"
    echo "   pm2 logs"
    echo ""
    print_info "For troubleshooting, check individual service logs and the deployment guide."
}

# Main installation flow
main() {
    echo "Starting OpSentra Platform installation..."
    echo "Installation started at: $(date)"
    echo ""
    
    # Run installation steps
    check_prerequisites
    install_pm2
    install_root_dependencies
    install_frontend
    install_backend_node
    install_backend_fastapi
    install_backend_service
    verify_installation
    create_env_reminder
    show_completion_info
    
    echo ""
    echo "Installation completed at: $(date)"
    
    print_success "OpSentra Platform is ready for use!"
}

# Run main installation
main "$@"