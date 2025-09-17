# OpSentra Platform - Deployment Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- Python 3.9+ installed
- PM2 installed globally (`npm install -g pm2`)
- Git (for cloning)

### Initial Setup

1. **Clone and Setup**
   ```bash
   git clone <your-repo>
   cd opsentra
   
   # Copy environment file (already configured with production credentials)
   cp .env .env.local
   ```

2. **Install Dependencies**
   ```bash
   # Install all service dependencies
   npm run install:all
   ```

3. **Start All Services**
   ```bash
   # Start entire OpSentra platform
   pm2 start ecosystem.config.js
   
   # Check status
   pm2 status
   
   # View logs
   pm2 logs
   ```

4. **Access OpSentra Dashboard**
   - Open browser: `http://localhost:5050`
   - Frontend will be running with real-time log streaming
   - All backend services will be operational

## 📋 Service Overview

| Service | Port | Description |
|---------|------|-------------|
| **Frontend Dashboard** | 5050 | React+Vite UI for log visualization |
| **Node.js Backend** | 5051 | Central log aggregation server |
| **AI Analysis Layer** | 5052 | FastAPI service for error detection |
| **Log Shipper Agent** | - | Background service for log collection |

## 🔧 Individual Service Commands

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev    # Development
npm run build  # Production build
npm run preview # Preview build
```

### Backend Node.js
```bash
cd backend-node
npm install
npm start      # Production
npm run dev    # Development with nodemon
```

### AI Backend (FastAPI)
```bash
cd backend-fastapi
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 5052 --reload
```

### Log Shipper Service
```bash
cd backend-service
npm install
npm start      # Manual start
node install-service.js  # Install as system service
```

## 🔍 Monitoring & Debugging

### PM2 Commands
```bash
# Check service status
pm2 status

# View logs for all services
pm2 logs

# View logs for specific service
pm2 logs opsentra-frontend
pm2 logs opsentra-backend-node
pm2 logs opsentra-ai-backend
pm2 logs opsentra-log-shipper

# Restart specific service
pm2 restart <service-name>

# Stop all services
pm2 stop all

# Delete all services
pm2 delete all
```

### Health Checks
- Frontend: `http://localhost:5050` (should load dashboard)
- Node Backend: `http://localhost:5051/health`
- AI Backend: `http://localhost:5052/health`

## 📊 Production Deployment

### Cloud Services (Already Configured)
- **CloudAMQP**: Production RabbitMQ cluster
- **MongoDB Atlas**: Database cluster with opsentra database
- **AWS S3**: Log archival in ap-south-1 region
- **Groq API**: Primary AI analysis service
- **Google Gemini**: Fallback AI service

### System Service Installation
```bash
# Install log shipper as system service
cd backend-service
sudo node install-service.js
```

### Production Environment Variables
All production credentials are already configured in `.env` file:
- CloudAMQP connection
- MongoDB Atlas connection
- AWS S3 credentials
- AI service API keys

## 🔧 Configuration

### Environment Variables
The `.env` file contains all necessary configuration:
- Cloud service credentials
- API keys
- Service ports
- Processing parameters

### Customization
Edit `.env` file to modify:
- Batch sizes
- Archive intervals
- Log paths
- Service ports

## 📝 Log Sources

OpSentra automatically collects logs from:
- System logs (`/var/log/syslog`, `/var/log/auth.log`)
- Docker containers (if enabled)
- Kubernetes pods (if enabled)
- Jenkins builds (if enabled)
- Custom log paths (configurable)

## 🚨 Troubleshooting

### Common Issues

1. **Services won't start**
   - Check port availability: `netstat -tulpn | grep :5050`
   - Verify environment variables in `.env`
   - Check PM2 logs: `pm2 logs`

2. **RabbitMQ connection errors**
   - Verify CloudAMQP URL in `.env`
   - Check network connectivity to CloudAMQP

3. **MongoDB connection errors**
   - Verify MongoDB Atlas connection string
   - Check database permissions

4. **AI services not responding**
   - Verify API keys in `.env`
   - Check rate limits on Groq/Gemini APIs

### Log Files
- PM2 logs: `~/.pm2/logs/`
- Application logs: Check individual service outputs
- System service logs: `journalctl -u opsentra-log-shipper`

## 🔐 Security Notes

- All credentials are production-ready
- API keys have appropriate rate limits
- CloudAMQP uses SSL/TLS encryption
- MongoDB Atlas uses encrypted connections
- AWS S3 uses IAM-based access control

## 📈 Scaling

For production scaling:
- Deploy multiple log shipper instances
- Scale Node.js backend horizontally
- Use PM2 cluster mode for CPU-intensive services
- Configure CloudAMQP for high availability
- Set up MongoDB Atlas clusters

## 🆘 Support

For issues or questions:
1. Check PM2 logs: `pm2 logs`
2. Verify service health endpoints
3. Review configuration in `.env`
4. Check cloud service dashboards