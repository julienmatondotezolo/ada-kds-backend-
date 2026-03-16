# AdaKDS - Kitchen Display System API

A production-ready Kitchen Display System API with real-time order management, built with Node.js, TypeScript, and Supabase.

## 🚀 Features

- **Real-time Order Management**: Live order updates via Socket.IO
- **Database-First Architecture**: Zero mock data, database-dependent operations
- **AdaMenuBuilder Integration**: Direct QR code order integration
- **Multi-Station Support**: Hot kitchen, cold prep, bar, and custom stations
- **Production Security**: Rate limiting, CORS, input validation
- **Health Monitoring**: Comprehensive health checks and error handling
- **TypeScript**: Full type safety and developer experience

## 📋 Requirements

- Node.js 18+ 
- TypeScript 4.9+
- Supabase account with configured database
- Environment variables configured

## ⚡ Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd ada-kds-backend
npm install
```

### 2. Environment Configuration

Create `.env` file:

```env
# Server Configuration
PORT=5009
NODE_ENV=production

# CORS Configuration
CORS_ORIGINS=https://your-frontend-url.com,http://localhost:3000

# Supabase Database (REQUIRED)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# AdaAuth API Integration
ADAAUTH_API_URL=https://auth.adasystems.app/
```

### 3. Database Setup

Run the following SQL in your Supabase SQL editor:

```sql
-- Create KDS orders table
CREATE TABLE IF NOT EXISTS kds_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) NOT NULL UNIQUE,
  restaurant_id VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'new',
  priority VARCHAR(20) DEFAULT 'normal',
  station VARCHAR(50) DEFAULT 'hot_kitchen',
  customer_name VARCHAR(200) NOT NULL,
  customer_type VARCHAR(20) DEFAULT 'dine_in',
  table_number VARCHAR(20),
  source VARCHAR(50) DEFAULT 'ada-menu-builder',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  special_instructions TEXT,
  total_price DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create published menus table (for menu validation)
CREATE TABLE IF NOT EXISTS published_menus (
  id VARCHAR(100) PRIMARY KEY,
  restaurant_id VARCHAR(100) NOT NULL,
  title VARCHAR(200) NOT NULL,
  menu_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  template_data JSONB DEFAULT '{}'::jsonb,
  published_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_kds_orders_restaurant_status ON kds_orders(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_kds_orders_created_at ON kds_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_published_menus_restaurant ON published_menus(restaurant_id);
```

### 4. Build and Start

```bash
# Build TypeScript
npm run build

# Start production server
npm start

# For development
npm run dev
```

## 🏗️ Architecture

### Database-First Design

This system is **intentionally database-dependent**:

- ❌ **No mock data** or fallback responses
- ❌ **No offline mode** or cached data
- ✅ **Fails fast** when database is unavailable
- ✅ **Real-time consistency** across all clients

### API Endpoints

#### Order Management
- `GET /api/v1/restaurants/:id/orders` - Get active orders
- `PUT /api/v1/restaurants/:id/orders/:orderId/status` - Update order status
- `POST /api/v1/restaurants/:id/orders/:orderId/bump` - Bump order to next status

#### AdaMenuBuilder Integration
- `POST /api/v1/restaurants/:id/orders/ada-menu` - Submit QR code order
- `POST /api/v1/restaurants/:id/orders/ada-menu/validate` - Validate menu items

#### System
- `GET /health` - Health check with database status
- `GET /api-docs` - Swagger API documentation

### Real-time Events (Socket.IO)

- `order_status_updated` - Order status changed
- `order_bumped` - Order moved to next status
- `new_order_received` - New order from AdaMenuBuilder

## 🔒 Security Features

- **Rate Limiting**: 100 requests/minute for public endpoints
- **CORS Protection**: Configurable allowed origins
- **Input Validation**: Menu source validation and item verification
- **Error Handling**: Comprehensive error responses without data leaks

## 🚨 Error Handling

The system returns appropriate HTTP status codes:

- `503` - Database unavailable (service cannot function)
- `404` - Menu or order not found
- `400` - Invalid request data
- `429` - Rate limit exceeded
- `500` - Server error

## 📊 Monitoring

### Health Check Response

```json
{
  "status": "ok",
  "service": "adakds-api",
  "version": "1.0.0",
  "uptime": 3600,
  "database": {
    "connected": true,
    "last_checked": "2026-03-16T14:00:00.000Z"
  },
  "features": {
    "ada_menu_integration": true,
    "order_validation": true,
    "real_time_updates": true
  }
}
```

### Database Failure Response

```json
{
  "status": "error",
  "service": "adakds-api",
  "database": {
    "connected": false,
    "error": "Database connection required but not available"
  },
  "features": {
    "ada_menu_integration": false,
    "order_validation": false,
    "real_time_updates": false
  }
}
```

## 🚀 Deployment

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 5009
CMD ["node", "dist/index.js"]
```

### Environment Variables for Production

```env
NODE_ENV=production
PORT=5009
SUPABASE_URL=https://your-production-database.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-production-service-key
CORS_ORIGINS=https://your-kds-frontend.com,https://ada-menu-builder.vercel.app
```

## 🧪 Testing

### Integration Test

```bash
# Test database connection
curl http://localhost:5009/health

# Test empty state (should return [])
curl http://localhost:5009/api/v1/restaurants/demo/orders

# Test order creation (requires valid menu)
curl -X POST http://localhost:5009/api/v1/restaurants/demo/orders/ada-menu \
  -H "Content-Type: application/json" \
  -d '{"menu_id": "your_menu_id", "customer_name": "Table 1", "order_items": []}'
```

### Database Dependency Test

1. Change `SUPABASE_URL` to invalid URL
2. Restart service
3. Verify API returns `503` status codes
4. Restore correct URL and verify recovery

## 📁 Project Structure

```
src/
├── routes/           # API endpoint handlers
├── middleware/       # Authentication, validation, rate limiting
├── lib/              # Database operations, utilities
├── config/           # Swagger documentation setup
└── index.ts         # Main application entry point
```

## 🔧 Development

```bash
# Install dependencies
npm install

# Run in development mode with auto-reload
npm run dev

# Build TypeScript
npm run build

# Type checking
npm run type-check

# Lint code
npm run lint
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in this repository
- Check the health endpoint for system status
- Review the Swagger documentation at `/api-docs`

---

**Production Ready**: This system has been thoroughly tested for database dependency, real-time functionality, and error handling. It contains zero mock data and requires a live database connection to function.