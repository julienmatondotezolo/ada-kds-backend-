import dotenv from "dotenv";
// ⚡ Load environment variables FIRST before any other imports
dotenv.config();

// 🔍 Debug environment variables immediately after loading
console.log('🔍 Environment Variables Loaded:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'MISSING');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? `SET (${process.env.SUPABASE_SERVICE_ROLE_KEY.slice(0, 20)}...)` : 'MISSING');

import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import ordersRoutes from "./routes/orders";
import stationsRoutes from "./routes/stations";
import stationsManagementRoutes from "./routes/stations-management";
import displayRoutes from "./routes/display";
import incomingOrdersRoutes from "./routes/incoming-orders";
import adaMenuOrdersRoutes from "./routes/ada-menu-orders";
import { errorHandler } from "./middleware/error-handler";
import { requestLogger } from "./middleware/request-logger";
import { setupSwagger } from "./config/swagger";
import { initializeDatabase, getDatabaseStatus } from "./lib/database";

const app = express();

// ─── Trust proxy for nginx reverse proxy (MUST BE FIRST) ───────────────────
app.set('trust proxy', true);

const server = createServer(app);
const PORT = parseInt(process.env.PORT || '5009'); // AdaKDS configurable port
const startTime = Date.now();

// ─── CORS Configuration ──────────────────────────────────────────────────
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
  : ["https://kds.adasystems.app"];

console.log('🔗 CORS allowed origins:', allowedOrigins);

// ─── Socket.IO for real-time updates ──────────────────────────────────────
const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Make io available to routes
app.set('io', io);

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-API-Key",
      "ngrok-skip-browser-warning",
      "X-Requested-With",
      "Accept",
      "Origin"
    ],
    credentials: true,
  })
);

// ─── Body parsers ──────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── Request logging ───────────────────────────────────────────────────────
app.use(requestLogger);

// ─── Swagger API Documentation ─────────────────────────────────────────────
setupSwagger(app);

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *       503:
 *         description: Database unavailable
 */
app.get("/health", (_req, res) => {
  const dbStatus = getDatabaseStatus();
  
  if (!dbStatus.connected) {
    res.status(503).json({
      status: "error",
      service: "adakds-api",
      version: "1.0.0",
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        last_checked: new Date(dbStatus.lastChecked).toISOString(),
        error: "Database connection required but not available"
      },
      features: {
        ada_menu_integration: false,
        order_validation: false,
        real_time_updates: false
      }
    });
    return;
  }

  res.json({
    status: "ok",
    service: "adakds-api",
    version: "1.0.0",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    database: {
      connected: true,
      last_checked: new Date(dbStatus.lastChecked).toISOString()
    },
    features: {
      ada_menu_integration: true,
      order_validation: true,
      real_time_updates: true
    }
  });
});

// ─── Kitchen Display System Routes ────────────────────────────────────────
app.use("/api/v1/restaurants/:restaurantId/orders", ordersRoutes);
app.use("/api/v1/restaurants/:restaurantId/orders", incomingOrdersRoutes);
app.use("/api/v1/restaurants/:restaurantId/orders", adaMenuOrdersRoutes);
app.use("/api/v1/restaurants/:restaurantId/stations", stationsRoutes);
app.use("/api/v1/restaurants/:restaurantId/display", displayRoutes);

// ─── Stations Management Routes ────────────────────────────────────────────
app.use("/api/v1", stationsManagementRoutes);

// ─── Socket.IO Connection Handling ────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`Kitchen display connected: ${socket.id}`);
  
  socket.on('join-restaurant', (restaurantId) => {
    socket.join(`restaurant-${restaurantId}`);
    console.log(`Socket ${socket.id} joined restaurant ${restaurantId}`);
  });
  
  socket.on('disconnect', () => {
    console.log(`Kitchen display disconnected: ${socket.id}`);
  });
});

// ─── Global error handler (must be last) ───────────────────────────────────
app.use(errorHandler);

// ─── Process-level error handling ──────────────────────────────────────────
process.on("uncaughtException", (err: NodeJS.ErrnoException) => {
  if (err.code === "EPIPE" || err.code === "ECONNRESET") {
    console.warn(`[WARN] ${err.code} — client disconnected, ignoring.`);
    return;
  }
  console.error("[FATAL] Uncaught exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled rejection:", reason);
});

// ─── Start server ──────────────────────────────────────────────────────────
server.listen(PORT, async () => {
  console.log(`🍳 AdaKDS API running on http://localhost:${PORT}`);
  console.log(`   Health:    http://localhost:${PORT}/health`);
  console.log(`   API:       http://localhost:${PORT}/api/v1`);
  console.log(`   📚 Docs:   http://localhost:${PORT}/api-docs`);
  console.log(`   🔌 Socket.IO enabled for real-time updates`);
  
  // Initialize database connection (required for operation)
  try {
    await initializeDatabase();
    console.log(`\n🔗 AdaMenuBuilder Integration:`);
    console.log(`   Order endpoint: POST ${PORT}/api/v1/restaurants/:id/orders/ada-menu`);
    console.log(`   Validation:     POST ${PORT}/api/v1/restaurants/:id/orders/ada-menu/validate`);
    console.log(`   Allowed sources: ada-menu-builder.vercel.app, localhost:5173`);
  } catch (error) {
    console.error('\n❌ CRITICAL ERROR: Database initialization failed');
    console.error('   Service will not function properly without database connectivity');
    console.error('   Health endpoint will return 503 until database is available');
    // Don't exit process - let health endpoint show the error status
  }
});

export default app;