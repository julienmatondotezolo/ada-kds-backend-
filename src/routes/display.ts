import { Router, Request, Response } from "express";
import { publicLimiter } from "../middleware/rate-limit";

const router = Router({ mergeParams: true });

router.use(publicLimiter);

/**
 * @swagger
 * /api/v1/restaurants/{restaurantId}/display/config:
 *   get:
 *     summary: Get kitchen display configuration
 *     tags: [Display Settings]
 */
router.get("/config", async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    
    // FAIL-HARD: No mock data - requires real database implementation
    res.status(503).json({
      error: "DATABASE_REQUIRED",
      message: "Display configuration requires database implementation. No fallback data provided."
    });
  } catch (error) {
    console.error("Error fetching display config:", error);
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch display config" });
  }
});

/**
 * @swagger
 * /api/v1/restaurants/{restaurantId}/display/config:
 *   put:
 *     summary: Update kitchen display configuration
 *     tags: [Display Settings]
 */
router.put("/config", async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const config = req.body;

    // FAIL-HARD: No Socket.IO only updates - requires database persistence
    res.status(503).json({
      error: "DATABASE_REQUIRED",
      message: "Config updates require database persistence. Socket.IO-only updates not allowed."
    });
  } catch (error) {
    console.error("Error updating display config:", error);
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to update display config" });
  }
});

/**
 * @swagger
 * /api/v1/restaurants/{restaurantId}/display/status:
 *   get:
 *     summary: Get current display status and metrics
 *     tags: [Display Settings]
 */
router.get("/status", async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    
    // FAIL-HARD: No mock status data - requires real database metrics
    res.status(503).json({
      error: "DATABASE_REQUIRED",
      message: "Display status requires real database metrics. No mock data provided."
    });
  } catch (error) {
    console.error("Error fetching display status:", error);
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch display status" });
  }
});

/**
 * @swagger
 * /api/v1/restaurants/{restaurantId}/display/test-alert:
 *   post:
 *     summary: Send test alert to kitchen displays
 *     tags: [Display Settings]
 */
router.post("/test-alert", async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const { message, level = "info" } = req.body;

    const testAlert = {
      type: "test_alert",
      level,
      message: message || "This is a test alert",
      timestamp: new Date().toISOString(),
      restaurant_id: restaurantId
    };

    // Send test alert via Socket.IO
    const io = req.app.get('io');
    io.to(`restaurant-${restaurantId}`).emit('test_alert', testAlert);

    res.json({
      success: true,
      alert_sent: testAlert
    });
  } catch (error) {
    console.error("Error sending test alert:", error);
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to send test alert" });
  }
});

/**
 * @swagger
 * /api/v1/restaurants/{restaurantId}/display/refresh:
 *   post:
 *     summary: Force refresh all kitchen displays
 *     tags: [Display Settings]
 */
router.post("/refresh", async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;

    // Send refresh command via Socket.IO
    const io = req.app.get('io');
    io.to(`restaurant-${restaurantId}`).emit('force_refresh', {
      restaurant_id: restaurantId,
      refresh_time: new Date().toISOString()
    });

    res.json({
      success: true,
      message: "Refresh command sent to all displays",
      restaurant_id: restaurantId
    });
  } catch (error) {
    console.error("Error sending refresh command:", error);
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to send refresh command" });
  }
});

export default router;