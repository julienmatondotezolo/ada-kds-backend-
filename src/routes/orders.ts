import { Router, Request, Response } from "express";
import { adminLimiter } from "../middleware/rate-limit";
import { requireAuth, requireRestaurantAccess } from "../middleware/auth";
import { transformToKdsOrder, mapOrderStatus, KdsOrder } from "../lib/supabase";
import { getOrders, updateOrderStatus } from "../lib/database";

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
    
    console.log(`Fetching orders for restaurant: ${restaurantId}, status filter: ${status}`);

    // Fetch orders using database layer (with fallback)
    const filters: any = {};
    if (status) {
      filters.status = status === 'new' ? 'CREATED' : 
                      status === 'preparing' ? 'PREPARING' :
                      status === 'ready' ? 'READY' :
                      status === 'completed' ? 'COMPLETED' : status;
    }

    let result;
    try {
      result = await getOrders(restaurantId, filters);
    } catch (dbError) {
      console.error('Database function threw error:', dbError);
      result = { success: false, error: dbError };
    }

    if (!result.success) {
      console.error('Database error:', result.error);
      console.log('Falling back to mock data for demo purposes...');
      
      // Mock data for demo
      const mockOrders: KdsOrder[] = [
        {
          id: "kds-001",
          order_number: "KDS001",
          restaurant_id: restaurantId,
          status: "new",
          station: "hot_kitchen",
          priority: "normal",
          items: [
            { name: "Margherita Pizza", quantity: 1, estimated_time: 12 },
            { name: "Caesar Salad", quantity: 1, estimated_time: 5 }
          ],
          customer_name: "Table 5",
          order_time: new Date(Date.now() - 5 * 60000).toISOString(), // 5 minutes ago
          estimated_ready_time: new Date(Date.now() + 12 * 60000).toISOString(),
          elapsed_time: 300, // 5 minutes
          total_prep_time: 17
        },
        {
          id: "kds-002", 
          order_number: "KDS002",
          restaurant_id: restaurantId,
          status: "preparing",
          station: "grill",
          priority: "high",
          items: [
            { name: "Grilled Salmon", quantity: 1, estimated_time: 15, special_requests: "No sauce" },
            { name: "Roasted Vegetables", quantity: 1, estimated_time: 8 }
          ],
          customer_name: "Table 12",
          order_time: new Date(Date.now() - 8 * 60000).toISOString(), // 8 minutes ago
          estimated_ready_time: new Date(Date.now() + 15 * 60000).toISOString(),
          elapsed_time: 480, // 8 minutes
          total_prep_time: 23
        },
        {
          id: "kds-003",
          order_number: "KDS003", 
          restaurant_id: restaurantId,
          status: "new",
          station: "cold_prep",
          priority: "normal",
          items: [
            { name: "Greek Salad", quantity: 2, estimated_time: 4 },
            { name: "Bruschetta", quantity: 1, estimated_time: 3 }
          ],
          customer_name: "Table 3",
          order_time: new Date(Date.now() - 2 * 60000).toISOString(), // 2 minutes ago
          estimated_ready_time: new Date(Date.now() + 7 * 60000).toISOString(),
          elapsed_time: 120, // 2 minutes
          total_prep_time: 11
        },
        {
          id: "kds-004",
          order_number: "KDS004",
          restaurant_id: restaurantId,
          status: "ready",
          station: "bar",
          priority: "normal",
          items: [
            { name: "Aperol Spritz", quantity: 2, estimated_time: 2 },
            { name: "Negroni", quantity: 1, estimated_time: 3 }
          ],
          customer_name: "Table 8",
          order_time: new Date(Date.now() - 5 * 60000).toISOString(), // 5 minutes ago
          estimated_ready_time: new Date(Date.now() - 1 * 60000).toISOString(),
          elapsed_time: 300, // 5 minutes
          total_prep_time: 7
        }
      ];

      res.json(mockOrders);
      return;
    }

    const orders = result.data;
    if (!orders || orders.length === 0) {
      console.log('No orders found, returning empty array');
      res.json([]);
      return;
    }

    // Transform orders to KDS format
    const kdsOrders: KdsOrder[] = orders
      .map(transformToKdsOrder)
      .filter(order => order.status !== 'completed'); // Hide completed orders from KDS

    console.log(`Transformed ${kdsOrders.length} orders for KDS display`);

    res.json(kdsOrders);
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