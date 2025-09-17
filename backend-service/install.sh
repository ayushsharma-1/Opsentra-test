#!/bin/bash
# OpSentra Log Shipper - Systemd Installation Script
# Phase 2: Enhanced Installation with Environment Loading and Security
# Generated: September 2025

set -e  # Exit on any error

echo "=================================================="
echo "OpSentra Log Shipper - Systemd Installation"
echo "Phase 2: Enhanced Log Collection Agent"
echo "=================================================="

# Configuration variables
SERVICE_NAME="opsentra-log-shipper"
INSTALL_DIR="/usr/local/bin"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
ENV_FILE="/etc/default/opsentra"
WORKING_DIR="/opt/opsentra-shipper"
LOG_DIR="/var/log/opsentra"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Error: This script must be run as root (use sudo)"
  exit 1
fi

echo "Step 1: Creating directories and setting up files..."

# Create working directory
mkdir -p "$WORKING_DIR"
mkdir -p "$LOG_DIR"

# Copy service files
echo "Copying OpSentra Log Shipper files..."
cp index.js "$WORKING_DIR/"
cp package.json "$WORKING_DIR/"

# Set proper permissions
chmod 755 "$WORKING_DIR/index.js"
chmod 644 "$WORKING_DIR/package.json"

# Create a dedicated user for the service (security best practice)
if ! id -u "opsentra" &>/dev/null; then
    echo "Creating opsentra user for service..."
    useradd --system --no-create-home --shell /bin/false opsentra
    echo "User 'opsentra' created successfully"
fi

# Set ownership
chown -R opsentra:opsentra "$WORKING_DIR"
chown -R opsentra:opsentra "$LOG_DIR"

echo "Step 2: Installing Node.js dependencies..."
cd "$WORKING_DIR"

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed. Please install Node.js and npm first."
    echo "Visit: https://nodejs.org/"
    exit 1
fi

# Install production dependencies
npm install --production

echo "Step 3: Creating environment file..."

# Create environment file template
cat > "$ENV_FILE" << 'EOF'
# OpSentra Log Shipper Environment Configuration
# Edit these values with your actual credentials

# CloudAMQP RabbitMQ Connection
CLOUDAMQP_URL=amqps://your-user:your-password@your-host.cloudamqp.com/your-vhost

# AWS S3 Configuration
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key

# Service Configuration
LOG_LEVEL=info
RECONNECT_INTERVAL=5000
MAX_RECONNECT_INTERVAL=30000

# Log Collection Paths (comma-separated)
LOG_PATHS=/var/log/*.log,/var/log/syslog,/var/log/auth.log

# Optional: Custom log paths
CUSTOM_LOG_PATHS=

# Performance Settings
BATCH_SIZE=100
BATCH_TIMEOUT=5000
EOF

# Set proper permissions for environment file
chmod 600 "$ENV_FILE"  # Only root can read/write
chown root:root "$ENV_FILE"

echo "Step 4: Creating systemd service unit..."

# Create systemd service file
cat > "$SERVICE_FILE" << EOF
[Unit]
Description=OpSentra Log Shipper Service - Enhanced Log Collection Agent
Documentation=https://github.com/your-org/opsentra
After=network-online.target
Wants=network-online.target
Requires=network-online.target

[Service]
Type=simple
User=opsentra
Group=opsentra
WorkingDirectory=$WORKING_DIR
ExecStart=/usr/bin/node $WORKING_DIR/index.js
ExecReload=/bin/kill -HUP \$MAINPID

# Environment configuration
EnvironmentFile=$ENV_FILE

# Restart configuration
Restart=always
RestartSec=10
StartLimitInterval=300
StartLimitBurst=3

# Security settings
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=$LOG_DIR /tmp
PrivateTmp=yes
ProtectControlGroups=yes
ProtectKernelModules=yes
ProtectKernelTunables=yes
RestrictRealtime=yes
RestrictNamespaces=yes

# Logging configuration
StandardOutput=journal
StandardError=journal
SyslogIdentifier=opsentra-shipper

# Process limits
LimitNOFILE=65536
LimitNPROC=4096

# Memory and CPU limits (adjust as needed)
MemoryLimit=512M
CPUQuota=50%

[Install]
WantedBy=multi-user.target
EOF

echo "Step 5: Configuring systemd..."

# Reload systemd configuration
systemctl daemon-reload

# Enable service for auto-start on boot
systemctl enable "$SERVICE_NAME"

echo "Step 6: Final setup and verification..."

# Set proper permissions for service file
chmod 644 "$SERVICE_FILE"

# Create log rotation configuration
cat > "/etc/logrotate.d/opsentra-shipper" << EOF
$LOG_DIR/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 opsentra opsentra
    postrotate
        systemctl reload-or-restart $SERVICE_NAME
    endscript
}
EOF

echo "=================================================="
echo "Installation completed successfully!"
echo "=================================================="
echo ""
echo "Next steps:"
echo "1. Edit the environment file with your credentials:"
echo "   sudo nano $ENV_FILE"
echo ""
echo "2. Start the service:"
echo "   sudo systemctl start $SERVICE_NAME"
echo ""
echo "3. Check service status:"
echo "   sudo systemctl status $SERVICE_NAME"
echo ""
echo "4. View service logs:"
echo "   sudo journalctl -u $SERVICE_NAME -f"
echo ""
echo "5. Test log shipping:"
echo "   cd $WORKING_DIR && sudo -u opsentra node index.js --test-log 'Test message'"
echo ""
echo "Service management commands:"
echo "  Start:   sudo systemctl start $SERVICE_NAME"
echo "  Stop:    sudo systemctl stop $SERVICE_NAME"
echo "  Restart: sudo systemctl restart $SERVICE_NAME"
echo "  Status:  sudo systemctl status $SERVICE_NAME"
echo "  Logs:    sudo journalctl -u $SERVICE_NAME"
echo ""
echo "Configuration files:"
echo "  Service file: $SERVICE_FILE"
echo "  Environment:  $ENV_FILE"
echo "  Working dir:  $WORKING_DIR"
echo "  Log dir:      $LOG_DIR"
echo ""
echo "IMPORTANT: Remember to configure your environment variables"
echo "in $ENV_FILE before starting the service!"
echo "=================================================="