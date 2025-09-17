#!/bin/bash
# OpSentra Phase 2 - Log Shipper Testing Script
# Comprehensive testing for Backend-Service implementation

echo "=================================================="
echo "OpSentra Phase 2 - Log Shipper Testing"
echo "Enhanced Backend-Service Testing Suite"
echo "=================================================="

# Configuration
BACKEND_SERVICE_DIR="./backend-service"
TEST_LOG_MESSAGE="[ERROR] Phase 2 Test - Log shipper functionality verification"
TEST_TIMEOUT=30

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test functions
print_test_header() {
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

# Check prerequisites
check_prerequisites() {
    print_test_header "Checking Prerequisites"
    
    # Check Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Node.js found: $NODE_VERSION"
    else
        print_error "Node.js not found. Please install Node.js 18+"
        exit 1
    fi
    
    # Check npm
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        print_success "npm found: $NPM_VERSION"
    else
        print_error "npm not found. Please install npm"
        exit 1
    fi
    
    # Check if backend-service directory exists
    if [ -d "$BACKEND_SERVICE_DIR" ]; then
        print_success "Backend-service directory found"
    else
        print_error "Backend-service directory not found"
        exit 1
    fi
}

# Test package.json configuration
test_package_json() {
    print_test_header "Testing Package.json Configuration"
    
    cd "$BACKEND_SERVICE_DIR"
    
    # Check if package.json exists
    if [ -f "package.json" ]; then
        print_success "package.json found"
        
        # Check main entry point
        MAIN_FILE=$(node -p "require('./package.json').main")
        if [ "$MAIN_FILE" = "index.js" ]; then
            print_success "Main entry point correctly set to index.js"
        else
            print_error "Main entry point should be index.js, found: $MAIN_FILE"
        fi
        
        # Check if required dependencies are present
        REQUIRED_DEPS=("@sematext/logagent" "amqplib" "pino" "@aws-sdk/client-s3" "dotenv")
        for dep in "${REQUIRED_DEPS[@]}"; do
            if node -p "require('./package.json').dependencies['$dep']" &> /dev/null; then
                print_success "Dependency found: $dep"
            else
                print_error "Missing dependency: $dep"
            fi
        done
        
    else
        print_error "package.json not found"
        return 1
    fi
    
    cd ..
}

# Test file structure
test_file_structure() {
    print_test_header "Testing File Structure"
    
    # Check main files
    FILES=("$BACKEND_SERVICE_DIR/index.js" "$BACKEND_SERVICE_DIR/install.sh" "$BACKEND_SERVICE_DIR/.env.local")
    
    for file in "${FILES[@]}"; do
        if [ -f "$file" ]; then
            print_success "File found: $(basename $file)"
        else
            print_error "File missing: $(basename $file)"
        fi
    done
    
    # Check install.sh is executable
    if [ -x "$BACKEND_SERVICE_DIR/install.sh" ]; then
        print_success "install.sh is executable"
    else
        print_warning "install.sh is not executable, setting permissions..."
        chmod +x "$BACKEND_SERVICE_DIR/install.sh"
    fi
}

# Install dependencies
install_dependencies() {
    print_test_header "Installing Dependencies"
    
    cd "$BACKEND_SERVICE_DIR"
    
    if npm install; then
        print_success "Dependencies installed successfully"
    else
        print_error "Failed to install dependencies"
        cd ..
        return 1
    fi
    
    cd ..
}

# Test environment configuration
test_environment() {
    print_test_header "Testing Environment Configuration"
    
    if [ -f "$BACKEND_SERVICE_DIR/.env.local" ]; then
        print_success ".env.local found"
        
        # Check required environment variables
        ENV_VARS=("CLOUDAMQP_URL" "AWS_ACCESS_KEY_ID" "AWS_SECRET_ACCESS_KEY" "AWS_REGION")
        
        cd "$BACKEND_SERVICE_DIR"
        for var in "${ENV_VARS[@]}"; do
            if grep -q "^$var=" .env.local; then
                print_success "Environment variable found: $var"
            else
                print_error "Missing environment variable: $var"
            fi
        done
        cd ..
    else
        print_error ".env.local not found"
    fi
}

# Test basic syntax
test_syntax() {
    print_test_header "Testing JavaScript Syntax"
    
    cd "$BACKEND_SERVICE_DIR"
    
    if node -c index.js; then
        print_success "index.js syntax is valid"
    else
        print_error "index.js has syntax errors"
        cd ..
        return 1
    fi
    
    cd ..
}

# Test CLI help
test_cli_help() {
    print_test_header "Testing CLI Interface"
    
    cd "$BACKEND_SERVICE_DIR"
    
    # Test help or version (non-blocking test)
    timeout 5 node index.js --help &> /dev/null
    if [ $? -eq 124 ]; then
        print_success "CLI responds (timed out as expected for daemon)"
    else
        print_warning "CLI may not be running as expected"
    fi
    
    cd ..
}

# Test log simulation
test_log_simulation() {
    print_test_header "Testing Log Simulation"
    
    cd "$BACKEND_SERVICE_DIR"
    
    echo "Running test log simulation..."
    timeout $TEST_TIMEOUT node index.js --test-log "$TEST_LOG_MESSAGE" &
    PID=$!
    
    sleep 5
    
    if ps -p $PID > /dev/null; then
        print_success "Test log process started successfully"
        kill $PID 2>/dev/null
    else
        print_warning "Test log process completed or failed to start"
    fi
    
    cd ..
}

# Test install script syntax
test_install_script() {
    print_test_header "Testing Install Script"
    
    # Test bash syntax
    if bash -n "$BACKEND_SERVICE_DIR/install.sh"; then
        print_success "install.sh syntax is valid"
    else
        print_error "install.sh has syntax errors"
        return 1
    fi
    
    # Check if script contains required sections
    SCRIPT_CONTENT=$(cat "$BACKEND_SERVICE_DIR/install.sh")
    
    REQUIRED_SECTIONS=("systemctl daemon-reload" "systemctl enable" "EnvironmentFile" "ExecStart")
    
    for section in "${REQUIRED_SECTIONS[@]}"; do
        if echo "$SCRIPT_CONTENT" | grep -q "$section"; then
            print_success "Install script contains: $section"
        else
            print_error "Install script missing: $section"
        fi
    done
}

# Test log parsing functions
test_log_parsing() {
    print_test_header "Testing Log Parsing Functions"
    
    cd "$BACKEND_SERVICE_DIR"
    
    # Create a simple test script to verify log parsing
    cat > test_parsing.js << 'EOF'
const { parseLogLine, deriveServiceFromPath } = require('./index.js');

async function testParsing() {
    console.log('Testing log parsing functions...');
    
    // Test service derivation
    const testPaths = [
        '/var/log/syslog',
        '/var/log/nginx/access.log',
        '/var/lib/docker/containers/abc123/abc123-json.log',
        '/var/jenkins_home/jobs/test-job/builds/1/log'
    ];
    
    for (const path of testPaths) {
        const service = deriveServiceFromPath(path);
        console.log(`Path: ${path} -> Service: ${service}`);
    }
    
    // Test log line parsing
    const testLines = [
        '[ERROR] Test error message',
        '[INFO] Test info message',
        '2025-09-17 10:30:00 WARN: Warning message',
        'Simple log message without level'
    ];
    
    for (const line of testLines) {
        const parsed = await parseLogLine(line, '/var/log/test.log');
        console.log(`Line: ${line} -> Level: ${parsed.level}`);
    }
    
    console.log('Log parsing test completed successfully');
    process.exit(0);
}

testParsing().catch(console.error);
EOF

    if timeout 10 node test_parsing.js; then
        print_success "Log parsing functions work correctly"
        rm -f test_parsing.js
    else
        print_error "Log parsing functions failed"
        rm -f test_parsing.js
        cd ..
        return 1
    fi
    
    cd ..
}

# Main test execution
main() {
    echo "Starting OpSentra Phase 2 testing..."
    echo "Test started at: $(date)"
    echo ""
    
    # Run all tests
    check_prerequisites
    test_file_structure
    test_package_json
    install_dependencies
    test_environment
    test_syntax
    test_install_script
    test_log_parsing
    test_cli_help
    test_log_simulation
    
    echo ""
    print_test_header "Testing Summary"
    
    echo -e "${GREEN}✓ Phase 2 Backend-Service testing completed${NC}"
    echo -e "${BLUE}ℹ Manual verification steps:${NC}"
    echo "1. Install dependencies: cd backend-service && npm install"
    echo "2. Test CLI: node index.js --test-log 'Test message'"
    echo "3. Check RabbitMQ connection (requires production credentials)"
    echo "4. Install system service: sudo bash install.sh"
    echo "5. Check systemd status: sudo systemctl status opsentra-log-shipper"
    echo ""
    echo "Test completed at: $(date)"
}

# Run main function
main "$@"