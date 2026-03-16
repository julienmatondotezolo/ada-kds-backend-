import swaggerJSDoc from "swagger-jsdoc";
import swaggerUI from "swagger-ui-express";
import { Express } from "express";

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "AdaKDS - Kitchen Display System API",
    version: "1.0.0",
    description: `
# AdaKDS - Real-Time Kitchen Display System
**Service Slug:** \`ada-kds\`

**What this API does:** Real-time kitchen order management system that connects QR code ordering apps, POS systems, and phone assistants to kitchen displays. Orders flow automatically from customers to kitchen staff with live status updates.

---

## 🍕 How It Works

### 1. Order Submission (QR Code Apps, Phone Assistant, etc.)
External systems submit orders → Orders appear instantly on kitchen displays → Kitchen updates status → Real-time notifications to customers

### 2. Kitchen Workflow
- **Orders appear automatically** on kitchen displays grouped by station
- **Staff updates status** by tapping/clicking (pending → preparing → ready → completed)
- **Real-time synchronization** across all displays and customer apps

### 3. Customer Experience  
- **Submit order** via QR code, website, or phone
- **Track progress** with live status updates (preparing, ready, etc.)
- **Get notified** when order is ready for pickup

---

## 📱 **QR Code & External Integration**

### Submit New Orders (The Main Entry Point)

**Endpoint:** \`POST /api/v1/restaurants/{restaurantId}/orders/incoming\`

**What it does:** QR code apps, phone assistants, and POS systems use this to submit new orders directly to the kitchen.

\`\`\`javascript
// QR Code App Example
const orderResponse = await fetch('https://api-kds.adasystems.app/api/v1/restaurants/restaurant-uuid/orders/incoming', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    source: "qr_code",           // or "phone_assistant", "website", "pos_system"
    order_number: "QR-001",      // Your unique order ID
    customer_name: "Table 5",    // Customer/table identifier
    customer_type: "dine_in",    // "dine_in", "takeaway", "delivery"
    priority: "normal",          // "low", "normal", "high", "urgent"
    items: [
      {
        name: "Pizza Margherita",
        quantity: 2,
        special_requests: "Extra cheese, no oregano",
        category: "pizza",       // Used for auto-station assignment
        estimated_time: 15       // Minutes to prepare
      },
      {
        name: "Coca Cola",
        quantity: 2,
        category: "drinks",
        estimated_time: 1
      }
    ],
    special_instructions: "Customer allergic to nuts"
  })
});

// Response: Order created with auto-assigned station and UUID
// Kitchen displays update automatically via WebSocket
\`\`\`

### What Happens Next
1. **Order gets UUID** and is **auto-assigned to station** based on item categories
2. **Kitchen displays update instantly** via WebSocket events
3. **Order appears** in the appropriate station queue (grill, cold prep, bar, etc.)
4. **Kitchen staff can track and update** status immediately

---

## ⚡ **Real-Time WebSocket Integration**

### Connect to Live Updates

**WebSocket URL:** \`wss://api-kds.adasystems.app\`

\`\`\`javascript
import io from 'socket.io-client';

// Connect to KDS WebSocket
const socket = io('https://api-kds.adasystems.app', {
  auth: {
    token: 'your-jwt-token',              // Get from AdaAuth
    restaurantId: 'restaurant-uuid'       // Your restaurant ID
  }
});

// Join restaurant room for updates
socket.emit('join:restaurant', 'restaurant-uuid');
\`\`\`

### Listen for Order Events

\`\`\`javascript
// NEW ORDER RECEIVED (from QR codes, phone assistant, etc.)
socket.on('new_order_received', (data) => {
  const { order, source, timestamp } = data;
  console.log(\`New \${source} order: \${order.order_number}\`);
  
  // Add to kitchen display immediately
  addOrderToDisplay(order);
  playNotificationSound();
});

// ORDER STATUS CHANGED (kitchen updates)
socket.on('order_status_updated', (data) => {
  const { order_id, new_status, updated_at } = data;
  console.log(\`Order \${order_id} → \${new_status}\`);
  
  // Update kitchen display
  updateOrderDisplay(order_id, new_status);
  
  // Notify customer app if connected
  if (isCustomerApp) {
    notifyCustomer(new_status);
  }
});

// ORDER BUMPED (quick status progression)
socket.on('order_bumped', (data) => {
  const { order_id, old_status, new_status, bump_time } = data;
  updateOrderStatus(order_id, new_status);
});
\`\`\`

### Send Status Updates (Kitchen Staff)

\`\`\`javascript
// Update order status (triggers WebSocket broadcast)
function updateOrderStatus(orderId, newStatus) {
  // Method 1: Via WebSocket
  socket.emit('order:updateStatus', {
    orderId: orderId,
    status: newStatus,
    stationId: 'current-station-uuid'
  });
  
  // Method 2: Via REST API (also triggers WebSocket)
  fetch(\`/api/v1/restaurants/restaurant-uuid/orders/\${orderId}/status\`, {
    method: 'PUT',
    headers: { 
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify({ status: newStatus })
  });
}
\`\`\`

---

## 📊 **Order Status Flow & Management**

### Status Progression
\`\`\`
new → preparing → ready → completed
 ↓       ↓         ↓
cancelled  cancelled  cancelled
\`\`\`

### Get Active Orders (Kitchen Display)
\`\`\`javascript
// Fetch current orders for kitchen display
const response = await fetch('/api/v1/restaurants/restaurant-uuid/orders', {
  headers: { 'Authorization': 'Bearer ' + token }
});
const orders = await response.json();

// Response: Array of active orders (excludes completed)
orders.forEach(order => {
  console.log(\`\${order.order_number}: \${order.status} at \${order.station}\`);
});
\`\`\`

### Update Order Status (Kitchen Staff)
\`\`\`javascript
// Update via REST API
await fetch('/api/v1/restaurants/restaurant-uuid/orders/order-uuid/status', {
  method: 'PUT',
  headers: { 
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json' 
  },
  body: JSON.stringify({
    status: "preparing",                    // Required
    station_id: "station-uuid",            // Optional
    estimated_completion: "2024-01-15T14:30:00Z",  // Optional
    notes: "Started by Chef Mario"          // Optional
  })
});

// This triggers WebSocket 'order_status_updated' event to all connected clients
\`\`\`

### Bump Order (Quick Progression)
\`\`\`javascript
// Quick status progression (new → preparing → ready → completed)
await fetch('/api/v1/restaurants/restaurant-uuid/orders/order-uuid/bump', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + token }
});
\`\`\`

---

## 🏪 **Kitchen Station Management**

### Auto-Station Assignment
Orders are **automatically assigned to stations** based on item categories:

- **\`pizza\`, \`pasta\`, \`meat\`** → Hot Kitchen
- **\`salad\`, \`cold_appetizers\`, \`dessert\`** → Cold Prep  
- **\`grilled_meat\`, \`grilled_fish\`** → Grill Station
- **\`drinks\`, \`cocktails\`, \`coffee\`** → Bar

### Station Configuration (Admin Only)
\`\`\`javascript
// Get all stations
const stations = await fetch('/api/v1/restaurants/restaurant-uuid/stations', {
  headers: { 'Authorization': 'Bearer ' + adminToken }
});

// Create new station
await fetch('/api/v1/restaurants/restaurant-uuid/stations', {
  method: 'POST',
  headers: { 
    'Authorization': 'Bearer ' + adminToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: "Grill Station",
    code: "GRILL", 
    color: "#FF6B35",
    categories: ["grilled_meat", "grilled_fish", "burgers"],
    display_order: 1
  })
});
\`\`\`

---

## 🔐 **Authentication & Permissions**

### Get JWT Token
1. **Authenticate with AdaAuth:** https://auth.adasystems.app
2. **Include token in requests:** \`Authorization: Bearer <your-jwt-token>\`

### Permission Levels
- **\`staff\`**: View orders, update status
- **\`admin\`**: + Manage stations, full order management
- **\`owner\`**: + Restaurant configuration
- **\`super_admin\`**: System-wide access

\`\`\`javascript
// All API requests need authentication
const headers = {
  'Authorization': 'Bearer ' + jwtToken,
  'Content-Type': 'application/json'
};
\`\`\`

---

## 🎯 **Complete Integration Example**

### QR Code App → Kitchen Display → Customer Notification

\`\`\`javascript
// 1. QR CODE APP: Submit order
const order = await submitOrder({
  source: "qr_code",
  order_number: "QR-123",
  customer_name: "Table 8",
  items: [{ name: "Pizza Margherita", quantity: 1, category: "pizza" }]
});

// 2. KITCHEN DISPLAY: Auto-receives via WebSocket
socket.on('new_order_received', (data) => {
  displayOrder(data.order);  // Shows in Hot Kitchen station
});

// 3. KITCHEN STAFF: Updates status
await updateOrderStatus(order.id, "preparing");

// 4. CUSTOMER APP: Gets notification via WebSocket  
socket.on('order_status_updated', (data) => {
  if (data.order_id === order.id) {
    showNotification("Your pizza is being prepared!");
  }
});

// 5. KITCHEN STAFF: Marks ready
await updateOrderStatus(order.id, "ready");

// 6. CUSTOMER: Gets pickup notification
socket.on('order_status_updated', (data) => {
  if (data.new_status === "ready") {
    showAlert("Your order is ready for pickup!");
  }
});
\`\`\`

---

## 📋 **Rate Limits & Production Notes**

- **Public endpoints** (\`/incoming\`): Generous limits for customer orders
- **Authenticated endpoints**: Standard rate limiting by role
- **WebSocket connections**: Persistent, auto-reconnect recommended
- **Database**: Fail-hard approach - no mock data, real operations only
- **Multi-tenant**: Restaurant isolation via UUID in all requests

**Production URL:** https://api-kds.adasystems.app  
**Development URL:** http://localhost:5009
`,
    contact: {
      name: "Ada Systems Support", 
      url: "https://ada.systems",
      email: "support@ada.systems"
    },
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT"
    }
  },
  servers: [
    {
      url: "https://api-kds.adasystems.app",
      description: "Production server",
    },
    {
      url: "http://localhost:5009", 
      description: "Development server",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT token from AdaAuth API. Format: Bearer <token>"
      },
    },
    schemas: {
      User: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            description: "Unique user identifier"
          },
          email: {
            type: "string",
            format: "email",
            description: "User email address"
          },
          role: {
            type: "string",
            enum: ["staff", "admin", "owner", "super_admin"],
            description: "User role determining access permissions"
          },
          restaurantIds: {
            type: "array",
            items: { type: "string" },
            description: "List of restaurant IDs the user has access to"
          },
          permissions: {
            type: "array", 
            items: { type: "string" },
            description: "Specific permissions granted to the user"
          },
          name: {
            type: "string",
            description: "User display name"
          }
        }
      },
      Station: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            description: "Unique station identifier"
          },
          restaurant_id: {
            type: "string",
            format: "uuid", 
            description: "Restaurant this station belongs to"
          },
          name: {
            type: "string",
            description: "Station display name",
            example: "Grill Station"
          },
          code: {
            type: "string",
            description: "Short station code for internal reference",
            example: "GRILL"
          },
          color: {
            type: "string",
            pattern: "^#[0-9A-F]{6}$",
            description: "Hex color code for station UI",
            example: "#FF6B35"
          },
          categories: {
            type: "array",
            items: { type: "string" },
            description: "Food categories handled by this station",
            example: ["meat", "burgers", "steaks"]
          },
          active: {
            type: "boolean",
            description: "Whether the station is currently active",
            default: true
          },
          display_order: {
            type: "integer",
            description: "Order position for display (1-based)",
            minimum: 1
          },
          created_at: {
            type: "string",
            format: "date-time",
            description: "Station creation timestamp"
          },
          updated_at: {
            type: "string", 
            format: "date-time",
            description: "Station last update timestamp"
          }
        },
        required: ["id", "restaurant_id", "name", "code", "display_order"]
      },
      Order: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            description: "Unique order identifier"
          },
          restaurant_id: {
            type: "string",
            format: "uuid",
            description: "Restaurant this order belongs to"
          },
          order_number: {
            type: "string",
            description: "Human-readable order number",
            example: "#1234"
          },
          status: {
            type: "string",
            enum: ["pending", "preparing", "ready", "completed", "cancelled"],
            description: "Current order status"
          },
          priority: {
            type: "string",
            enum: ["low", "normal", "high", "urgent"],
            default: "normal",
            description: "Order priority level"
          },
          station_id: {
            type: "string",
            format: "uuid",
            description: "Current station handling this order"
          },
          items: {
            type: "array",
            description: "Order items/products",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                quantity: { type: "integer", minimum: 1 },
                notes: { type: "string" },
                category: { type: "string" }
              }
            }
          },
          total_amount: {
            type: "number",
            format: "decimal",
            description: "Total order value",
            minimum: 0
          },
          currency: {
            type: "string",
            default: "EUR",
            description: "Currency code"
          },
          customer_name: {
            type: "string",
            description: "Customer name for the order"
          },
          estimated_time: {
            type: "integer",
            description: "Estimated preparation time in minutes"
          },
          created_at: {
            type: "string",
            format: "date-time"
          },
          updated_at: {
            type: "string",
            format: "date-time"
          }
        },
        required: ["id", "restaurant_id", "order_number", "status", "items"]
      },
      Error: {
        type: "object",
        properties: {
          error: {
            type: "string",
            description: "Error type/code"
          },
          message: {
            type: "string", 
            description: "Human-readable error message"
          },
          details: {
            type: "object",
            description: "Additional error details",
            additionalProperties: true
          }
        },
        required: ["error", "message"]
      }
    },
    responses: {
      UnauthorizedError: {
        description: "Authentication required",
        content: {
          "application/json": {
            schema: {
              allOf: [
                { $ref: "#/components/schemas/Error" },
                {
                  properties: {
                    error: { example: "Authentication required" },
                    message: { example: "Please provide a valid Bearer token" }
                  }
                }
              ]
            }
          }
        }
      },
      ForbiddenError: {
        description: "Access denied - insufficient permissions",
        content: {
          "application/json": {
            schema: {
              allOf: [
                { $ref: "#/components/schemas/Error" },
                {
                  properties: {
                    error: { example: "Access denied" },
                    message: { example: "Admin access required for this operation" }
                  }
                }
              ]
            }
          }
        }
      },
      NotFoundError: {
        description: "Resource not found",
        content: {
          "application/json": {
            schema: {
              allOf: [
                { $ref: "#/components/schemas/Error" },
                {
                  properties: {
                    error: { example: "Not found" },
                    message: { example: "The requested resource was not found" }
                  }
                }
              ]
            }
          }
        }
      },
      ValidationError: {
        description: "Invalid request data",
        content: {
          "application/json": {
            schema: {
              allOf: [
                { $ref: "#/components/schemas/Error" },
                {
                  properties: {
                    error: { example: "Validation error" },
                    message: { example: "One or more fields are invalid" }
                  }
                }
              ]
            }
          }
        }
      }
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ],
  tags: [
    {
      name: "Health",
      description: "System health and status endpoints"
    },
    {
      name: "Authentication", 
      description: "User authentication and authorization"
    },
    {
      name: "Stations",
      description: "Kitchen station management (Admin access required for modifications)"
    },
    {
      name: "Orders",
      description: "Order management and real-time updates"
    },
    {
      name: "Display",
      description: "Kitchen display configuration and data"
    }
  ]
};

const options = {
  definition: swaggerDefinition,
  apis: ["./src/routes/*.ts", "./src/index.ts", "./src/middleware/*.ts"],
};

const swaggerSpec = swaggerJSDoc(options);

export const setupSwagger = (app: Express): void => {
  // Custom CSS for Ada Systems branding
  const customCSS = `
    .swagger-ui .topbar { display: none }
    .swagger-ui { font-family: 'Inter', system-ui, sans-serif; }
    .swagger-ui .info .title { color: #4d6aff; }
    .swagger-ui .scheme-container { background: #f8fafc; border: 1px solid #e2e8f0; }
  `;

  app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(swaggerSpec, {
    customCss: customCSS,
    customSiteTitle: "AdaKDS API Documentation",
    customfavIcon: "/favicon.ico",
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: "list",
      filter: true,
      showRequestDuration: true,
      defaultModelsExpandDepth: 2,
      tryItOutEnabled: true
    }
  }));
};