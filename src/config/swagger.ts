import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Express } from "express";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "AdaKDS API",
      version: "1.0.0",
      description: "Kitchen Display System API for restaurants",
      contact: {
        name: "Ada Systems",
        url: "https://adasystems.app",
      },
    },
    servers: [
      {
        url: "https://api-kds.adasystems.app",
        description: "Production server",
      },
      {
        url: "http://localhost:5005",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    "./src/routes/*.ts",
    "./src/index.ts",
  ],
};

const specs = swaggerJsdoc(options);

export const setupSwagger = (app: Express): void => {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "AdaKDS API Documentation",
  }));
};