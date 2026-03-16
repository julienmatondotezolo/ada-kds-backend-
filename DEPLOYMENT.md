# AdaKDS Production Deployment Guide

Complete guide for deploying AdaKDS to production environments.

## 🎯 Pre-Deployment Checklist

### ✅ Database Requirements
- [ ] Supabase project created
- [ ] Database schema deployed (see README.md)
- [ ] Service role key obtained
- [ ] Database URL configured
- [ ] Test data cleared from database

### ✅ Security Requirements
- [ ] Environment variables secured
- [ ] CORS origins configured for production domains
- [ ] Rate limiting configured appropriately
- [ ] Service role key rotated if previously exposed

### ✅ Infrastructure Requirements
- [ ] Node.js 18+ runtime available
- [ ] Process manager (PM2) or container orchestration
- [ ] Load balancer configured (if multiple instances)
- [ ] Monitoring and logging setup

## 🚀 Deployment Options

### Option 1: Docker Deployment (Recommended)

#### 1. Create Dockerfile
```dockerfile
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install dependencies first (for better caching)
COPY package*.json ./
RUN npm ci --only=production

# Copy built application
COPY dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# Expose port
EXPOSE 5009

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http=require('http');const options={host:'localhost',port:5009,path:'/health',timeout:2000};const req=http.request(options,(res)=>{process.exit(res.statusCode===200?0:1)});req.on('error',()=>process.exit(1));req.end();"

# Start application
CMD ["node", "dist/index.js"]
```

#### 2. Create docker-compose.yml
```yaml
version: '3.8'
services:
  adakds-api:
    build: .
    ports:
      - "5009:5009"
    environment:
      - NODE_ENV=production
      - PORT=5009
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - CORS_ORIGINS=${CORS_ORIGINS}
      - ADAAUTH_API_URL=${ADAAUTH_API_URL}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5009/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

#### 3. Deploy
```bash
# Build and start
docker-compose up -d

# Check logs
docker-compose logs -f adakds-api

# Check health
curl http://localhost:5009/health
```

### Option 2: PM2 Deployment

#### 1. Install PM2
```bash
npm install -g pm2
```

#### 2. Create ecosystem.config.js
```javascript
module.exports = {
  apps: [{
    name: 'adakds-api',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5009
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5009,
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      CORS_ORIGINS: process.env.CORS_ORIGINS,
      ADAAUTH_API_URL: process.env.ADAAUTH_API_URL
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
```

#### 3. Deploy
```bash
# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
```

### Option 3: Cloud Platform Deployment

#### Vercel Deployment
```bash
# Install Vercel CLI
npm install -g vercel

# Configure vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "dist/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "dist/index.js"
    }
  ],
  "env": {
    "NODE_ENV": "production",
    "SUPABASE_URL": "@supabase_url",
    "SUPABASE_SERVICE_ROLE_KEY": "@supabase_service_role_key",
    "CORS_ORIGINS": "@cors_origins"
  }
}

# Deploy
vercel --prod
```

#### Heroku Deployment
```bash
# Create Procfile
echo "web: node dist/index.js" > Procfile

# Deploy
git add .
git commit -m "Production deployment"
heroku create your-adakds-api
heroku config:set NODE_ENV=production
heroku config:set SUPABASE_URL=your_supabase_url
heroku config:set SUPABASE_SERVICE_ROLE_KEY=your_key
heroku config:set CORS_ORIGINS=your_cors_origins
git push heroku main
```

## 🔧 Environment Configuration

### Production Environment Variables

Create a `.env.production` file:

```env
# Server
NODE_ENV=production
PORT=5009

# Database (CRITICAL)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-key

# Security
CORS_ORIGINS=https://your-kds-frontend.com,https://ada-menu-builder.vercel.app

# Integration
ADAAUTH_API_URL=https://auth.adasystems.app/

# Optional: Custom configuration
REQUEST_TIMEOUT=30000
MAX_PAYLOAD_SIZE=10mb
```

### Security Best Practices

1. **Never expose service role key in client code**
2. **Use environment-specific keys**
3. **Rotate keys regularly**
4. **Use least privilege principle**
5. **Configure CORS restrictively**

## 📊 Monitoring & Logging

### Health Monitoring

Set up automated health checks:

```bash
# Kubernetes liveness probe
livenessProbe:
  httpGet:
    path: /health
    port: 5009
  initialDelaySeconds: 30
  periodSeconds: 10

# Docker health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5009/health || exit 1
```

### Logging Configuration

#### Structured Logging
```javascript
// Add to your logging middleware
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

#### Key Metrics to Monitor
- Database connection status
- Response times
- Error rates
- Order processing volume
- WebSocket connections
- Memory usage

## 🚨 Troubleshooting

### Common Issues

#### Database Connection Failures
```bash
# Check database status
curl http://your-api-url/health

# Expected response when database fails:
{
  "status": "error",
  "database": {
    "connected": false,
    "error": "Database connection required but not available"
  }
}
```

#### CORS Issues
```bash
# Test CORS headers
curl -H "Origin: https://your-frontend.com" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://your-api-url/api/v1/restaurants/demo/orders
```

#### Socket.IO Connection Issues
```javascript
// Test Socket.IO connection
const io = require('socket.io-client');
const socket = io('http://your-api-url');

socket.on('connect', () => {
  console.log('Connected to AdaKDS API');
  socket.emit('join-restaurant', 'your-restaurant-id');
});

socket.on('disconnect', () => {
  console.log('Disconnected from AdaKDS API');
});
```

### Performance Optimization

#### Database Optimization
```sql
-- Add indexes for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kds_orders_restaurant_status_created 
  ON kds_orders(restaurant_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kds_orders_updated_at 
  ON kds_orders(updated_at DESC);
```

#### Application Optimization
```javascript
// Connection pooling (add to database config)
const supabase = createClient(url, key, {
  db: {
    schema: 'public',
  },
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  global: {
    headers: { 'x-application-name': 'adakds-api' },
  },
});
```

## 📋 Post-Deployment Verification

### 1. Health Check
```bash
curl http://your-api-url/health
# Should return status: "ok"
```

### 2. Database Connection
```bash
curl http://your-api-url/api/v1/restaurants/demo/orders
# Should return [] (empty array, not error)
```

### 3. WebSocket Connection
```javascript
// Test real-time functionality
const socket = io('http://your-api-url');
socket.emit('join-restaurant', 'demo');
// Should receive acknowledgment
```

### 4. Integration Test
```bash
# Test complete order flow (if you have valid menu)
curl -X POST http://your-api-url/api/v1/restaurants/demo/orders/ada-menu \
  -H "Content-Type: application/json" \
  -d '{"menu_id": "test_menu", "customer_name": "Test", "order_items": []}'
```

## 🔄 Updates and Maintenance

### Zero-Downtime Deployment

#### Blue-Green Deployment
1. Deploy new version to staging environment
2. Run integration tests
3. Switch load balancer to new version
4. Monitor for issues
5. Keep old version for quick rollback

#### Rolling Updates (Kubernetes)
```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxUnavailable: 1
    maxSurge: 1
```

### Database Migrations

When schema changes are needed:

1. **Backwards compatible changes first**
2. **Deploy application with dual compatibility**
3. **Apply schema changes**
4. **Remove old compatibility code**

## 🆘 Rollback Procedures

### Quick Rollback Steps

1. **Identify the issue**
   ```bash
   # Check health
   curl http://your-api-url/health
   
   # Check logs
   docker logs your-container
   # OR
   pm2 logs adakds-api
   ```

2. **Rollback application**
   ```bash
   # Docker
   docker-compose down
   git checkout previous-stable-commit
   docker-compose up -d
   
   # PM2
   pm2 stop adakds-api
   git checkout previous-stable-commit
   npm run build
   pm2 start adakds-api
   ```

3. **Verify rollback**
   ```bash
   curl http://your-api-url/health
   ```

---

**🎯 Production Ready**: This deployment guide ensures your AdaKDS API runs reliably in production with proper monitoring, security, and rollback procedures.