# OpSentra - Centralized Logging Tool

![OpSentra Logo](https://via.placeholder.com/400x100/2563eb/ffffff?text=OpSentra)

**OpSentra** is an AI-enhanced, real-time centralized logging tool that provides comprehensive log aggregation, analysis, and intelligent error resolution suggestions. Built with modern technologies and designed for distributed Linux environments, OpSentra offers an alternative to traditional ELK stack deployments with a focus on real-time streaming and AI-driven insights.

## 🚀 Key Features

### Real-Time Log Streaming
- **Server-Sent Events (SSE)** for instant log delivery to dashboard
- **Zero-latency** log visualization with automatic scrolling
- **Service-specific filtering** and centralized views
- **Live connection monitoring** with automatic reconnection

### AI-Enhanced Error Detection
- **Pattern-based error detection** using regex and heuristics
- **Dual LLM integration** with Groq API (primary) and Google Gemini (fallback)
- **Context-aware suggestions** for error resolution
- **Actionable Linux commands** generated for each error type

### Multi-Source Log Collection
- **System logs** from `/var/log/` directories
- **Docker container logs** with auto-discovery
- **Kubernetes pod logs** integration
- **Jenkins build logs** monitoring
- **Custom log paths** configuration

### Scalable Architecture
- **RabbitMQ messaging** for reliable, asynchronous communication
- **MongoDB storage** with time-series optimization
- **AWS S3 batch archival** with lifecycle management
- **Horizontal scaling** support for unlimited services

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Log Shipper   │────│    RabbitMQ     │────│  Node.js Backend│
│   (Linux VMs)   │    │   (CloudAMQP)   │    │   (Port 5050)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                         ┌─────────────────┐    ┌─────────────────┐
                         │  FastAPI AI     │    │  React Frontend │
                         │  (Port 8000)    │    │     (SSE)       │
                         └─────────────────┘    └─────────────────┘
                                │                        │
                         ┌─────────────────┐    ┌─────────────────┐
                         │   MongoDB       │    │     AWS S3      │
                         │   (Atlas)       │    │   (Archival)    │
                         └─────────────────┘    └─────────────────┘
```

### Component Responsibilities

| Component | Technology | Purpose | Port |
|-----------|------------|---------|------|
| **Frontend** | React + Vite | Real-time dashboard with AI suggestions | 5050 (served by Node.js) |
| **Backend-Node** | Node.js + Express | Log aggregation, SSE streaming, S3 batching | 5050 |
| **Backend-FastAPI** | FastAPI + Python | AI error detection and suggestion generation | 8000 |
| **Backend-Service** | Node.js | Distributed log collection and forwarding | N/A (agent) |
| **RabbitMQ** | CloudAMQP | Message queuing and routing | External |
| **MongoDB** | Atlas | Primary log storage with indexing | External |
| **AWS S3** | S3 | Batch archival and long-term storage | External |

## 🛠️ Quick Start

### Prerequisites

- **Node.js 16+** and npm
- **Python 3.11+** and pip
- **PM2** process manager (`npm install -g pm2`)
- **CloudAMQP** account for RabbitMQ
- **MongoDB Atlas** cluster
- **AWS account** with S3 access
- **Groq and/or Google Gemini API keys**

### Installation

1. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd opsentra
   npm run setup  # Installs all dependencies and creates .env
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your service credentials:
   # - CLOUDAMQP_URL (RabbitMQ connection)
   # - MONGODB_URL (Atlas connection string)
   # - AWS credentials (access key, secret, region)
   # - GROQ_API_KEY and GEMINI_API_KEY
   ```

3. **Build Frontend**
   ```bash
   npm run build
   ```

4. **Start Services**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

5. **Access Dashboard**
   Open [http://localhost:5050](http://localhost:5050) in your browser

## 📋 Detailed Setup Guide

### Phase 1: Core Infrastructure

#### 1. Environment Configuration

Create your `.env` file based on the provided template:

```bash
# RabbitMQ Configuration (CloudAMQP)
CLOUDAMQP_URL=amqp://user:password@host:5672/vhost

# MongoDB Configuration (Atlas)
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/opsentra

# AWS Configuration
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1

# AI API Keys
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key

# Application Settings
PORT=5050
NODE_ENV=production
LOG_LEVEL=info
BATCH_INTERVAL_MINUTES=10
```

#### 2. Service Dependencies

Install all package dependencies:

```bash
# Root dependencies
npm install

# Frontend dependencies
cd frontend && npm install && cd ..

# Backend Node.js dependencies
cd backend-node && npm install && cd ..

# Backend Service dependencies  
cd backend-service && npm install && cd ..

# Python dependencies for FastAPI
cd backend-fastapi
pip install -r requirements.txt
cd ..
```

#### 3. Database Setup

**MongoDB Atlas Configuration:**
1. Create a new cluster on [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create database user with read/write permissions
3. Whitelist your IP addresses
4. Copy connection string to `MONGODB_URL` in `.env`

**Automatic Collections:**
- `logs`: Main collection with time-series indexing
- Indexes created automatically on: `timestamp`, `service`, `level`, `synced_to_s3`

### Phase 2: Log Shipper Deployment

#### Installing on Linux Servers

**Automated Installation:**
```bash
# On each Linux server where you want to collect logs
sudo node backend-service/install-service.js
```

**Manual Configuration:**
```bash
# Edit the environment file
sudo nano /etc/opsentra/shipper.env

# Add your configuration:
CLOUDAMQP_URL=amqp://user:password@host:5672/vhost
SERVICE_NAME=web-server-01
LOG_PATHS=/var/log/*.log,/var/log/nginx/*.log
DOCKER_ENABLED=true
K8S_ENABLED=false
```

**Service Management:**
```bash
# Start the service
sudo systemctl start opsentra-shipper

# Enable auto-start
sudo systemctl enable opsentra-shipper

# Check status
sudo systemctl status opsentra-shipper

# View logs
sudo journalctl -u opsentra-shipper -f
```

### Phase 3: Production Deployment

#### PM2 Process Management

**Start all services:**
```bash
pm2 start ecosystem.config.js --env production
```

**Monitor services:**
```bash
pm2 monit              # Interactive monitoring
pm2 status              # Service status
pm2 logs                # View all logs
pm2 logs opsentra-backend-node  # Specific service logs
```

**Auto-startup configuration:**
```bash
pm2 startup             # Generate startup script
pm2 save                # Save current process list
```

#### Health Monitoring

- **Backend health**: `GET /health`
- **AI service health**: `GET http://localhost:8000/health`
- **AI processing stats**: `GET http://localhost:8000/stats`

## 🔧 Configuration Options

### Log Shipper Configuration

The log shipper can be configured via environment variables in `/etc/opsentra/shipper.env`:

```bash
# Service Discovery
DOCKER_ENABLED=true          # Monitor Docker containers
K8S_ENABLED=true            # Monitor Kubernetes pods  
JENKINS_ENABLED=false       # Monitor Jenkins builds

# Custom Log Paths (comma-separated)
CUSTOM_LOG_PATHS=/app/logs/*.log,/opt/service/logs/*.log

# Batch Processing
BATCH_SIZE=100              # Logs per batch
BATCH_TIMEOUT=5000          # Max batch wait time (ms)

# Performance
LOG_LEVEL=info              # debug, info, warn, error
```

### AI Processing Configuration

Configure AI behavior in your `.env`:

```bash
# Error Detection Patterns
AI_ERROR_PATTERNS="ERROR|Traceback|HTTP [45]\\d\\d|latency > \\d+ms|Failed"

# API Preferences
GROQ_API_KEY=primary_api_key        # Primary AI service
GEMINI_API_KEY=fallback_api_key     # Fallback AI service
```

### Frontend Customization

The React dashboard supports several customization options:

- **Service tabs**: Automatically generated based on incoming logs
- **Real-time filtering**: By service, log level, and search terms
- **AI suggestion display**: Expandable panels with copy-to-clipboard commands
- **Auto-scroll control**: Toggle automatic scrolling for live feeds

## 📊 Monitoring and Troubleshooting

### Log Analysis

**View live logs:**
```bash
# All services
pm2 logs

# Specific service
pm2 logs opsentra-backend-node

# With filtering
pm2 logs --lines 100 | grep ERROR
```

**Check AI processing:**
```bash
curl http://localhost:8000/stats
```

**Test log shipping:**
```bash
# Create test log entry
echo "$(date): TEST ERROR - This is a test error message" >> /var/log/test.log

# Check if it appears in dashboard and triggers AI analysis
```

### Common Issues

**RabbitMQ Connection Issues:**
- Verify `CLOUDAMQP_URL` format: `amqp://user:password@host:5672/vhost`
- Check CloudAMQP dashboard for connection limits
- Ensure firewall allows outbound AMQP connections

**MongoDB Connection Issues:**
- Verify Atlas cluster is running and accessible
- Check IP whitelist includes your server IP
- Ensure database user has proper permissions

**AI API Issues:**
- Verify API keys are valid and have sufficient quota
- Check API service status (Groq/Gemini)
- Monitor API call statistics at `/stats` endpoint

**Log Shipper Issues:**
- Check systemd service status: `systemctl status opsentra-shipper`
- Verify log file permissions are readable
- Ensure RabbitMQ connection in shipper config

## 🔐 Security Considerations

### Network Security
- Use SSL/TLS for all external connections (RabbitMQ, MongoDB, AWS)
- Implement VPN or private networking for production deployments
- Configure firewalls to restrict access to service ports

### Access Control
- **No built-in authentication** as specified in requirements
- Consider implementing reverse proxy with authentication if needed
- Use IAM roles and policies for AWS S3 access

### Data Privacy
- Log data is not encrypted at rest (MongoDB/S3 default encryption)
- Sensitive information in logs should be filtered before shipping
- Consider data retention policies for compliance requirements

## 🚀 Scaling and Performance

### Horizontal Scaling

**Add more log shippers:**
```bash
# Install on additional servers
sudo node backend-service/install-service.js

# Configure with unique service names
SERVICE_NAME=web-server-02
```

**Scale backend services:**
```bash
# Update ecosystem.config.js to increase instances
instances: 2  # for backend-node

# Restart services
pm2 restart ecosystem.config.js
```

### Performance Optimization

**RabbitMQ Tuning:**
- Use CloudAMQP plan with sufficient throughput
- Monitor queue depths and consumer lag
- Configure message TTL for cleanup

**MongoDB Optimization:**
- Use appropriate Atlas tier for your log volume
- Monitor index performance and create custom indexes
- Consider sharding for very high volumes

**S3 Cost Optimization:**
- Configure lifecycle policies for automatic deletion
- Use appropriate storage classes (Standard, IA, Glacier)
- Monitor storage costs and batch size efficiency

## 📈 Usage Examples

### Dashboard Features

**Centralized View:**
- View logs from all services in a single stream
- Real-time updates with automatic scrolling
- Search across all log messages and metadata

**Service-Specific Views:**
- Click service tabs to filter logs
- Each tab shows count of recent logs
- Maintains separate scroll position per service

**AI Suggestions:**
- Error logs automatically trigger AI analysis
- Expandable suggestion panels with explanations
- Copy-to-clipboard buttons for suggested commands

### API Usage

**Manual log analysis:**
```bash
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "service": "nginx",
    "level": "error", 
    "message": "nginx: [error] 502 Bad Gateway",
    "timestamp": "2024-01-15T10:30:00Z"
  }'
```

**Fetch logs via API:**
```bash
# Get recent logs
curl http://localhost:5050/api/logs?limit=50

# Filter by service
curl http://localhost:5050/api/logs?service=nginx&level=error

# Get available services
curl http://localhost:5050/api/services
```

## 🛣️ Roadmap

### Phase 2 (Future Enhancements)
- [ ] **Advanced AI Training**: Custom ML models trained on historical logs
- [ ] **Elasticsearch Integration**: Optional Elasticsearch backend for advanced querying
- [ ] **Alerting System**: Email/Slack notifications for critical errors
- [ ] **Log Correlation**: Cross-service error correlation and root cause analysis
- [ ] **Performance Metrics**: Integration with monitoring tools (Prometheus, Grafana)

### Phase 3 (Extended Platform)
- [ ] **Multi-tenancy**: Support for multiple organizations/teams
- [ ] **RBAC Authentication**: Role-based access control system
- [ ] **Windows Support**: Log shipper for Windows servers
- [ ] **Cloud Native**: Kubernetes operator for automated deployment
- [ ] **Machine Learning**: Predictive analytics for proactive error detection

## 🤝 Contributing

### Development Setup

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Install dependencies**: `npm run setup`
4. **Start development**: `npm run dev`
5. **Run tests**: `npm test`
6. **Commit changes**: `git commit -m 'Add amazing feature'`
7. **Push to branch**: `git push origin feature/amazing-feature`
8. **Open Pull Request**

### Development Guidelines

- Follow ESLint configuration for JavaScript/Node.js
- Use Prettier for code formatting
- Write tests for new features
- Update documentation for API changes
- Ensure cross-platform compatibility

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **RabbitMQ** for reliable message queuing
- **MongoDB** for flexible document storage
- **AWS S3** for cost-effective archival storage
- **React** and **Vite** for modern frontend development
- **FastAPI** for high-performance Python API development
- **PM2** for robust process management

---

**OpSentra** - *Transforming log chaos into actionable insights with AI-powered intelligence.*

For questions, issues, or feature requests, please open an issue on GitHub or contact the development team.

## 📞 Support

- **Documentation**: [GitHub Wiki](https://github.com/your-org/opsentra/wiki)
- **Issues**: [GitHub Issues](https://github.com/your-org/opsentra/issues)
- **Community**: [Discord Server](https://discord.gg/opsentra)
- **Email**: support@opsentra.dev#   O p s e n t r a - t e s t  
 