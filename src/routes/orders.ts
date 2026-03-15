import { Router, Request, Response } from "express";
import { adminLimiter } from "../middleware/rate-limit";
import { requireAuth, requireRestaurantAccess } from "../middleware/auth";

const router = Router({ mergeParams: true });

router.use(adminLimiter);
// TODO: Uncomment when AdaAuth is working
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
 *     responses:
 *       200:
 *         description: List of active kitchen orders
 */
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const { status } = req.query;
    
    // Mock kitchen orders data
    const mockOrders = [
      {
        id: "order-1",
        order_number: "KDS001",
        restaurant_id: restaurantId,
        status: "preparing",
        station: "hot_kitchen",
        priority: "normal",
        items: [
          {
            name: "Margherita Pizza",
            quantity: 2,
            special_requests: "Extra basil, no oregano",
            estimated_time: 12
          },
          {
            name: "Spaghetti Carbonara", 
            quantity: 1,
            special_requests: "Extra parmesan",
            estimated_time: 8
          }
        ],
        customer_name: "Table 5",
        order_time: "2026-02-22T11:30:00Z",
        estimated_ready_time: "2026-02-22T11:42:00Z",
        elapsed_time: 720, // seconds
        total_prep_time: 12 // minutes
      },
      {
        id: "order-2",
        order_number: "KDS002",
        restaurant_id: restaurantId,
        status: "ready",
        station: "cold_prep",
        priority: "high",
        items: [
          {
            name: "Caesar Salad",
            quantity: 1,
            special_requests: "Dressing on the side",
            estimated_time: 5
          }
        ],
        customer_name: "Table 12",
        order_time: "2026-02-22T11:35:00Z",
        estimated_ready_time: "2026-02-22T11:40:00Z",
        elapsed_time: 300,
        total_prep_time: 5
      },
      {
        id: "order-3",
        order_number: "KDS003",
        restaurant_id: restaurantId,
        status: "new",
        station: "hot_kitchen",
        priority: "normal",
        items: [
          {
            name: "Osso Buco",
            quantity: 1,
            special_requests: "Medium rare",
            estimated_time: 25
          }
        ],
        customer_name: "Table 8",
        order_time: "2026-02-22T11:40:00Z",
        estimated_ready_time: "2026-02-22T12:05:00Z",
        elapsed_time: 60,
        total_prep_time: 25
      }
    ];

    // Filter by status if provided
    const filteredOrders = status 
      ? mockOrders.filter(order => order.status === status)
      : mockOrders;

    res.json(filteredOrders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch orders" });
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
    const { status, station } = req.body;

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
      updated_by: "kitchen_user" // TODO: Get from auth
    };

    // Real-time update via Socket.IO
    const io = req.app.get('io');
    io.to(`restaurant-${restaurantId}`).emit('order_status_updated', {
      order_id: orderId,
      new_status: status,
      updated_at: new Date().toISOString()
    });

    console.log(`Order ${orderId} status updated to ${status}`);
    
    res.json({
      success: true,
      order: updatedOrder
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to update order status" });
  }
});

/**
 * @swagger
 * /api/v1/restaurants/{restaurantId}/orders/{orderId}/bump:
 *   post:
 *     summary: Bump order (move to next status)
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

    const currentStatus = "preparing"; // TODO: Get from database
    const nextStatus = statusProgression[currentStatus as keyof typeof statusProgression];

    if (!nextStatus) {
      res.status(400).json({
        error: "CANNOT_BUMP",
        message: `Order with status '${currentStatus}' cannot be bumped further`
      });
      return;
    }

    // Real-time update
    const io = req.app.get('io');
    io.to(`restaurant-${restaurantId}`).emit('order_bumped', {
      order_id: orderId,
      old_status: currentStatus,
      new_status: nextStatus,
      bump_time: new Date().toISOString()
    });

    res.json({
      success: true,
      order_id: orderId,
      old_status: currentStatus,
      new_status: nextStatus
    });
  } catch (error) {
    console.error("Error bumping order:", error);
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to bump order" });
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
      current_orders: 8,
      average_prep_time: 14.5, // minutes
      orders_completed_today: 127,
      orders_pending: 3,
      orders_in_progress: 5,
      station_performance: [
        {
          station: "hot_kitchen",
          orders_completed: 85,
          average_time: 16.2,
          efficiency: 92
        },
        {
          station: "cold_prep", 
          orders_completed: 42,
          average_time: 7.8,
          efficiency: 98
        }
      ],
      peak_hours: [
        { hour: "12:00", orders: 24 },
        { hour: "13:00", orders: 31 },
        { hour: "19:00", orders: 28 }
      ]
    };

    res.json(mockAnalytics);
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch analytics" });
  }
});

export default router;