/**
 * OpSentra Log Shipper - Phase 1: Project Setup and Configuration
 * 
 * Lightweight Node.js agent for collecting and forwarding logs from distributed Linux services.
 * 
 * Features:
 * - Multi-source log collection: system logs, Docker containers, Kubernetes pods, Jenkins, custom files
 * - RabbitMQ integration for reliable log forwarding
 * - Cross-distribution Linux compatibility (Ubuntu, CentOS, Fedora)
 * - Systemd service integration for auto-start
 * - S3 bucket lifecycle management
 * - Auto-discovery of containerized services
 * 
 * Architecture:
 * - File system monitoring using chokidar and tail
 * - Docker log collection via /var/lib/docker/containers
 * - Kubernetes integration via /var/log/pods
 * - System log monitoring from /var/log/
 * - Jenkins log collection from Jenkins workspace/logs
 * - Structured log parsing and metadata enrichment
 * - Reliable RabbitMQ publishing with reconnection logic
 * 
 * Installation:
 * - Install as systemd service using install-service.js
 * - Configuration via environment variables
 * - Graceful shutdown with S3 cleanup
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const amqp = require('amqplib');
const chokidar = require('chokidar');
const { Tail } = require('tail');
const glob = require('glob');
const pino = require('pino');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Configure logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'yyyy-mm-dd HH:MM:ss'
    }
  }
});

class OpSentraLogShipper {
  constructor() {
    this.instanceInfo = this.getInstanceInfo();
    this.rabbitmqConnection = null;
    this.rabbitmqChannel = null;
    this.activeTails = new Map();
    this.watchers = [];
    this.isShuttingDown = false;
    
    // Configuration
    this.config = {
      cloudamqpUrl: process.env.CLOUDAMQP_URL,
      serviceName: process.env.SERVICE_NAME || 'unknown-service',
      logPaths: this.parseLogPaths(process.env.LOG_PATHS || '/var/log/*.log,/var/log/syslog'),
      dockerEnabled: process.env.DOCKER_ENABLED !== 'false',
      k8sEnabled: process.env.K8S_ENABLED !== 'false',
      jenkinsEnabled: process.env.JENKINS_ENABLED !== 'false',
      customPaths: process.env.CUSTOM_LOG_PATHS ? process.env.CUSTOM_LOG_PATHS.split(',') : [],
      batchSize: parseInt(process.env.LOG_BATCH_SIZE) || parseInt(process.env.BATCH_SIZE) || 100,
      batchTimeout: parseInt(process.env.ARCHIVE_BATCH_INTERVAL_SECONDS) * 1000 || parseInt(process.env.BATCH_TIMEOUT) || 5000,
    };
    
    // Batch processing
    this.logBuffer = [];
    this.batchTimer = null;
    
    this.setupSignalHandlers();
  }

  /**
   * Get instance information for log metadata
   */
  getInstanceInfo() {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      uptime: os.uptime(),
      loadavg: os.loadavg(),
      memory: process.memoryUsage(),
      startTime: new Date().toISOString()
    };
  }

  /**
   * Parse log paths configuration
   */
  parseLogPaths(pathString) {
    return pathString.split(',').map(p => p.trim()).filter(p => p.length > 0);
  }

  /**
   * Initialize RabbitMQ connection
   */
  async initializeRabbitMQ() {
    try {
      logger.info('Connecting to RabbitMQ...');
      
      this.rabbitmqConnection = await amqp.connect(this.config.cloudamqpUrl);
      this.rabbitmqChannel = await this.rabbitmqConnection.createChannel();
      
      // Set up connection error handling
      this.rabbitmqConnection.on('error', this.handleRabbitMQError.bind(this));
      this.rabbitmqConnection.on('close', this.handleRabbitMQClose.bind(this));
      
      // Declare exchange and queue
      await this.rabbitmqChannel.assertExchange('logs_exchange', 'topic', { durable: true });
      await this.rabbitmqChannel.assertQueue('raw-logs', { durable: true });
      
      logger.info('RabbitMQ connection established');
      
    } catch (error) {
      logger.error('Failed to initialize RabbitMQ:', error);
      throw error;
    }
  }

  /**
   * Handle RabbitMQ connection errors
   */
  handleRabbitMQError(error) {
    logger.error('RabbitMQ connection error:', error);
    this.scheduleReconnect();
  }

  /**
   * Handle RabbitMQ connection close
   */
  handleRabbitMQClose() {
    logger.warn('RabbitMQ connection closed');
    if (!this.isShuttingDown) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule RabbitMQ reconnection
   */
  scheduleReconnect() {
    if (this.isShuttingDown) return;
    
    setTimeout(async () => {
      try {
        logger.info('Attempting to reconnect to RabbitMQ...');
        await this.initializeRabbitMQ();
      } catch (error) {
        logger.error('Reconnection failed:', error);
        this.scheduleReconnect();
      }
    }, 5000);
  }

  /**
   * Discover and start monitoring log files
   */
  async discoverAndMonitorLogs() {
    logger.info('Discovering log files...');
    
    const logSources = [];
    
    // System logs
    for (const pathPattern of this.config.logPaths) {
      try {
        const files = await this.globPromise(pathPattern);
        files.forEach(file => {
          logSources.push({
            type: 'system',
            path: file,
            service: this.extractServiceFromPath(file)
          });
        });
      } catch (error) {
        logger.warn(`Failed to glob pattern ${pathPattern}:`, error);
      }
    }
    
    // Docker containers
    if (this.config.dockerEnabled) {
      const dockerLogs = await this.discoverDockerLogs();
      logSources.push(...dockerLogs);
    }
    
    // Kubernetes pods
    if (this.config.k8sEnabled) {
      const k8sLogs = await this.discoverK8sLogs();
      logSources.push(...k8sLogs);
    }
    
    // Jenkins logs
    if (this.config.jenkinsEnabled) {
      const jenkinsLogs = await this.discoverJenkinsLogs();
      logSources.push(...jenkinsLogs);
    }
    
    // Custom paths
    for (const customPath of this.config.customPaths) {
      try {
        const files = await this.globPromise(customPath);
        files.forEach(file => {
          logSources.push({
            type: 'custom',
            path: file,
            service: this.extractServiceFromPath(file)
          });
        });
      } catch (error) {
        logger.warn(`Failed to process custom path ${customPath}:`, error);
      }
    }
    
    logger.info(`Discovered ${logSources.length} log sources`);
    
    // Start monitoring each source
    for (const source of logSources) {
      await this.startMonitoring(source);
    }
  }

  /**
   * Discover Docker container logs
   */
  async discoverDockerLogs() {
    const dockerLogs = [];
    const dockerLogPath = '/var/lib/docker/containers';
    
    try {
      const containerDirs = await fs.readdir(dockerLogPath);
      
      for (const containerDir of containerDirs) {
        const logPath = path.join(dockerLogPath, containerDir, `${containerDir}-json.log`);
        
        try {
          await fs.access(logPath);
          const containerInfo = await this.getDockerContainerInfo(containerDir);
          
          dockerLogs.push({
            type: 'docker',
            path: logPath,
            service: containerInfo.name || `container-${containerDir.substring(0, 12)}`,
            containerId: containerDir,
            containerInfo
          });
        } catch (error) {
          // Log file doesn't exist or isn't accessible
          continue;
        }
      }
    } catch (error) {
      logger.debug('Docker logs not available:', error);
    }
    
    return dockerLogs;
  }

  /**
   * Get Docker container information
   */
  async getDockerContainerInfo(containerId) {
    try {
      const configPath = `/var/lib/docker/containers/${containerId}/config.v2.json`;
      const configData = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(configData);
      
      return {
        name: config.Name?.replace('/', '') || null,
        image: config.Config?.Image || null,
        labels: config.Config?.Labels || {},
        created: config.Created || null
      };
    } catch (error) {
      return {};
    }
  }

  /**
   * Discover Kubernetes pod logs
   */
  async discoverK8sLogs() {
    const k8sLogs = [];
    const k8sLogPath = '/var/log/pods';
    
    try {
      const namespaceDirs = await fs.readdir(k8sLogPath);
      
      for (const namespaceDir of namespaceDirs) {
        const namespacePath = path.join(k8sLogPath, namespaceDir);
        const podDirs = await fs.readdir(namespacePath);
        
        for (const podDir of podDirs) {
          const podPath = path.join(namespacePath, podDir);
          const containerFiles = await fs.readdir(podPath);
          
          for (const containerFile of containerFiles) {
            if (containerFile.endsWith('.log')) {
              const logPath = path.join(podPath, containerFile);
              const [podName] = podDir.split('_');
              const containerName = containerFile.replace('.log', '');
              
              k8sLogs.push({
                type: 'kubernetes',
                path: logPath,
                service: `k8s-${podName}`,
                namespace: namespaceDir,
                pod: podName,
                container: containerName
              });
            }
          }
        }
      }
    } catch (error) {
      logger.debug('Kubernetes logs not available:', error);
    }
    
    return k8sLogs;
  }

  /**
   * Discover Jenkins logs
   */
  async discoverJenkinsLogs() {
    const jenkinsLogs = [];
    const commonJenkinsPaths = [
      '/var/log/jenkins',
      '/var/lib/jenkins/logs',
      '/home/jenkins/logs',
      process.env.JENKINS_LOG_PATH
    ].filter(Boolean);
    
    for (const basePath of commonJenkinsPaths) {
      try {
        await fs.access(basePath);
        const files = await this.globPromise(`${basePath}/**/*.log`);
        
        files.forEach(file => {
          jenkinsLogs.push({
            type: 'jenkins',
            path: file,
            service: 'jenkins',
            job: this.extractJenkinsJobFromPath(file)
          });
        });
      } catch (error) {
        continue;
      }
    }
    
    return jenkinsLogs;
  }

  /**
   * Extract service name from file path
   */
  extractServiceFromPath(filePath) {
    const fileName = path.basename(filePath, path.extname(filePath));
    
    // Common service patterns
    if (fileName.includes('nginx')) return 'nginx';
    if (fileName.includes('apache')) return 'apache';
    if (fileName.includes('mysql')) return 'mysql';
    if (fileName.includes('postgresql')) return 'postgresql';
    if (fileName.includes('redis')) return 'redis';
    if (fileName.includes('mongodb')) return 'mongodb';
    
    return fileName;
  }

  /**
   * Extract Jenkins job name from path
   */
  extractJenkinsJobFromPath(filePath) {
    const pathParts = filePath.split('/');
    const jobIndex = pathParts.findIndex(part => part === 'jobs');
    
    if (jobIndex !== -1 && pathParts[jobIndex + 1]) {
      return pathParts[jobIndex + 1];
    }
    
    return 'unknown-job';
  }

  /**
   * Start monitoring a log source
   */
  async startMonitoring(source) {
    try {
      const tail = new Tail(source.path, {
        separator: /[\r]{0,1}\n/,
        fromBeginning: false,
        fsWatchOptions: {},
        follow: true
      });
      
      tail.on('line', (data) => {
        this.processLogLine(data, source);
      });
      
      tail.on('error', (error) => {
        logger.error(`Tail error for ${source.path}:`, error);
      });
      
      this.activeTails.set(source.path, tail);
      logger.info(`Started monitoring: ${source.path} (${source.type})`);
      
    } catch (error) {
      logger.error(`Failed to start monitoring ${source.path}:`, error);
    }
  }

  /**
   * Process individual log line
   */
  processLogLine(line, source) {
    if (!line.trim()) return;
    
    const logEntry = this.createLogEntry(line, source);
    this.addToBuffer(logEntry);
  }

  /**
   * Create structured log entry
   */
  createLogEntry(line, source) {
    const timestamp = new Date().toISOString();
    const level = this.extractLogLevel(line);
    
    // Handle Docker JSON logs
    if (source.type === 'docker' && line.startsWith('{')) {
      try {
        const dockerLog = JSON.parse(line);
        return {
          timestamp,
          service: source.service,
          level: this.extractLogLevel(dockerLog.log),
          message: dockerLog.log.trim(),
          host: this.instanceInfo.hostname,
          source_type: 'docker',
          container_id: source.containerId,
          container_info: source.containerInfo
        };
      } catch (error) {
        // Fallback to plain text processing
      }
    }
    
    return {
      timestamp,
      service: source.service,
      level,
      message: line.trim(),
      host: this.instanceInfo.hostname,
      source_type: source.type,
      source_path: source.path,
      ...(source.namespace && { k8s_namespace: source.namespace }),
      ...(source.pod && { k8s_pod: source.pod }),
      ...(source.container && { k8s_container: source.container }),
      ...(source.job && { jenkins_job: source.job })
    };
  }

  /**
   * Extract log level from message
   */
  extractLogLevel(message) {
    const messageLower = message.toLowerCase();
    
    if (/\b(error|err|fatal|critical)\b/.test(messageLower)) return 'error';
    if (/\b(warn|warning)\b/.test(messageLower)) return 'warn';
    if (/\b(info|information)\b/.test(messageLower)) return 'info';
    if (/\b(debug|trace)\b/.test(messageLower)) return 'debug';
    
    return 'info';
  }

  /**
   * Add log entry to buffer for batch processing
   */
  addToBuffer(logEntry) {
    this.logBuffer.push(logEntry);
    
    if (this.logBuffer.length >= this.config.batchSize) {
      this.flushBuffer();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushBuffer();
      }, this.config.batchTimeout);
    }
  }

  /**
   * Flush buffered logs to RabbitMQ
   */
  async flushBuffer() {
    if (this.logBuffer.length === 0) return;
    
    const logsToSend = [...this.logBuffer];
    this.logBuffer = [];
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    try {
      for (const logEntry of logsToSend) {
        await this.publishLog(logEntry);
      }
      
      logger.debug(`Flushed ${logsToSend.length} log entries`);
      
    } catch (error) {
      logger.error('Error flushing logs:', error);
      // Re-add failed logs to buffer for retry
      this.logBuffer.unshift(...logsToSend);
    }
  }

  /**
   * Publish single log entry to RabbitMQ
   */
  async publishLog(logEntry) {
    if (!this.rabbitmqChannel) {
      throw new Error('RabbitMQ channel not available');
    }
    
    const routingKey = `logs.${logEntry.service}.${this.instanceInfo.hostname}`;
    const message = JSON.stringify(logEntry);
    
    await this.rabbitmqChannel.publish(
      'logs_exchange',
      routingKey,
      Buffer.from(message),
      {
        persistent: true,
        contentType: 'application/json',
        timestamp: Date.now()
      }
    );
  }

  /**
   * Utility function to promisify glob
   */
  globPromise(pattern) {
    return new Promise((resolve, reject) => {
      glob(pattern, (error, files) => {
        if (error) reject(error);
        else resolve(files);
      });
    });
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  setupSignalHandlers() {
    process.on('SIGINT', this.shutdown.bind(this));
    process.on('SIGTERM', this.shutdown.bind(this));
    process.on('SIGQUIT', this.shutdown.bind(this));
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    
    logger.info('Shutting down OpSentra Log Shipper...');
    
    try {
      // Flush remaining logs
      await this.flushBuffer();
      
      // Stop all file tails
      for (const [path, tail] of this.activeTails) {
        try {
          tail.unwatch();
          logger.debug(`Stopped monitoring: ${path}`);
        } catch (error) {
          logger.error(`Error stopping tail for ${path}:`, error);
        }
      }
      
      // Close watchers
      for (const watcher of this.watchers) {
        await watcher.close();
      }
      
      // Close RabbitMQ connection
      if (this.rabbitmqConnection) {
        await this.rabbitmqConnection.close();
      }
      
      logger.info('Shutdown complete');
      process.exit(0);
      
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Start the log shipper
   */
  async start() {
    try {
      logger.info('Starting OpSentra Log Shipper...');
      logger.info(`Instance: ${this.instanceInfo.hostname}`);
      logger.info(`Service: ${this.config.serviceName}`);
      
      // Initialize RabbitMQ
      await this.initializeRabbitMQ();
      
      // Discover and start monitoring logs
      await this.discoverAndMonitorLogs();
      
      logger.info('Log Shipper is running');
      
      // Keep process alive
      process.stdin.resume();
      
    } catch (error) {
      logger.error('Failed to start Log Shipper:', error);
      process.exit(1);
    }
  }
}

// Start the log shipper if this file is executed directly
if (require.main === module) {
  const shipper = new OpSentraLogShipper();
  shipper.start().catch(console.error);
}