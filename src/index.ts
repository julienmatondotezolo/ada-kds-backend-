import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import dotenv from "dotenv";
import ordersRoutes from "./routes/orders";
import stationsRoutes from "./routes/stations";
import displayRoutes from "./routes/display";
import incomingOrdersRoutes from "./routes/incoming-orders";
import { errorHandler } from "./middleware/error-handler";
import { requestLogger } from "./middleware/request-logger";
import { setupSwagger } from "./config/swagger";

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5005; // AdaKDS on port 5005
const startTime = Date.now();

// ─── Socket.IO for real-time updates ──────────────────────────────────────
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGINS?.split(",") || "*",
    methods: ["GET", "POST"]
  }
});

// Make io available to routes
app.set('io', io);

// ─── CORS ──────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
  : undefined;

app.use(
  cors({
    origin: allowedOrigins || true,
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
 */
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "adakds-api",
    version: "1.0.0",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
});

// ─── Kitchen Display System Routes ────────────────────────────────────────
app.use("/api/v1/restaurants/:restaurantId/orders", ordersRoutes);
app.use("/api/v1/restaurants/:restaurantId/orders", incomingOrdersRoutes);
app.use("/api/v1/restaurants/:restaurantId/stations", stationsRoutes);
app.use("/api/v1/restaurants/:restaurantId/display", displayRoutes);

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
server.listen(PORT, () => {
  console.log(`🍳 AdaKDS API running on http://localhost:${PORT}`);
  console.log(`   Health:    http://localhost:${PORT}/health`);
  console.log(`   API:       http://localhost:${PORT}/api/v1`);
  console.log(`   📚 Docs:   http://localhost:${PORT}/api-docs`);
  console.log(`   🔌 Socket.IO enabled for real-time updates`);
});

export default app;