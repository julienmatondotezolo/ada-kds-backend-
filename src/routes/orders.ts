import { Router, Request, Response } from "express";
import { adminLimiter } from "../middleware/rate-limit";
import { requireAuth, requireRestaurantAccess } from "../middleware/auth";

const router = Router({ mergeParams: true });

router.use(adminLimiter);
// TODO: Uncomment when AdaAuth is fully integrated
// router.use(requireAuth);
// router.use(requireRestaurantAccess);

/**
 * @swagger
 * /api/v1/restaurants/{restaurantId}/orders:
 *   get:
 *     summary: Get active orders for kitchen display
 *     tags: [Kitchen Orders]
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *         description: Restaurant ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [new, preparing, ready, completed]
 *         description: Filter orders by status
 *       - in: query
 *         name: station
 *         schema:
 *           type: string
 *         description: Filter orders by station
 *     responses:
 *       200:
 *         description: List of active kitchen orders
 */
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const { status, station } = req.query;
    
    // Enhanced mock data for realistic KDS demo
    const mockOrders = [
      {
        id: "order-001",
        order_number: "KDS001",
        restaurant_id: restaurantId,
        status: "preparing",
        station: "hot_kitchen",
        priority: "normal",
        items: [
          {
            id: "item-1",
            name: "Pizza Margherita",
            quantity: 2,
            special_requests: "Extra basil, no oregano",
            estimated_time: 12,
            category: "pizza"
          },
          {
            id: "item-2", 
            name: "Spaghetti Carbonara",
            quantity: 1,
            special_requests: "Extra parmesan cheese",
            estimated_time: 8,
            category: "pasta"
          }
        ],
        customer_name: "Table 5",
        customer_type: "dine_in",
        order_time: "2026-03-15T11:30:00Z",
        estimated_ready_time: "2026-03-15T11:42:00Z",
        elapsed_time: 1440, // 24 minutes in seconds
        total_prep_time: 12, // minutes
        rush_level: "moderate",
        created_at: "2026-03-15T11:30:00Z",
        updated_at: "2026-03-15T11:42:00Z"
      },
      {
        id: "order-002", 
        order_number: "KDS002",
        restaurant_id: restaurantId,
        status: "ready",
        station: "cold_prep",
        priority: "high",
        items: [
          {
            id: "item-3",
            name: "Caesar Salad",
            quantity: 1,
            special_requests: "Dressing on the side, no croutons",
            estimated_time: 5,
            category: "salad"
          },
          {
            id: "item-4",
            name: "Bruschetta",
            quantity: 3,
            special_requests: "",
            estimated_time: 3,
            category: "appetizer"
          }
        ],
        customer_name: "Table 12", 
        customer_type: "dine_in",
        order_time: "2026-03-15T11:35:00Z",
        estimated_ready_time: "2026-03-15T11:40:00Z",
        elapsed_time: 900, // 15 minutes
        total_prep_time: 5,
        rush_level: "high",
        created_at: "2026-03-15T11:35:00Z",
        updated_at: "2026-03-15T11:40:00Z"
      },
      {
        id: "order-003",
        order_number: "KDS003",
        restaurant_id: restaurantId,
        status: "new",
        station: "hot_kitchen",
        priority: "urgent",
        items: [
          {
            id: "item-5",
            name: "Osso Buco alla Milanese",
            quantity: 1,
            special_requests: "Medium rare, extra sauce",
            estimated_time: 25,
            category: "meat"
          }
        ],
        customer_name: "Table 8",
        customer_type: "dine_in", 
        order_time: "2026-03-15T11:40:00Z",
        estimated_ready_time: "2026-03-15T12:05:00Z",
        elapsed_time: 300, // 5 minutes
        total_prep_time: 25,
        rush_level: "urgent",
        created_at: "2026-03-15T11:40:00Z",
        updated_at: "2026-03-15T11:40:00Z"
      },
      {
        id: "order-004",
        order_number: "TAKE001",
        restaurant_id: restaurantId,
        status: "preparing",
        station: "bar",
        priority: "normal",
        items: [
          {
            id: "item-6",
            name: "Aperol Spritz",
            quantity: 2,
            special_requests: "Light ice",
            estimated_time: 3,
            category: "cocktail"
          },
          {
            id: "item-7",
            name: "Limoncello",
            quantity: 1,
            special_requests: "",
            estimated_time: 1,
            category: "digestif"
          }
        ],
        customer_name: "Takeaway - Maria",
        customer_type: "takeaway",
        order_time: "2026-03-15T11:45:00Z", 
        estimated_ready_time: "2026-03-15T11:48:00Z",
        elapsed_time: 180, // 3 minutes
        total_prep_time: 3,
        rush_level: "low",
        created_at: "2026-03-15T11:45:00Z",
        updated_at: "2026-03-15T11:45:00Z"
      }
    ];

    // Apply filters
    let filteredOrders = mockOrders;
    
    if (status) {
      filteredOrders = filteredOrders.filter(order => order.status === status);
    }
    
    if (station) {
      filteredOrders = filteredOrders.filter(order => order.station === station);
    }

    res.json({
      success: true,
      orders: filteredOrders,
      total: filteredOrders.length,
      filters: { status, station },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ 
      error: "SERVER_ERROR", 
      message: "Failed to fetch orders" 
    });
  }
});

/**
 * @swagger
 * /api/v1/restaurants/{restaurantId}/orders/{orderId}/status:
 *   put:
 *     summary: Update order status (new → preparing → ready → completed)
 *     tags: [Kitchen Orders]
 */
router.put("/:orderId/status", async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId, orderId } = req.params;
    const { status, station, userId } = req.body;

    const validStatuses = ["new", "preparing", "ready", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        error: "INVALID_STATUS",
        message: `Status must be one of: ${validStatuses.join(", ")}`
      });
      return;
    }

    const updatedOrder = {
      id: orderId,
      restaurant_id: restaurantId,
      status,
      station,
      updated_at: new Date().toISOString(),
      updated_by: userId || "kitchen_user"
    };

    // Real-time update via Socket.IO
    const io = req.app.get('io');
    io.to(`restaurant-${restaurantId}`).emit('order_status_updated', {
      order_id: orderId,
      old_status: req.body.old_status || "unknown",
      new_status: status,
      updated_at: new Date().toISOString(),
      restaurant_id: restaurantId
    });

    console.log(`📝 Order ${orderId} status: ${req.body.old_status || "unknown"} → ${status}`);
    
    res.json({
      success: true,
      order: updatedOrder
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ 
      error: "SERVER_ERROR", 
      message: "Failed to update order status" 
    });
  }
});

/**
 * @swagger
 * /api/v1/restaurants/{restaurantId}/orders/{orderId}/bump:
 *   post:
 *     summary: Bump order to next status (new → preparing → ready → completed)
 *     tags: [Kitchen Orders]
 */
router.post("/:orderId/bump", async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId, orderId } = req.params;
    
    // Status progression logic
    const statusProgression = {
      "new": "preparing",
      "preparing": "ready", 
      "ready": "completed"
    };

    // Mock current status - in real implementation, fetch from database
    const currentStatus = req.body.current_status || "preparing";
    const nextStatus = statusProgression[currentStatus as keyof typeof statusProgression];

    if (!nextStatus) {
      res.status(400).json({
        error: "CANNOT_BUMP",
        message: `Order with status '${currentStatus}' cannot be bumped further`
      });
      return;
    }

    // Real-time update via Socket.IO
    const io = req.app.get('io');
    io.to(`restaurant-${restaurantId}`).emit('order_bumped', {
      order_id: orderId,
      old_status: currentStatus,
      new_status: nextStatus,
      bump_time: new Date().toISOString(),
      restaurant_id: restaurantId
    });

    console.log(`⬆️ Order ${orderId} bumped: ${currentStatus} → ${nextStatus}`);

    res.json({
      success: true,
      order_id: orderId,
      old_status: currentStatus,
      new_status: nextStatus,
      bumped_at: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error bumping order:", error);
    res.status(500).json({ 
      error: "SERVER_ERROR", 
      message: "Failed to bump order" 
    });
  }
});

/**
 * @swagger
 * /api/v1/restaurants/{restaurantId}/orders/analytics:
 *   get:
 *     summary: Get kitchen performance analytics
 *     tags: [Kitchen Orders]
 */
router.get("/analytics", async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    
    const mockAnalytics = {
      restaurant_id: restaurantId,
      current_orders: 12,
      orders_in_queue: 4,
      orders_preparing: 6,
      orders_ready: 2,
      average_prep_time: 14.5, // minutes
      orders_completed_today: 147,
      orders_pending: 4,
      orders_in_progress: 8,
      rush_level: "moderate", // low, moderate, high, extreme
      station_performance: [
        {
          station: "hot_kitchen",
          orders_completed: 95,
          orders_active: 5,
          average_time: 16.2,
          efficiency: 92,
          capacity_used: 62.5
        },
        {
          station: "cold_prep", 
          orders_completed: 52,
          orders_active: 2,
          average_time: 7.8,
          efficiency: 98,
          capacity_used: 33.3
        },
        {
          station: "bar",
          orders_completed: 73,
          orders_active: 3,
          average_time: 4.2,
          efficiency: 95,
          capacity_used: 30.0
        }
      ],
      peak_hours: [
        { hour: "12:00", orders: 28 },
        { hour: "13:00", orders: 35 },
        { hour: "19:00", orders: 31 },
        { hour: "20:00", orders: 26 }
      ],
      current_date: new Date().toISOString().split('T')[0],
      last_updated: new Date().toISOString()
    };

    res.json(mockAnalytics);
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ 
      error: "SERVER_ERROR", 
      message: "Failed to fetch analytics" 
    });
  }
});

export default router;