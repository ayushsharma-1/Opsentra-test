// Phase 3: Backend-Node - Core Aggregator - Generated September 2025
// OpSentra Centralized Logging Platform - Enhanced Node.js Backend

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import amqplib from 'amqplib';
import { MongoClient } from 'mongodb';
import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import cron from 'node-cron';
import pino from 'pino';
import zlib from 'zlib';
import http from 'http';

// ESM dirname setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize structured logging with Pino
// Pretty transport for dev readability, switch to file in production
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'hostname'
    }
  } : undefined,
  base: {
    service: 'opsentra-backend-node',
    version: '3.0.0'
  }
});

// Initialize Express app
const app = express();
const PORT = process.env.PORT || process.env.NODE_BACKEND_PORT || 5050;

// Global connection objects
let rabbitmqConnection = null;
let rabbitmqChannel = null;
let mongoClient = null;
let mongoDb = null;
let logsCollection = null;
let s3Client = null;

// SSE connection management
const sseClients = new Map();
let sseClientId = 0;

// Reconnection configuration
let rabbitmqRetryCount = 0;
const MAX_RETRY_COUNT = 10;
const BASE_RETRY_DELAY = 5000; // 5 seconds
    this.logsCollection = null;
    this.rabbitmqConnection = null;
    this.rabbitmqChannel = null;
    this.s3Client = null;
    this.instanceIp = null;
    this.bucketName = null;
    this.sseClients = new Set();
    
    // In-memory buffer for recent logs (for SSE streaming)
    this.recentLogs = [];
    this.maxRecentLogs = 1000;
    
    this.setupExpress();
    this.setupSignalHandlers();
  }

  /**
   * Initialize Express server with middleware and routes
   */
  setupExpress() {
    this.app.use(compression());
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));
    
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        services: {
          mongodb: !!this.db,
          rabbitmq: !!this.rabbitmqChannel,
          s3: !!this.s3Client
        }
      });
    });
    
    // Server-Sent Events endpoint for real-time log streaming
    this.app.get('/stream', this.handleSSE.bind(this));
    
    // API endpoints
    this.app.get('/api/logs', this.getLogs.bind(this));
    this.app.get('/api/services', this.getServices.bind(this));
    
    // Serve React app for all other routes
    this.app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
    });
  }

  /**
   * Handle Server-Sent Events connections for real-time streaming
   */
  handleSSE(req, res) {
    logger.info('New SSE connection established');
    
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });
    
    // Add client to set
    this.sseClients.add(res);
    
    // Send recent logs to new client
    this.recentLogs.forEach(log => {
      res.write(`data: ${JSON.stringify(log)}\n\n`);
    });
    
    // Handle client disconnect
    req.on('close', () => {
      this.sseClients.delete(res);
      logger.info('SSE client disconnected');
    });
    
    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 30000);
    
    req.on('close', () => {
      clearInterval(keepAlive);
    });
  }

  /**
   * Broadcast log data to all connected SSE clients
   */
  broadcastToClients(data) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    
    for (const client of this.sseClients) {
      try {
        client.write(message);
      } catch (error) {
        logger.error('Error writing to SSE client:', error);
        this.sseClients.delete(client);
      }
    }
  }

  /**
   * Get instance IP for S3 bucket naming
   */
  async getInstanceIp() {
    try {
      // Try to get EC2 instance IP first
      const response = await fetch('http://169.254.169.254/latest/meta-data/public-ipv4', {
        timeout: 2000
      });
      
      if (response.ok) {
        this.instanceIp = await response.text();
        logger.info(`Detected EC2 instance IP: ${this.instanceIp}`);
      } else {
        throw new Error('Not running on EC2');
      }
    } catch (error) {
      // Fallback to environment variable or default
      this.instanceIp = process.env.INSTANCE_IP || 'default-instance';
      logger.info(`Using fallback IP: ${this.instanceIp}`);
    }
    
    this.bucketName = process.env.S3_BUCKET_NAME || `${process.env.S3_BUCKET_PREFIX || 'opsentra-'}logs-${this.instanceIp.replace(/\./g, '-')}`;
  }

  /**
   * Initialize MongoDB connection
   */
  async initializeMongoDB() {
    try {
      const mongoUri = process.env.MONGODB_URL || process.env.MONGODB_URI || process.env.MONGO_URI;
      this.mongoClient = new MongoClient(mongoUri);
      await this.mongoClient.connect();
      this.db = this.mongoClient.db('opsentra');
      this.logsCollection = this.db.collection('logs');
      
      // Create indexes for efficient queries
      await this.logsCollection.createIndex({ timestamp: -1 });
      await this.logsCollection.createIndex({ service: 1, timestamp: -1 });
      await this.logsCollection.createIndex({ level: 1, timestamp: -1 });
      await this.logsCollection.createIndex({ synced_to_s3: 1 });
      
      logger.info('MongoDB connection established');
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  /**
   * Initialize S3 client and create bucket if needed
   */
  async initializeS3() {
    try {
      this.s3Client = new S3Client({
        region: process.env.AWS_REGION || process.env.AWS_S3_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });
      
      // Create bucket if it doesn't exist
      try {
        await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucketName }));
        logger.info(`Created S3 bucket: ${this.bucketName}`);
      } catch (error) {
        if (error.name === 'BucketAlreadyOwnedByYou' || error.name === 'BucketAlreadyExists') {
          logger.info(`S3 bucket already exists: ${this.bucketName}`);
        } else {
          throw error;
        }
      }
      
      logger.info('S3 client initialized');
    } catch (error) {
      logger.error('Failed to initialize S3:', error);
      throw error;
    }
  }

  /**
   * Initialize RabbitMQ connection and consumers
   */
  async initializeRabbitMQ() {
    try {
      this.rabbitmqConnection = await amqp.connect(process.env.CLOUDAMQP_URL);
      this.rabbitmqChannel = await this.rabbitmqConnection.createChannel();
      
      // Assert exchanges and queues
      await this.rabbitmqChannel.assertExchange('logs_exchange', 'topic', { durable: true });
      await this.rabbitmqChannel.assertQueue('raw-logs', { durable: true });
      await this.rabbitmqChannel.assertQueue('ai-enriched', { durable: true });
      
      // Bind queues to exchange
      await this.rabbitmqChannel.bindQueue('raw-logs', 'logs_exchange', 'logs.*');
      await this.rabbitmqChannel.bindQueue('ai-enriched', 'logs_exchange', 'ai.*');
      
      // Set up consumers
      await this.setupLogConsumer();
      await this.setupAIConsumer();
      
      logger.info('RabbitMQ connection established');
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  /**
   * Set up consumer for raw logs from log shippers
   */
  async setupLogConsumer() {
    await this.rabbitmqChannel.consume('raw-logs', async (msg) => {
      if (msg) {
        try {
          const logData = JSON.parse(msg.content.toString());
          await this.processRawLog(logData);
          this.rabbitmqChannel.ack(msg);
        } catch (error) {
          logger.error('Error processing raw log:', error);
          this.rabbitmqChannel.nack(msg, false, false);
        }
      }
    });
    
    logger.info('Raw log consumer started');
  }

  /**
   * Set up consumer for AI-enriched logs
   */
  async setupAIConsumer() {
    await this.rabbitmqChannel.consume('ai-enriched', async (msg) => {
      if (msg) {
        try {
          const enrichedData = JSON.parse(msg.content.toString());
          await this.processAIEnrichedLog(enrichedData);
          this.rabbitmqChannel.ack(msg);
        } catch (error) {
          logger.error('Error processing AI-enriched log:', error);
          this.rabbitmqChannel.nack(msg, false, false);
        }
      }
    });
    
    logger.info('AI-enriched log consumer started');
  }

  /**
   * Process raw log from log shipper
   */
  async processRawLog(logData) {
    const processedLog = {
      ...logData,
      timestamp: new Date(logData.timestamp || Date.now()),
      processed_at: new Date(),
      synced_to_s3: false
    };
    
    // Store in MongoDB
    await this.logsCollection.insertOne(processedLog);
    
    // Add to recent logs buffer
    this.recentLogs.push(processedLog);
    if (this.recentLogs.length > this.maxRecentLogs) {
      this.recentLogs.shift();
    }
    
    // Broadcast to SSE clients
    this.broadcastToClients({
      type: 'log',
      data: processedLog
    });
    
    logger.debug('Processed raw log', { service: logData.service, level: logData.level });
  }

  /**
   * Process AI-enriched log with suggestions
   */
  async processAIEnrichedLog(enrichedData) {
    // Update existing log with AI suggestions
    const result = await this.logsCollection.updateOne(
      { _id: enrichedData.log_id },
      { 
        $set: { 
          ai_suggestion: enrichedData.suggestion,
          ai_commands: enrichedData.commands,
          ai_processed_at: new Date()
        } 
      }
    );
    
    if (result.modifiedCount > 0) {
      // Broadcast AI suggestion to SSE clients
      this.broadcastToClients({
        type: 'ai_suggestion',
        data: enrichedData
      });
      
      logger.debug('Processed AI-enriched log', { log_id: enrichedData.log_id });
    }
  }

  /**
   * Batch process logs to S3
   */
  async batchLogsToS3() {
    try {
      const batchSize = parseInt(process.env.LOG_BATCH_SIZE) || parseInt(process.env.BATCH_SIZE) || 10000;
      
      // Get unsynced logs
      const unsyncedLogs = await this.logsCollection
        .find({ synced_to_s3: false })
        .limit(batchSize)
        .toArray();
      
      if (unsyncedLogs.length === 0) {
        logger.debug('No logs to sync to S3');
        return;
      }
      
      // Create S3 object key with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const objectKey = `logs-${timestamp}.json`;
      
      // Upload to S3
      const uploadParams = {
        Bucket: this.bucketName,
        Key: objectKey,
        Body: JSON.stringify(unsyncedLogs, null, 2),
        ContentType: 'application/json'
      };
      
      await this.s3Client.send(new PutObjectCommand(uploadParams));
      
      // Mark logs as synced
      const logIds = unsyncedLogs.map(log => log._id);
      await this.logsCollection.updateMany(
        { _id: { $in: logIds } },
        { $set: { synced_to_s3: true, s3_sync_at: new Date() } }
      );
      
      logger.info(`Batched ${unsyncedLogs.length} logs to S3: ${objectKey}`);
    } catch (error) {
      logger.error('Error batching logs to S3:', error);
    }
  }

  /**
   * API endpoint to get logs with filtering
   */
  async getLogs(req, res) {
    try {
      const { service, level, limit = 100, skip = 0 } = req.query;
      
      const filter = {};
      if (service) filter.service = service;
      if (level) filter.level = level;
      
      const logs = await this.logsCollection
        .find(filter)
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .toArray();
      
      res.json({ logs, count: logs.length });
    } catch (error) {
      logger.error('Error fetching logs:', error);
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  }

  /**
   * API endpoint to get unique services
   */
  async getServices(req, res) {
    try {
      const services = await this.logsCollection.distinct('service');
      res.json({ services });
    } catch (error) {
      logger.error('Error fetching services:', error);
      res.status(500).json({ error: 'Failed to fetch services' });
    }
  }

  /**
   * Setup cron job for batch processing
   */
  setupBatchProcessing() {
    const intervalMinutes = parseInt(process.env.ARCHIVE_INTERVAL_MINUTES) || parseInt(process.env.BATCH_INTERVAL_MINUTES) || 10;
    const cronExpression = `*/${intervalMinutes} * * * *`;
    
    cron.schedule(cronExpression, () => {
      this.batchLogsToS3();
    });
    
    logger.info(`Batch processing scheduled every ${intervalMinutes} minutes`);
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  setupSignalHandlers() {
    process.on('SIGINT', this.shutdown.bind(this));
    process.on('SIGTERM', this.shutdown.bind(this));
  }

  /**
   * Graceful shutdown with S3 bucket cleanup
   */
  async shutdown() {
    logger.info('Shutting down OpSentra Backend...');
    
    try {
      // Final batch to S3
      await this.batchLogsToS3();
      
      // Close connections
      if (this.rabbitmqConnection) {
        await this.rabbitmqConnection.close();
      }
      
      if (this.mongoClient) {
        await this.mongoClient.close();
      }
      
      // Optional: Delete S3 bucket on shutdown (as specified in requirements)
      if (this.s3Client && this.bucketName) {
        try {
          await this.s3Client.send(new DeleteBucketCommand({ Bucket: this.bucketName }));
          logger.info(`Deleted S3 bucket: ${this.bucketName}`);
        } catch (error) {
          logger.error('Error deleting S3 bucket:', error);
        }
      }
      
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Start the server and initialize all services
   */
  async start() {
    try {
      logger.info('Starting OpSentra Backend Node.js Server...');
      
      // Initialize services in sequence
      await this.getInstanceIp();
      await this.initializeMongoDB();
      await this.initializeS3();
      await this.initializeRabbitMQ();
      this.setupBatchProcessing();
      
      // Start Express server
      this.app.listen(this.port, () => {
        logger.info(`OpSentra Backend server running on port ${this.port}`);
        logger.info(`Dashboard available at: http://localhost:${this.port}`);
        logger.info(`SSE stream available at: http://localhost:${this.port}/stream`);
        logger.info(`Health check available at: http://localhost:${this.port}/health`);
      });
      
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

// Start the server
const backend = new OpSentraBackend();
backend.start().catch(console.error);