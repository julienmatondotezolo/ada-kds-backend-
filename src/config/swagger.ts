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

Real-time kitchen display system microservice for Ada Systems. This API provides order management, station configuration, and real-time updates for kitchen workflows.

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

## WebSocket Support

Real-time updates are available via Socket.IO on the same server URL.
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