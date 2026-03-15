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
    
    const mockDisplayConfig = {
      restaurant_id: restaurantId,
      theme: "dark",
      refresh_interval: 30, // seconds
      auto_bump_ready_orders: true,
      auto_bump_delay: 300, // seconds (5 minutes)
      show_order_times: true,
      show_customer_info: true,
      show_special_requests: true,
      sound_enabled: true,
      sound_volume: 0.7,
      notification_sounds: {
        new_order: "ding",
        order_ready: "bell",
        order_overdue: "alert"
      },
      display_columns: 4,
      max_orders_per_column: 8,
      station_colors: {
        "hot_kitchen": "#FF6B6B",
        "cold_prep": "#4ECDC4", 
        "grill": "#FFD93D",
        "bar": "#6BCF7F"
      },
      priority_colors: {
        "low": "#9CA3AF",
        "normal": "#3B82F6",
        "high": "#F59E0B",
        "urgent": "#EF4444"
      },
      time_warnings: {
        yellow_threshold: 0.8, // 80% of estimated time
        red_threshold: 1.1     // 110% of estimated time (overdue)
      }
    };

    res.json(mockDisplayConfig);
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

    console.log(`Display config updated for restaurant ${restaurantId}:`, config);

    // Real-time config update via Socket.IO
    const io = req.app.get('io');
    io.to(`restaurant-${restaurantId}`).emit('display_config_updated', {
      restaurant_id: restaurantId,
      config,
      updated_at: new Date().toISOString()
    });

    res.json({
      success: true,
      restaurant_id: restaurantId,
      config,
      updated_at: new Date().toISOString()
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
    
    const mockDisplayStatus = {
      restaurant_id: restaurantId,
      displays_connected: 2,
      last_update: new Date().toISOString(),
      system_status: "healthy",
      active_orders: 8,
      overdue_orders: 1,
      stations_active: 4,
      average_order_time: 14.5,
      current_rush_level: "moderate", // low, moderate, high, extreme
      display_performance: {
        uptime: 99.8,
        last_restart: "2026-02-21T08:30:00Z",
        memory_usage: 45.2,
        cpu_usage: 12.1
      },
      alerts: [
        {
          level: "warning",
          message: "Order KDS001 is 2 minutes overdue",
          timestamp: "2026-02-22T12:45:00Z"
        }
      ]
    };

    res.json(mockDisplayStatus);
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