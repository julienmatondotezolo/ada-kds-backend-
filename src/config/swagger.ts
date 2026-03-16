import swaggerJSDoc from "swagger-jsdoc";
import swaggerUI from "swagger-ui-express";
import { Express } from "express";

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "AdaKDS API",
    version: "1.0.0",
    description: `
# AdaKDS - Kitchen Display System API
**Service Slug:** \`ada-kds\`

Real-time kitchen display system microservice for Ada Systems. This API provides order management, station configuration, and real-time updates for kitchen workflows.

## 📱 QR Code Integration

For QR code apps and external ordering systems, use the incoming orders endpoint:

\`\`\`http
POST /api/v1/restaurants/{restaurantId}/orders/incoming
Content-Type: application/json

{
  "source": "qr_code",
  "order_number": "QR001",
  "customer_name": "Table 5",
  "customer_type": "dine_in",
  "items": [
    {
      "name": "Pizza Margherita",
      "quantity": 1,
      "special_requests": "Extra cheese",
      "category": "pizza",
      "estimated_time": 12
    }
  ],
  "special_instructions": "Customer allergies: none"
}
\`\`\`

## 🔌 WebSocket Integration

### Connecting to Real-Time Updates

AdaKDS uses Socket.IO for real-time order and station updates:

\`\`\`javascript
// Connect to the KDS WebSocket
const socket = io('https://api-kds.adasystems.app', {
  auth: {
    token: 'your-jwt-token',
    restaurantId: 'your-restaurant-id'
  }
});

// Listen for order status changes
socket.on('order:updated', (order) => {
  console.log('Order status changed:', order);
  // Handle order update in your UI
});

// Listen for new orders
socket.on('order:created', (order) => {
  console.log('New order received:', order);
  // Add order to display
});

// Send order status update
socket.emit('order:updateStatus', {
  orderId: 'order-uuid',
  status: 'preparing',
  stationId: 'station-uuid'
});
\`\`\`

### WebSocket Events

**Listening Events:**
- \`order:created\` - New order received
- \`order:updated\` - Order status/details changed  
- \`order:deleted\` - Order cancelled/removed
- \`station:updated\` - Station configuration changed
- \`connection:restaurant\` - Join restaurant room for updates

**Emitting Events:**
- \`order:updateStatus\` - Update order status
- \`order:assignStation\` - Assign order to station
- \`join:restaurant\` - Join restaurant updates room

### Order Status Flow

\`\`\`
pending → preparing → ready → completed
    ↓         ↓        ↓
cancelled  cancelled  cancelled
\`\`\`

## 🔊 Order Status Change Notifications

### REST API Status Updates

Update order status via REST API:

\`\`\`http
PUT /api/v1/restaurants/{restaurantId}/orders/{orderId}/status
Content-Type: application/json
Authorization: Bearer <token>

{
  "status": "preparing",
  "station_id": "station-uuid",
  "estimated_completion": "2024-01-15T14:30:00Z"
}
\`\`\`

### WebSocket Listeners

All connected clients in the same restaurant receive real-time updates:

\`\`\`javascript
// Kitchen Display - listens for all order changes
socket.on('order:updated', (data) => {
  const { order, previousStatus, updatedBy } = data;
  updateOrderDisplay(order);
});

// QR Code App - listens for specific order
socket.on('order:updated', (data) => {
  if (data.order.id === myOrderId) {
    notifyCustomer(data.order.status);
  }
});

// Management Dashboard - listens for analytics
socket.on('order:updated', (data) => {
  updateOrderMetrics(data.order);
  logStatusChange(data);
});
\`\`\`

## Authentication

This API uses JWT tokens from AdaAuth for authentication. Include your token in the Authorization header:

\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

### User Roles

- **Staff**: Read-only access to orders and stations
- **Admin**: Full access to stations management, order updates  
- **Owner**: Full access + restaurant configuration
- **Super Admin**: System-wide access

### Getting Started

1. Obtain a JWT token from [AdaAuth](https://auth.adasystems.app)
2. Include the token in your API requests
3. Use the restaurant ID from your authenticated context

## Rate Limiting

API requests are limited to prevent abuse. Limits vary by endpoint and user role.

## Example Integration Flow

### QR Code Order Submission

1. **Customer scans QR code** → Opens ordering app
2. **App submits order** → POST to \`/orders/incoming\`
3. **KDS receives order** → WebSocket \`order:created\` event
4. **Kitchen updates status** → PUT to \`/orders/{id}/status\`
5. **Customer gets notification** → WebSocket \`order:updated\` event

### Real-Time Status Tracking

\`\`\`javascript
// QR Code app tracking order progress
socket.on('order:updated', (data) => {
  const { order } = data;
  
  switch(order.status) {
    case 'pending':
      showMessage('Order received! Preparing to cook...');
      break;
    case 'preparing': 
      showMessage(\`Now cooking! Estimated: \${order.estimated_completion}\`);
      break;
    case 'ready':
      showNotification('Your order is ready for pickup!');
      break;
    case 'completed':
      showMessage('Order completed. Thank you!');
      break;
  }
});
\`\`\`
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