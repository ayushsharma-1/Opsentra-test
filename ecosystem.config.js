/**
 * OpSentra PM2 Ecosystem Configuration
 * 
 * Phase 1: Project Setup and Configuration
 * 
 * This file defines the PM2 ecosystem for managing all OpSentra services:
 * - backend-node: Main Node.js server (port 5050)
 * - backend-fastapi: AI processing layer (port 8000)
 * - frontend: Served by backend-node after build
 * 
 * Usage:
 * - Development: pm2 start ecosystem.config.js --env development
 * - Production: pm2 start ecosystem.config.js --env production
 * - Monitor: pm2 monit
 * - Logs: pm2 logs
 * - Stop: pm2 stop ecosystem.config.js
 * - Restart: pm2 restart ecosystem.config.js
 */

module.exports = {
  apps: [
    {
      // Main Node.js Backend Server
      name: 'opsentra-backend-node',
      script: './backend-node/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      
      // Auto-restart configuration
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Logging
      log_file: './logs/backend-node.log',
      error_file: './logs/backend-node-error.log',
      out_file: './logs/backend-node-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Environment variables
      env: {
        NODE_ENV: 'development',
        PORT: 5050,
        FRONTEND_PORT: 5050,
        NODE_BACKEND_PORT: 5051,
        LOG_LEVEL: 'debug',
        LOG_BATCH_SIZE: 100,
        ARCHIVE_INTERVAL_MINUTES: 60,
        HEALTH_CHECK_INTERVAL_SECONDS: 30
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5050,
        FRONTEND_PORT: 5050,
        NODE_BACKEND_PORT: 5051,
        LOG_LEVEL: 'info',
        LOG_BATCH_SIZE: 100,
        ARCHIVE_INTERVAL_MINUTES: 60,
        HEALTH_CHECK_INTERVAL_SECONDS: 30
      }
    },
    
    {
      // FastAPI AI Layer
      name: 'opsentra-backend-fastapi',
      script: 'uvicorn',
      args: [
        'main:app',
        '--host', '0.0.0.0', 
        '--port', '8000'
      ],
      cwd: './backend-fastapi',
      interpreter: 'python3',
      instances: 1,
      exec_mode: 'fork',
      
      // Auto-restart configuration
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Logging
      log_file: './logs/backend-fastapi.log',
      error_file: './logs/backend-fastapi-error.log',
      out_file: './logs/backend-fastapi-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Environment variables
      env: {
        PYTHONPATH: './backend-fastapi',
        UVICORN_HOST: '0.0.0.0',
        UVICORN_PORT: 8000,
        AI_BACKEND_PORT: 5052,
        LOG_LEVEL: 'debug',
        ERROR_BATCH_SIZE: 50,
        HEALTH_CHECK_INTERVAL_SECONDS: 30,
        GROQ_MODEL: 'llama-3.1-8b-instant',
        GOOGLE_MODEL: 'gemini-1.5-flash'
      },
      env_production: {
        PYTHONPATH: './backend-fastapi',
        UVICORN_HOST: '0.0.0.0',
        UVICORN_PORT: 8000,
        AI_BACKEND_PORT: 5052,
        LOG_LEVEL: 'info',
        ERROR_BATCH_SIZE: 50,
        HEALTH_CHECK_INTERVAL_SECONDS: 30,
        GROQ_MODEL: 'llama-3.1-8b-instant',
        GOOGLE_MODEL: 'gemini-1.5-flash'
      }
    },
    
    {
      // Phase 2: Enhanced Log Shipper Service
      name: 'opsentra-log-shipper',
      script: './backend-service/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      
      // Auto-restart configuration
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      restart_delay: 4000,
      
      // Logging configuration
      log_file: './logs/shipper-combined.log',
      out_file: './logs/shipper-out.log',
      error_file: './logs/shipper-error.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Environment variables - Development
      env: {
        NODE_ENV: 'development',
        LOG_LEVEL: 'debug',
        BATCH_SIZE: 50,
        BATCH_TIMEOUT: 3000,
        RECONNECT_INTERVAL: 5000,
        MAX_RECONNECT_INTERVAL: 30000,
        ENABLE_METRICS: 'true',
        HEALTH_CHECK_INTERVAL: 30000
      },
      
      // Environment variables - Production
      env_production: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
        BATCH_SIZE: 100,
        BATCH_TIMEOUT: 5000,
        RECONNECT_INTERVAL: 5000,
        MAX_RECONNECT_INTERVAL: 30000,
        ENABLE_METRICS: 'true',
        HEALTH_CHECK_INTERVAL: 30000
      }
    }
  ],
  
  // Deployment configuration
  deploy: {
    production: {
      user: 'opsentra',
      host: ['your-production-server.com'],
      ref: 'origin/main',
      repo: 'git@github.com:your-org/opsentra.git',
      path: '/opt/opsentra',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'apt update && apt install git nodejs npm python3 python3-pip -y'
    },
    
    staging: {
      user: 'opsentra',
      host: ['your-staging-server.com'],
      ref: 'origin/develop',
      repo: 'git@github.com:your-org/opsentra.git',
      path: '/opt/opsentra-staging',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env staging'
    }
  }
};