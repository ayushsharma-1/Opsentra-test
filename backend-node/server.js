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

/**
 * Fetch EC2 instance IP for bucket naming
 * Rationale: Consistent with Phase 2 implementation for cross-service compatibility
 * @returns {Promise<string>} Instance IP or hostname fallback
 */
async function fetchInstanceIp() {
  return new Promise((resolve) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    
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
    
    req.on('error', () => {
      clearTimeout(timeout);
      resolve(process.env.HOSTNAME || 'localhost');
    });
  });
}

/**
 * Connect to RabbitMQ with retry logic
 * Best Practice: Prefetch limits prevent consumer overload per 2025 RabbitMQ guidelines
 * @returns {Promise<void>}
 */
async function connectRabbitMQ() {
  try {
    logger.info('Connecting to RabbitMQ...');
    
    rabbitmqConnection = await amqplib.connect(process.env.CLOUDAMQP_URL);
    rabbitmqChannel = await rabbitmqConnection.createChannel();
    
    // Assert durable queues for reliability
    await rabbitmqChannel.assertQueue('raw-logs', { durable: true });
    await rabbitmqChannel.assertQueue('ai-enriched', { durable: true });
    
    // Set prefetch to 10 for balanced throughput per 2025 best practices
    rabbitmqChannel.prefetch(10);
    
    // Setup error handlers
    rabbitmqConnection.on('error', (err) => {
      logger.error({ err }, 'RabbitMQ connection error');
      scheduleRabbitMQReconnect();
    });
    
    rabbitmqConnection.on('close', () => {
      logger.warn('RabbitMQ connection closed');
      scheduleRabbitMQReconnect();
    });
    
    rabbitmqChannel.on('error', (err) => {
      logger.error({ err }, 'RabbitMQ channel error');
    });
    
    // Start consuming messages
    await startConsumers();
    
    rabbitmqRetryCount = 0; // Reset retry count on successful connection
    logger.info('RabbitMQ connected successfully');
    
  } catch (error) {
    logger.error({ err: error }, 'Failed to connect to RabbitMQ');
    scheduleRabbitMQReconnect();
  }
}

/**
 * Schedule RabbitMQ reconnection with exponential backoff
 * Rationale: Exponential backoff prevents thundering herd effect
 */
function scheduleRabbitMQReconnect() {
  if (rabbitmqRetryCount >= MAX_RETRY_COUNT) {
    logger.fatal('Maximum RabbitMQ retry attempts reached');
    process.exit(1);
  }
  
  const delay = BASE_RETRY_DELAY * Math.pow(1.5, rabbitmqRetryCount);
  const maxDelay = Math.min(delay, 30000); // Cap at 30 seconds
  
  rabbitmqRetryCount++;
  
  logger.warn({ 
    retryCount: rabbitmqRetryCount, 
    delay: maxDelay 
  }, 'Scheduling RabbitMQ reconnection');
  
  setTimeout(connectRabbitMQ, maxDelay);
}

/**
 * Start RabbitMQ consumers for different queues
 * Manual ack for reliability - ensures message processing completion
 */
async function startConsumers() {
  // Consumer for raw logs from Phase 2 shipper
  await rabbitmqChannel.consume('raw-logs', async (msg) => {
    try {
      const log = JSON.parse(msg.content.toString());
      await insertToMongo(log);
      
      // Broadcast to SSE clients
      broadcastToSSE('log', log);
      
      // Manual acknowledgment for reliability
      rabbitmqChannel.ack(msg);
      
      logger.debug({ logId: log._id, service: log.service }, 'Raw log processed');
      
    } catch (error) {
      logger.error({ err: error }, 'Error processing raw log');
      rabbitmqChannel.nack(msg, false, true); // Requeue on error
    }
  }, { noAck: false });
  
  // Consumer for AI-enriched logs
  await rabbitmqChannel.consume('ai-enriched', async (msg) => {
    try {
      const enrichedData = JSON.parse(msg.content.toString());
      await updateLogWithAI(enrichedData);
      
      // Broadcast AI suggestions to SSE clients
      broadcastToSSE('ai-suggestion', enrichedData);
      
      rabbitmqChannel.ack(msg);
      
      logger.debug({ logId: enrichedData.logId }, 'AI-enriched data processed');
      
    } catch (error) {
      logger.error({ err: error }, 'Error processing AI-enriched data');
      rabbitmqChannel.nack(msg, false, true);
    }
  }, { noAck: false });
  
  logger.info('RabbitMQ consumers started successfully');
}

/**
 * Connect to MongoDB with connection pooling
 * Time-series optimization for logs with automatic data expiration
 * @returns {Promise<void>}
 */
async function connectMongo() {
  try {
    logger.info('Connecting to MongoDB...');
    
    mongoClient = new MongoClient(process.env.MONGODB_URI, {
      maxPoolSize: 50,  // Optimize with connection pooling
      minPoolSize: 5,   // Maintain minimum connections
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    await mongoClient.connect();
    mongoDb = mongoClient.db('opsentra');
    
    // Create time-series collection for optimized log storage
    try {
      await mongoDb.createCollection('logs', {
        timeseries: {
          timeField: 'timestamp',
          metaField: 'service',
          granularity: 'minutes'
        },
        expireAfterSeconds: 30 * 24 * 60 * 60 // 30 days retention
      });
      logger.info('Time-series logs collection created');
    } catch (err) {
      // Collection might already exist
      logger.debug('Logs collection already exists or creation failed');
    }
    
    logsCollection = mongoDb.collection('logs');
    
    // Create indexes for efficient querying
    await logsCollection.createIndex({ timestamp: -1, service: 1 });
    await logsCollection.createIndex({ level: 1, timestamp: -1 });
    await logsCollection.createIndex({ synced: 1, timestamp: 1 });
    
    logger.info('MongoDB connected successfully with indexes created');
    
  } catch (error) {
    logger.error({ err: error }, 'Failed to connect to MongoDB');
    throw error;
  }
}

/**
 * Insert log entry to MongoDB
 * Rationale: Add synced flag for batch processing tracking
 * @param {Object} log - Log entry to insert
 */
async function insertToMongo(log) {
  try {
    const logEntry = {
      ...log,
      timestamp: new Date(log.timestamp || Date.now()),
      synced: false,
      createdAt: new Date(),
      _id: undefined // Let MongoDB generate ObjectId
    };
    
    await logsCollection.insertOne(logEntry);
    
  } catch (error) {
    logger.error({ err: error, logService: log.service }, 'Failed to insert log to MongoDB');
    throw error;
  }
}

/**
 * Update log with AI enrichment data
 * @param {Object} enrichedData - AI analysis results
 */
async function updateLogWithAI(enrichedData) {
  try {
    await logsCollection.updateOne(
      { _id: enrichedData.logId },
      { 
        $set: { 
          aiAnalysis: enrichedData.analysis,
          suggestions: enrichedData.suggestions,
          confidence: enrichedData.confidence,
          aiProcessedAt: new Date()
        } 
      }
    );
  } catch (error) {
    logger.error({ err: error }, 'Failed to update log with AI data');
    throw error;
  }
}

/**
 * Initialize S3 client
 * @returns {Promise<void>}
 */
async function initializeS3() {
  s3Client = new S3Client({
    region: process.env.AWS_REGION || process.env.AWS_S3_REGION || 'ap-south-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });
  
  logger.info('S3 client initialized');
}

/**
 * Create S3 bucket if it doesn't exist
 * Idempotent check to prevent errors
 * @param {string} bucketName - Name of the bucket to create
 */
async function createBucketIfMissing(bucketName) {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    logger.debug({ bucketName }, 'S3 bucket exists');
  } catch (err) {
    if (err.name === 'NotFound') {
      logger.info({ bucketName }, 'Creating S3 bucket');
      await s3Client.send(new CreateBucketCommand({ 
        Bucket: bucketName,
        CreateBucketConfiguration: {
          LocationConstraint: process.env.AWS_REGION || 'ap-south-1'
        }
      }));
      logger.info({ bucketName }, 'S3 bucket created successfully');
    } else {
      throw err;
    }
  }
}

/**
 * Batch process logs to S3
 * Runs every 10 minutes via cron, compresses and uploads unsynced logs
 */
async function batchProcessToS3() {
  try {
    logger.info('Starting S3 batch processing');
    
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    // Query unsynced logs using aggregation pipeline for efficiency
    const unsynced = await logsCollection.aggregate([
      { 
        $match: { 
          synced: false, 
          timestamp: { $gt: tenMinutesAgo } 
        } 
      },
      { $limit: 10000 }, // Limit batch size
      { 
        $project: {
          timestamp: 1,
          level: 1,
          message: 1,
          service: 1,
          host: 1,
          ip: 1,
          source: 1,
          aiAnalysis: 1,
          suggestions: 1
        }
      }
    ]).toArray();
    
    if (unsynced.length === 0) {
      logger.debug('No unsynced logs to process');
      return;
    }
    
    // Compress JSON for efficiency
    const jsonData = JSON.stringify(unsynced, null, 0);
    const compressedData = zlib.gzipSync(jsonData);
    
    // Generate bucket name with instance IP
    const instanceIp = await fetchInstanceIp();
    const bucketName = `opsentra-logs-${instanceIp}`;
    
    await createBucketIfMissing(bucketName);
    
    // Upload to S3 with timestamp key
    const key = `logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json.gz`;
    
    const uploadParams = {
      Bucket: bucketName,
      Key: key,
      Body: compressedData,
      ContentType: 'application/gzip',
      ContentEncoding: 'gzip',
      Metadata: {
        'log-count': unsynced.length.toString(),
        'compression': 'gzip',
        'version': '3.0'
      }
    };
    
    await s3Client.send(new PutObjectCommand(uploadParams));
    
    // Mark logs as synced
    const logIds = unsynced.map(log => log._id);
    await logsCollection.updateMany(
      { _id: { $in: logIds } },
      { $set: { synced: true, syncedAt: new Date() } }
    );
    
    logger.info({
      bucketName,
      key,
      logCount: unsynced.length,
      compressedSize: compressedData.length,
      originalSize: jsonData.length
    }, 'S3 batch processing completed');
    
  } catch (error) {
    logger.error({ err: error }, 'S3 batch processing failed');
  }
}

/**
 * Broadcast data to SSE clients
 * @param {string} event - Event type
 * @param {Object} data - Data to broadcast
 */
function broadcastToSSE(event, data) {
  for (const [clientId, client] of sseClients) {
    try {
      // Apply service filter if specified
      if (client.serviceFilter && data.service !== client.serviceFilter) {
        continue;
      }
      
      const sseData = `id: ${Date.now()}\nevent: ${event}\ndata: ${JSON.stringify(data)}\nretry: 3000\n\n`;
      client.res.write(sseData);
      
    } catch (error) {
      logger.warn({ clientId, err: error }, 'Failed to send SSE data to client');
      sseClients.delete(clientId);
    }
  }
}

/**
 * Send heartbeat to SSE clients every 30 seconds
 * 2025 standard for real-time apps to prevent timeouts
 */
function sendSSEHeartbeat() {
  for (const [clientId, client] of sseClients) {
    try {
      client.res.write(`: heartbeat\n\n`);
    } catch (error) {
      logger.warn({ clientId }, 'SSE client disconnected during heartbeat');
      sseClients.delete(clientId);
    }
  }
}

// Express middleware setup
app.use(compression()); // Built-in compression support in Express 5.1.0
app.use(cors({
  origin: process.env.FRONTEND_URL || `http://localhost:${PORT}`,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve React build for dashboard access
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Health check endpoint
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '3.0.0',
    services: {
      rabbitmq: rabbitmqConnection ? 'connected' : 'disconnected',
      mongodb: mongoClient ? 'connected' : 'disconnected',
      s3: s3Client ? 'initialized' : 'not-initialized'
    },
    metrics: {
      sseClients: sseClients.size,
      uptime: process.uptime()
    }
  };
  
  res.json(health);
});

// SSE endpoint implementation
app.get('/stream', (req, res) => {
  const clientId = ++sseClientId;
  const serviceFilter = req.query.service; // Filter parameter for distributed views
  
  logger.info({ clientId, serviceFilter }, 'New SSE client connected');
  
  // Set SSE headers per Express best practices
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });
  
  res.flushHeaders();
  
  // Store client connection
  sseClients.set(clientId, {
    res,
    serviceFilter,
    connectedAt: new Date()
  });
  
  // Send initial connection confirmation
  res.write(`id: ${Date.now()}\nevent: connected\ndata: {"clientId": ${clientId}, "message": "Connected to OpSentra log stream"}\nretry: 3000\n\n`);
  
  // Handle client disconnect
  req.on('close', () => {
    logger.info({ clientId }, 'SSE client disconnected');
    sseClients.delete(clientId);
  });
  
  req.on('error', (err) => {
    logger.error({ clientId, err }, 'SSE client error');
    sseClients.delete(clientId);
  });
});

// API endpoint to get recent logs
app.get('/api/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const service = req.query.service;
    const level = req.query.level;
    
    const query = {};
    if (service) query.service = service;
    if (level) query.level = level;
    
    const logs = await logsCollection
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    
    res.json({ logs, count: logs.length });
    
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch logs');
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// API endpoint to get service list
app.get('/api/services', async (req, res) => {
  try {
    const services = await logsCollection.distinct('service');
    res.json({ services });
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch services');
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error({ err, url: req.url, method: req.method }, 'Server error');
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error' 
  });
});

// Global error handlers for unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason, promise }, 'Unhandled promise rejection');
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  try {
    if (rabbitmqChannel) await rabbitmqChannel.close();
    if (rabbitmqConnection) await rabbitmqConnection.close();
    if (mongoClient) await mongoClient.close();
    
    logger.info('All connections closed successfully');
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, 'Error during graceful shutdown');
    process.exit(1);
  }
});

/**
 * Initialize and start the server
 * Rationale: Sequential startup ensures all dependencies are ready before serving requests
 */
async function startServer() {
  try {
    logger.info('Starting OpSentra Backend Node.js - Phase 3 Core Aggregator');
    
    // Initialize all connections
    await connectMongo();
    await initializeS3();
    await connectRabbitMQ();
    
    // Schedule S3 batch processing every 10 minutes
    cron.schedule('*/10 * * * *', batchProcessToS3, {
      name: 'S3 Batch Processing',
      timezone: 'UTC'
    });
    
    // Schedule SSE heartbeat every 30 seconds
    setInterval(sendSSEHeartbeat, 30000);
    
    // Start HTTP server
    app.listen(PORT, () => {
      logger.info({
        port: PORT,
        environment: process.env.NODE_ENV,
        version: '3.0.0'
      }, 'OpSentra Backend Node.js server started successfully');
      
      logger.info(`SSE Stream available at: http://localhost:${PORT}/stream`);
      logger.info(`API endpoints available at: http://localhost:${PORT}/api/*`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });
    
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

// Start the server
startServer();