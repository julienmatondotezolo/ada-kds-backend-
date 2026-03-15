# AdaKDS Backend API

Kitchen Display System (KDS) backend for Ada Systems restaurant platform.

## 🚀 Features

- **Real-time Order Management**: Live order tracking with Socket.IO
- **Station Management**: Configure kitchen stations and workflows
- **Display Configuration**: Customizable KDS display settings
- **Analytics**: Kitchen performance metrics and insights
- **Authentication**: Integration with AdaAuth SSO system

## 🏗️ Architecture

- **Express.js** - REST API framework
- **TypeScript** - Type-safe development
- **Socket.IO** - Real-time WebSocket communication
- **Supabase** - Database and authentication
- **Swagger** - API documentation

## 📡 API Endpoints

### Orders
- `GET /api/v1/restaurants/{restaurantId}/orders` - Get active orders
- `PUT /api/v1/restaurants/{restaurantId}/orders/{orderId}/status` - Update order status  
- `POST /api/v1/restaurants/{restaurantId}/orders/{orderId}/bump` - Bump order to next status
- `GET /api/v1/restaurants/{restaurantId}/orders/analytics` - Get kitchen analytics

### Stations
- `GET /api/v1/restaurants/{restaurantId}/stations` - Get kitchen stations
- `POST /api/v1/restaurants/{restaurantId}/stations` - Create new station
- `PUT /api/v1/restaurants/{restaurantId}/stations/{stationId}` - Update station
- `GET /api/v1/restaurants/{restaurantId}/stations/{stationId}/orders` - Get station orders

### Display
- `GET /api/v1/restaurants/{restaurantId}/display/config` - Get display configuration
- `PUT /api/v1/restaurants/{restaurantId}/display/config` - Update display configuration
- `GET /api/v1/restaurants/{restaurantId}/display/status` - Get display status
- `POST /api/v1/restaurants/{restaurantId}/display/test-alert` - Send test alert
- `POST /api/v1/restaurants/{restaurantId}/display/refresh` - Force refresh displays

## 🔌 Real-time Events

### Socket.IO Events
- `order_status_updated` - Order status changed
- `order_bumped` - Order moved to next status
- `station_updated` - Station configuration changed
- `display_config_updated` - Display settings changed
- `test_alert` - Test notification sent
- `force_refresh` - Force refresh all displays

## 🛠️ Development

### Environment Setup
```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev

# Build for production
npm run build
npm start
```

### Environment Variables
```env
PORT=5005
NODE_ENV=development
CORS_ORIGINS=https://adakds.vercel.app,https://auth.adasystems.app
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_key
ADAAUTH_API_URL=https://auth.adasystems.app
```

## 🏢 Production Deployment

### VPS Deployment
1. Deploy to VPS with PM2
2. Configure Nginx reverse proxy for `api-kds.adasystems.app`
3. Set up SSL certificates

### Environment
- **Production URL**: `https://api-kds.adasystems.app`
- **Documentation**: `https://api-kds.adasystems.app/api-docs`
- **Health Check**: `https://api-kds.adasystems.app/health`

## 📊 Database Schema

### Tables Required
```sql
-- Orders table
CREATE TABLE kds_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id),
  order_number text NOT NULL,
  status text CHECK (status IN ('new', 'preparing', 'ready', 'completed', 'cancelled')),
  station text,
  priority text DEFAULT 'normal',
  items jsonb,
  customer_name text,
  customer_type text DEFAULT 'dine_in',
  order_time timestamptz DEFAULT now(),
  estimated_ready_time timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Stations table
CREATE TABLE kds_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  color text DEFAULT '#6B7280',
  display_order integer,
  active boolean DEFAULT true,
  estimated_capacity integer DEFAULT 5,
  categories jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Display configuration table
CREATE TABLE kds_display_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) UNIQUE,
  config jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

## 🔐 Authentication

Currently using mock authentication. To enable real auth:

1. Uncomment auth middleware in route files:
```typescript
router.use(requireAuth);
router.use(requireRestaurantAccess);
```

2. Update auth middleware to validate with AdaAuth service

## 📱 Frontend Integration

The KDS frontend connects via:
- **REST API** for initial data loading
- **Socket.IO** for real-time updates
- **WebSocket URL**: `wss://api-kds.adasystems.app`

## 🏪 Business Integration

### L'Osteria Integration
- Restaurant ID: Linked to existing AdaMenu customer
- Pricing: €150-250/month premium add-on
- Stations: Hot Kitchen, Cold Prep, Grill, Bar

## 📈 Analytics & Monitoring

### Metrics Tracked
- Order completion times
- Station efficiency
- Peak hour analysis  
- Kitchen capacity utilization
- Real-time performance dashboard

## 🔧 TODO

- [ ] Implement real Supabase database integration
- [ ] Enable AdaAuth authentication  
- [ ] Add order persistence and history
- [ ] Implement station capacity algorithms
- [ ] Add comprehensive error handling
- [ ] Set up monitoring and logging
- [ ] Add automated testing suite

## 📞 Support

Part of the Ada Systems ecosystem - contact Ada Systems for support.

**Related Services**:
- AdaMenu: Menu management
- AdaStock: Inventory tracking  
- AdaStaff: Employee scheduling
- AdaAuth: Authentication service