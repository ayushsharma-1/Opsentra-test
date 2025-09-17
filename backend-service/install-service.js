/**
 * OpSentra Log Shipper Service Installer
 * 
 * This script installs the OpSentra log shipper as a systemd service
 * for automatic startup and management on Linux systems.
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

class ServiceInstaller {
  constructor() {
    this.serviceName = 'opsentra-shipper';
    this.serviceUser = process.env.SERVICE_USER || 'opsentra';
    this.installDir = process.env.INSTALL_DIR || '/opt/opsentra-shipper';
    this.currentDir = __dirname;
  }

  /**
   * Check if running as root
   */
  checkRoot() {
    if (process.getuid && process.getuid() !== 0) {
      console.error('This installer must be run as root (use sudo)');
      process.exit(1);
    }
  }

  /**
   * Check system compatibility
   */
  async checkSystemCompatibility() {
    const platform = os.platform();
    if (platform !== 'linux') {
      throw new Error(`Unsupported platform: ${platform}. This service only runs on Linux.`);
    }

    // Check if systemd is available
    try {
      await this.executeCommand('which systemctl');
      console.log('✓ systemd detected');
    } catch (error) {
      throw new Error('systemd is required but not found. Please install systemd or use manual installation.');
    }

    // Check if Node.js is available
    try {
      const nodeVersion = await this.executeCommand('node --version');
      console.log(`✓ Node.js detected: ${nodeVersion.trim()}`);
      
      // Check Node.js version (require 16+)
      const version = parseInt(nodeVersion.trim().substring(1).split('.')[0]);
      if (version < 16) {
        throw new Error(`Node.js 16+ is required. Current version: ${nodeVersion.trim()}`);
      }
    } catch (error) {
      throw new Error('Node.js 16+ is required but not found. Please install Node.js first.');
    }
  }

  /**
   * Create service user
   */
  async createServiceUser() {
    try {
      // Check if user already exists
      await this.executeCommand(`id ${this.serviceUser}`);
      console.log(`✓ User ${this.serviceUser} already exists`);
    } catch (error) {
      // Create system user
      try {
        await this.executeCommand(`useradd -r -s /bin/false -d ${this.installDir} ${this.serviceUser}`);
        console.log(`✓ Created system user: ${this.serviceUser}`);
      } catch (createError) {
        throw new Error(`Failed to create user ${this.serviceUser}: ${createError.message}`);
      }
    }
  }

  /**
   * Copy service files to installation directory
   */
  async copyServiceFiles() {
    try {
      // Create installation directory
      await this.executeCommand(`mkdir -p ${this.installDir}`);
      
      // Copy files
      const filesToCopy = [
        'shipper.js',
        'package.json',
        'install-service.js',
        'uninstall-service.js'
      ];
      
      for (const file of filesToCopy) {
        const sourcePath = path.join(this.currentDir, file);
        const targetPath = path.join(this.installDir, file);
        
        try {
          await fs.copyFile(sourcePath, targetPath);
          console.log(`✓ Copied ${file}`);
        } catch (error) {
          throw new Error(`Failed to copy ${file}: ${error.message}`);
        }
      }
      
      // Install npm dependencies
      console.log('Installing npm dependencies...');
      await this.executeCommand(`cd ${this.installDir} && npm install --production`);
      console.log('✓ Dependencies installed');
      
      // Set ownership
      await this.executeCommand(`chown -R ${this.serviceUser}:${this.serviceUser} ${this.installDir}`);
      console.log('✓ Set file ownership');
      
    } catch (error) {
      throw new Error(`Failed to copy service files: ${error.message}`);
    }
  }

  /**
   * Create systemd service file
   */
  async createSystemdService() {
    const serviceContent = `[Unit]
Description=OpSentra Log Shipper - Distributed Log Collection Agent
Documentation=https://github.com/your-org/opsentra
After=network.target
Wants=network.target

[Service]
Type=simple
User=${this.serviceUser}
Group=${this.serviceUser}
WorkingDirectory=${this.installDir}
ExecStart=${await this.getNodePath()} ${this.installDir}/shipper.js
ExecReload=/bin/kill -HUP $MAINPID
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=opsentra-shipper

# Environment
Environment=NODE_ENV=production
EnvironmentFile=-/etc/opsentra/shipper.env

# Security
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/log /var/lib/docker/containers /var/log/pods
CapabilityBoundingSet=CAP_DAC_READ_SEARCH CAP_SYS_ADMIN

# Resource limits
MemoryMax=512M
CPUQuota=50%

[Install]
WantedBy=multi-user.target
`;

    const serviceFilePath = `/etc/systemd/system/${this.serviceName}.service`;
    
    try {
      await fs.writeFile(serviceFilePath, serviceContent, 'utf8');
      console.log(`✓ Created systemd service file: ${serviceFilePath}`);
    } catch (error) {
      throw new Error(`Failed to create service file: ${error.message}`);
    }
  }

  /**
   * Create environment configuration directory
   */
  async createConfigDirectory() {
    const configDir = '/etc/opsentra';
    const envFile = path.join(configDir, 'shipper.env');
    
    try {
      await this.executeCommand(`mkdir -p ${configDir}`);
      
      // Create default environment file if it doesn't exist
      try {
        await fs.access(envFile);
        console.log(`✓ Environment file already exists: ${envFile}`);
      } catch (error) {
        const defaultEnv = `# OpSentra Log Shipper Environment Configuration
# Copy from project root .env.example and customize

# REQUIRED: RabbitMQ Connection (CloudAMQP)
CLOUDAMQP_URL=amqps://uyavtoms:P65aiPNgloYM1u7iWOem_zwuHNM85e-M@puffin.rmq2.cloudamqp.com/uyavtoms

# Service Configuration
SERVICE_NAME=system-logs
LOG_LEVEL=info

# Log Paths (comma-separated glob patterns)
LOG_PATHS=/var/log/*.log,/var/log/syslog,/var/log/auth.log

# Service Discovery
DOCKER_ENABLED=true
K8S_ENABLED=true
JENKINS_ENABLED=false

# Custom Log Paths
#CUSTOM_LOG_PATHS=/app/logs/*.log,/opt/myservice/logs/*.log

# Batch Configuration
LOG_BATCH_SIZE=100
ARCHIVE_BATCH_INTERVAL_SECONDS=300
BATCH_TIMEOUT=5000

# Optional: Custom Jenkins log path
#JENKINS_LOG_PATH=/var/lib/jenkins/logs
`;
        
        await fs.writeFile(envFile, defaultEnv, 'utf8');
        await this.executeCommand(`chown root:${this.serviceUser} ${envFile}`);
        await this.executeCommand(`chmod 640 ${envFile}`);
        console.log(`✓ Created default environment file: ${envFile}`);
        console.log(`  Please edit this file with your configuration before starting the service.`);
      }
      
    } catch (error) {
      throw new Error(`Failed to create configuration directory: ${error.message}`);
    }
  }

  /**
   * Get Node.js executable path
   */
  async getNodePath() {
    try {
      const nodePath = await this.executeCommand('which node');
      return nodePath.trim();
    } catch (error) {
      return '/usr/bin/node'; // Default fallback
    }
  }

  /**
   * Enable and start the service
   */
  async enableAndStartService() {
    try {
      // Reload systemd daemon
      await this.executeCommand('systemctl daemon-reload');
      console.log('✓ Reloaded systemd daemon');
      
      // Enable service
      await this.executeCommand(`systemctl enable ${this.serviceName}`);
      console.log('✓ Enabled service for auto-start');
      
      console.log(`
Installation completed successfully!

Next steps:
1. Edit the configuration file: /etc/opsentra/shipper.env
2. Add your CloudAMQP connection URL and customize settings
3. Start the service: sudo systemctl start ${this.serviceName}
4. Check status: sudo systemctl status ${this.serviceName}
5. View logs: sudo journalctl -u ${this.serviceName} -f

Service management commands:
- Start: sudo systemctl start ${this.serviceName}
- Stop: sudo systemctl stop ${this.serviceName}
- Restart: sudo systemctl restart ${this.serviceName}
- Status: sudo systemctl status ${this.serviceName}
- Logs: sudo journalctl -u ${this.serviceName} -f
`);
      
    } catch (error) {
      throw new Error(`Failed to enable service: ${error.message}`);
    }
  }

  /**
   * Execute shell command
   */
  executeCommand(command) {
    return new Promise((resolve, reject) => {
      const child = spawn('bash', ['-c', command]);
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed (${code}): ${stderr || stdout}`));
        }
      });
    });
  }

  /**
   * Run the installation process
   */
  async install() {
    console.log('OpSentra Log Shipper Service Installer');
    console.log('====================================');
    
    try {
      this.checkRoot();
      console.log('✓ Running as root');
      
      await this.checkSystemCompatibility();
      await this.createServiceUser();
      await this.copyServiceFiles();
      await this.createSystemdService();
      await this.createConfigDirectory();
      await this.enableAndStartService();
      
      console.log('\n✅ Installation completed successfully!');
      
    } catch (error) {
      console.error(`\n❌ Installation failed: ${error.message}`);
      process.exit(1);
    }
  }
}

// Run installer if this file is executed directly
if (require.main === module) {
  const installer = new ServiceInstaller();
  installer.install().catch(console.error);
}

module.exports = ServiceInstaller;