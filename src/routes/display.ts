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
      show_item_quantities: true,
      sound_enabled: true,
      sound_volume: 0.7,
      notification_sounds: {
        new_order: "ding",
        order_ready: "bell",
        order_overdue: "alert",
        order_cancelled: "whoosh"
      },
      display_layout: {
        columns: 4,
        max_orders_per_column: 8,
        card_size: "medium", // small, medium, large
        show_station_headers: true,
        compact_mode: false
      },
      station_colors: {
        "hot_kitchen": "#FF6B6B",
        "cold_prep": "#4ECDC4", 
        "grill": "#FFD93D",
        "bar": "#6BCF7F",
        "default": "#6B7280"
      },
      priority_colors: {
        "low": "#9CA3AF",
        "normal": "#3B82F6",
        "high": "#F59E0B",
        "urgent": "#EF4444"
      },
      status_colors: {
        "new": "#10B981",
        "preparing": "#F59E0B", 
        "ready": "#EF4444",
        "completed": "#6B7280"
      },
      time_warnings: {
        yellow_threshold: 0.8, // 80% of estimated time
        red_threshold: 1.1,    // 110% of estimated time (overdue)
        critical_threshold: 1.5 // 150% of estimated time (critical)
      },
      filters: {
        hide_completed: true,
        hide_cancelled: true,
        group_by_station: true,
        sort_by: "order_time" // order_time, priority, estimated_time
      },
      created_at: "2026-02-22T10:00:00Z",
      updated_at: new Date().toISOString()
    };

    res.json({
      success: true,
      config: mockDisplayConfig
    });
  } catch (error) {
    console.error("Error fetching display config:", error);
    res.status(500).json({ 
      error: "SERVER_ERROR", 
      message: "Failed to fetch display config" 
    });
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

    const updatedConfig = {
      restaurant_id: restaurantId,
      ...config,
      updated_at: new Date().toISOString()
    };

    console.log(`🖥️ Display config updated for restaurant ${restaurantId}`);

    // Real-time config update via Socket.IO
    const io = req.app.get('io');
    io.to(`restaurant-${restaurantId}`).emit('display_config_updated', {
      restaurant_id: restaurantId,
      config: updatedConfig,
      updated_at: new Date().toISOString()
    });

    res.json({
      success: true,
      config: updatedConfig
    });
  } catch (error) {
    console.error("Error updating display config:", error);
    res.status(500).json({ 
      error: "SERVER_ERROR", 
      message: "Failed to update display config" 
    });
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
      displays_connected: 3,
      last_update: new Date().toISOString(),
      system_status: "healthy",
      active_orders: 12,
      overdue_orders: 2,
      stations_active: 4,
      average_order_time: 14.5,
      current_rush_level: "moderate", // low, moderate, high, extreme
      peak_time_active: false,
      display_performance: {
        uptime: 99.8,
        last_restart: "2026-03-14T08:30:00Z",
        memory_usage: 45.2,
        cpu_usage: 12.1,
        websocket_connections: 3,
        api_response_time: 125 // milliseconds
      },
      station_status: [
        {
          station: "hot_kitchen",
          load_percentage: 75.0,
          orders_active: 6,
          avg_wait_time: 16.2,
          status: "busy"
        },
        {
          station: "cold_prep",
          load_percentage: 33.3,
          orders_active: 2,
          avg_wait_time: 7.8,
          status: "normal"
        },
        {
          station: "bar",
          load_percentage: 30.0,
          orders_active: 3,
          avg_wait_time: 4.2,
          status: "normal"
        }
      ],
      alerts: [
        {
          id: "alert-1",
          level: "warning",
          type: "order_overdue",
          message: "Order KDS001 is 3 minutes overdue",
          order_id: "order-001",
          timestamp: "2026-03-15T11:45:00Z"
        },
        {
          id: "alert-2", 
          level: "info",
          type: "station_busy",
          message: "Hot Kitchen is at 75% capacity",
          station: "hot_kitchen",
          timestamp: "2026-03-15T11:50:00Z"
        }
      ],
      last_order_time: "2026-03-15T11:45:00Z",
      next_estimated_order: "2026-03-15T11:58:00Z"
    };

    res.json({
      success: true,
      status: mockDisplayStatus
    });
  } catch (error) {
    console.error("Error fetching display status:", error);
    res.status(500).json({ 
      error: "SERVER_ERROR", 
      message: "Failed to fetch display status" 
    });
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
    const { message, level = "info", type = "test" } = req.body;

    const testAlert = {
      id: `alert-test-${Date.now()}`,
      type,
      level,
      message: message || "This is a test alert from AdaKDS",
      timestamp: new Date().toISOString(),
      restaurant_id: restaurantId,
      auto_dismiss: 5000 // 5 seconds
    };

    // Send test alert via Socket.IO
    const io = req.app.get('io');
    io.to(`restaurant-${restaurantId}`).emit('test_alert', testAlert);

    console.log(`🚨 Test alert sent to restaurant ${restaurantId}: ${testAlert.message}`);

    res.json({
      success: true,
      alert: testAlert
    });
  } catch (error) {
    console.error("Error sending test alert:", error);
    res.status(500).json({ 
      error: "SERVER_ERROR", 
      message: "Failed to send test alert" 
    });
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

    const refreshCommand = {
      type: "force_refresh",
      restaurant_id: restaurantId,
      refresh_time: new Date().toISOString(),
      reason: "Manual refresh requested"
    };

    // Send refresh command via Socket.IO
    const io = req.app.get('io');
    io.to(`restaurant-${restaurantId}`).emit('force_refresh', refreshCommand);

    console.log(`🔄 Refresh command sent to all displays for restaurant ${restaurantId}`);

    res.json({
      success: true,
      message: "Refresh command sent to all displays",
      refresh: refreshCommand
    });
  } catch (error) {
    console.error("Error sending refresh command:", error);
    res.status(500).json({ 
      error: "SERVER_ERROR", 
      message: "Failed to send refresh command" 
    });
  }
});

/**
 * @swagger
 * /api/v1/restaurants/{restaurantId}/display/notifications:
 *   post:
 *     summary: Send custom notification to kitchen displays
 *     tags: [Display Settings]
 */
router.post("/notifications", async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const { title, message, type = "info", duration = 5000, sound = true } = req.body;

    if (!title && !message) {
      res.status(400).json({
        error: "MISSING_CONTENT",
        message: "Either title or message is required"
      });
      return;
    }

    const notification = {
      id: `notification-${Date.now()}`,
      restaurant_id: restaurantId,
      title,
      message, 
      type, // info, success, warning, error
      duration,
      sound,
      timestamp: new Date().toISOString()
    };

    // Send notification via Socket.IO
    const io = req.app.get('io');
    io.to(`restaurant-${restaurantId}`).emit('display_notification', notification);

    console.log(`📢 Notification sent to restaurant ${restaurantId}: ${title || message}`);

    res.json({
      success: true,
      notification
    });
  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).json({ 
      error: "SERVER_ERROR", 
      message: "Failed to send notification" 
    });
  }
});

export default router;