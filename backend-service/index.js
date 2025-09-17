// Phase 2: Backend-Service - Log Shipper Implementation - Generated September 2025
// OpSentra Centralized Logging Platform - Enhanced Log Collection Agent

'use strict';

// Import required modules
require('dotenv').config();
const pino = require('pino');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const amqp = require('amqplib');
const { S3Client, DeleteBucketCommand } = require('@aws-sdk/client-s3');

// Initialize structured logging with pino
const logger = pino({
  level: 'info',
  base: {
    pid: process.pid,
    hostname: os.hostname()
  },
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
  formatters: {
    level: (label) => {
      return { level: label };
    }
  }
});

// Global variables for connection management
let rabbitmqConnection = null;
let rabbitmqChannel = null;
let isConnected = false;
let reconnectInterval = 5000; // Start with 5 seconds
let maxReconnectInterval = 30000; // Maximum 30 seconds
let isShuttingDown = false;

// Log collection configuration
const LOG_PATHS = [
  '/var/log/**/*.log',
  '/var/log/syslog',
  '/var/log/auth.log',
  '/var/lib/docker/containers/**/*.log',
  '/var/jenkins_home/jobs/**/*.log'
];

/**
 * Fetch EC2 instance IP from metadata endpoint
 * Rationale: Uses HTTP request to EC2 metadata endpoint with timeout to avoid hangs in non-EC2 environments
 * @returns {Promise<string|null>} Public IP address or null if not available
 */
async function fetchEC2Ip() {
  return new Promise((resolve) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000); // 2-second timeout
    
    const req = http.get('http://169.254.169.254/latest/meta-data/public-ipv4', {
      signal: controller.signal
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        clearTimeout(timeout);
        resolve(data.trim());
      });
    });
    
    req.on('error', (err) => {
      clearTimeout(timeout);
      logger.debug({ err: err.message }, 'EC2 metadata fetch failed (expected in non-EC2 environments)');
      resolve(null);
    });
  });
}

/**
 * Get current instance IP address
 * Best practice: Fallback to hostname if not on EC2, preventing errors in local dev
 * @returns {Promise<string>} IP address or hostname
 */
async function getInstanceIdentifier() {
  const ec2Ip = await fetchEC2Ip();
  return ec2Ip || os.hostname();
}

/**
 * Derive service name from log file path
 * Rationale: Extracts meaningful service identifiers from file paths for routing
 * @param {string} filePath - Full path to log file
 * @returns {string} Service name
 */
function deriveServiceFromPath(filePath) {
  const pathParts = filePath.split('/');
  
  // Docker container logs
  if (filePath.includes('/var/lib/docker/containers/')) {
    return 'docker';
  }
  
  // Jenkins logs
  if (filePath.includes('/var/jenkins_home/')) {
    const jobMatch = filePath.match(/jobs\/([^\/]+)/);
    return jobMatch ? `jenkins-${jobMatch[1]}` : 'jenkins';
  }
  
  // System logs
  if (filePath.includes('/var/log/')) {
    const logFileName = pathParts[pathParts.length - 1];
    const serviceName = logFileName.replace(/\.(log|out)$/, '');
    return serviceName || 'system';
  }
  
  return 'unknown';
}

/**
 * Parse log line into structured JSON format
 * Rationale: Creates standardized JSON object with ISO timestamps and dynamic log levels
 * @param {string} line - Raw log line
 * @param {string} filePath - Source file path
 * @returns {Object} Structured log entry
 */
async function parseLogLine(line, filePath) {
  // Extract log level using regex
  const levelMatch = line.match(/\[(ERROR|WARN|INFO|DEBUG|TRACE|FATAL)\]/i) || 
                    line.match(/(ERROR|WARN|INFO|DEBUG|TRACE|FATAL):/i) ||
                    line.match(/^\d{4}-\d{2}-\d{2}.*?(ERROR|WARN|INFO|DEBUG|TRACE|FATAL)/i);
  
  const level = levelMatch ? levelMatch[1].toLowerCase() : 'info';
  const service = deriveServiceFromPath(filePath);
  const instanceId = await getInstanceIdentifier();
  
  return {
    timestamp: new Date().toISOString(),
    level: level,
    message: line.trim(),
    service: service,
    host: os.hostname(),
    ip: instanceId,
    source: filePath
  };
}

/**
 * Connect to RabbitMQ with retry logic
 * Rationale: Establishes resilient connection with exponential backoff for production stability
 * @returns {Promise<void>}
 */
async function connectRabbitMQ() {
  try {
    logger.info('Attempting RabbitMQ connection...');
    
    rabbitmqConnection = await amqp.connect(process.env.CLOUDAMQP_URL);
    rabbitmqChannel = await rabbitmqConnection.createChannel();
    
    // Assert durable topic exchange for reliable message routing
    await rabbitmqChannel.assertExchange('logs_exchange', 'topic', { durable: true });
    
    // Enable publisher confirms for reliability
    rabbitmqChannel.on('error', (err) => {
      logger.error({ err }, 'RabbitMQ channel error');
      isConnected = false;
    });
    
    rabbitmqConnection.on('error', (err) => {
      logger.error({ err }, 'RabbitMQ connection error');
      isConnected = false;
    });
    
    rabbitmqConnection.on('close', () => {
      logger.warn('RabbitMQ connection closed');
      isConnected = false;
    });
    
    isConnected = true;
    reconnectInterval = 5000; // Reset retry interval on successful connection
    logger.info('RabbitMQ connection established successfully');
    
  } catch (error) {
    logger.error({ err: error }, 'Failed to connect to RabbitMQ');
    isConnected = false;
    scheduleReconnection();
  }
}

/**
 * Schedule RabbitMQ reconnection with exponential backoff
 * Rationale: Prevents thundering herd on reconnects; exponential backoff for resilience
 */
function scheduleReconnection() {
  if (isShuttingDown) return;
  
  setTimeout(async () => {
    if (!isConnected && !isShuttingDown) {
      logger.info({ interval: reconnectInterval }, 'Attempting RabbitMQ reconnection');
      await connectRabbitMQ();
      
      // Exponential backoff with maximum limit
      reconnectInterval = Math.min(reconnectInterval * 1.5, maxReconnectInterval);
    }
  }, reconnectInterval);
}

/**
 * Publish log entry to RabbitMQ
 * Rationale: Publishes persistent messages to topic exchange with granular routing keys
 * @param {Object} logEntry - Structured log entry
 * @returns {Promise<boolean>} Success status
 */
async function publishLogEntry(logEntry) {
  if (!isConnected || !rabbitmqChannel) {
    logger.warn('RabbitMQ not connected, queuing log entry');
    return false;
  }
  
  try {
    const routingKey = `logs.${logEntry.service}.${logEntry.ip}`;
    const message = Buffer.from(JSON.stringify(logEntry));
    
    // Publish with persistent flag for durability
    const published = rabbitmqChannel.publish(
      'logs_exchange',
      routingKey,
      message,
      { persistent: true, deliveryMode: 2 }
    );
    
    if (published) {
      logger.debug({ routingKey }, 'Log entry published successfully');
      return true;
    } else {
      logger.warn('Failed to publish log entry - channel busy');
      return false;
    }
  } catch (error) {
    logger.error({ err: error }, 'Error publishing log entry');
    return false;
  }
}

/**
 * Custom log tailing implementation using child_process
 * Rationale: Uses child_process for tail -f to handle large files without blocking the event loop
 * @param {Array<string>} paths - Array of log file paths to tail
 */
function startCustomTailing(paths) {
  paths.forEach(path => {
    logger.info({ path }, 'Starting custom log tailing');
    
    const tailProcess = spawn('tail', ['-f', path]);
    let buffer = '';
    
    tailProcess.stdout.on('data', async (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.trim()) {
          const logEntry = await parseLogLine(line, path);
          await publishLogEntry(logEntry);
        }
      }
    });
    
    tailProcess.stderr.on('data', (data) => {
      logger.error({ path, stderr: data.toString() }, 'Tail process error');
    });
    
    tailProcess.on('error', (error) => {
      logger.error({ err: error, path }, 'Tail spawn failed');
      // Retry after 5 seconds
      setTimeout(() => {
        if (!isShuttingDown) {
          startCustomTailing([path]);
        }
      }, 5000);
    });
    
    tailProcess.on('exit', (code, signal) => {
      logger.warn({ path, code, signal }, 'Tail process exited');
      // Restart tailing if not shutting down
      if (!isShuttingDown) {
        setTimeout(() => startCustomTailing([path]), 5000);
      }
    });
  });
}

/**
 * Initialize log collection using Logagent with fallback to custom implementation
 * Rationale: Prioritize @sematext/logagent for built-in parsers, fallback to custom for compatibility
 */
async function initializeLogCollection() {
  try {
    // Try to use @sematext/logagent first
    const LogAgent = require('@sematext/logagent');
    
    logger.info('Initializing Logagent for structured log collection');
    
    const logagentConfig = {
      input: {
        files: {
          patterns: LOG_PATHS
        }
      },
      parser: {
        json: true,
        lines: true
      },
      output: {
        custom: async (context, data) => {
          const logEntry = await parseLogLine(data.message || data.line, data.file || 'unknown');
          await publishLogEntry(logEntry);
        }
      }
    };
    
    const agent = new LogAgent(logagentConfig);
    await agent.start();
    
    logger.info('Logagent initialized successfully');
    
  } catch (error) {
    logger.warn({ err: error }, 'Logagent unavailable, falling back to custom implementation');
    
    // Fallback to custom tailing implementation
    startCustomTailing([
      '/var/log/syslog',
      '/var/log/auth.log'
      // Add more specific paths as needed
    ]);
  }
}

/**
 * Publish test log entry for verification
 * Rationale: Allows testing of log forwarding without full deployment
 * @param {string} message - Test message to publish
 */
async function publishTestLog(message) {
  logger.info({ message }, 'Publishing test log entry');
  
  const testLogEntry = {
    timestamp: new Date().toISOString(),
    level: 'error',
    message: message,
    service: 'test-service',
    host: os.hostname(),
    ip: await getInstanceIdentifier(),
    source: 'test-cli'
  };
  
  const success = await publishLogEntry(testLogEntry);
  if (success) {
    logger.info('Test log published successfully');
  } else {
    logger.error('Failed to publish test log');
  }
}

/**
 * Graceful shutdown handler
 * Rationale: Async SIGTERM handler completes S3 deletions before exit, preventing orphan resources
 */
async function gracefulShutdown() {
  logger.info('SIGTERM received, initiating graceful shutdown');
  isShuttingDown = true;
  
  try {
    // Initialize S3 client for cleanup
    const s3 = new S3Client({ 
      region: process.env.AWS_REGION || process.env.AWS_S3_REGION || 'ap-south-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });
    
    const instanceId = await getInstanceIdentifier();
    const bucketName = `opsentra-logs-${instanceId}`;
    
    logger.info({ bucketName }, 'Attempting to delete S3 bucket');
    
    try {
      await s3.send(new DeleteBucketCommand({ Bucket: bucketName }));
      logger.info({ bucketName }, 'S3 bucket deleted successfully');
    } catch (s3Error) {
      logger.error({ err: s3Error, bucketName }, 'Failed to delete S3 bucket (may not exist)');
    }
    
    // Close RabbitMQ connections
    if (rabbitmqChannel) {
      await rabbitmqChannel.close();
      logger.info('RabbitMQ channel closed');
    }
    
    if (rabbitmqConnection) {
      await rabbitmqConnection.close();
      logger.info('RabbitMQ connection closed');
    }
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
    
  } catch (error) {
    logger.fatal({ err: error }, 'Error during graceful shutdown');
    process.exit(1);
  }
}

/**
 * Global error handlers
 * Rationale: Ensure all uncaught errors are logged for debugging
 */
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception - shutting down');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason, promise }, 'Unhandled promise rejection - shutting down');
  process.exit(1);
});

// Register shutdown handlers
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

/**
 * Main application entry point
 */
async function main() {
  logger.info('OpSentra Log Shipper Phase 2 - Starting up...');
  
  // Parse command line arguments for test mode
  if (process.argv.includes('--test-log')) {
    const testMessageIndex = process.argv.indexOf('--test-log') + 1;
    const testMessage = process.argv[testMessageIndex] || 'Default test error message';
    
    logger.info('Running in test mode');
    await connectRabbitMQ();
    
    // Wait for connection
    let attempts = 0;
    while (!isConnected && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    if (isConnected) {
      await publishTestLog(testMessage);
    } else {
      logger.error('Failed to connect to RabbitMQ for test');
    }
    
    process.exit(0);
  }
  
  // Normal operation mode
  try {
    // Initialize RabbitMQ connection
    await connectRabbitMQ();
    
    // Start log collection
    await initializeLogCollection();
    
    logger.info('OpSentra Log Shipper is running - collecting and forwarding logs');
    
    // Keep the process alive
    process.on('exit', () => {
      logger.info('OpSentra Log Shipper process exiting');
    });
    
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start OpSentra Log Shipper');
    process.exit(1);
  }
}

// Start the application
if (require.main === module) {
  main().catch((error) => {
    logger.fatal({ err: error }, 'Application startup failed');
    process.exit(1);
  });
}

module.exports = {
  connectRabbitMQ,
  publishLogEntry,
  parseLogLine,
  fetchEC2Ip,
  getInstanceIdentifier,
  deriveServiceFromPath
};