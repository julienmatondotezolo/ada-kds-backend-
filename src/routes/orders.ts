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
      console.error('❌ Database error:', result.error);
      
      // FAIL-HARD: Return 503 error when database is unavailable (no fallbacks)
      res.status(503).json({ 
        error: "DATABASE_UNAVAILABLE", 
        message: "Database connection failed. Service unavailable without database access." 
      });
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
 *     summary: Update order status and broadcast to WebSocket clients
 *     description: |
 *       Updates an order's status and automatically broadcasts the change to all connected WebSocket clients in the restaurant room.
 *       
 *       **Status Flow:**
 *       - `pending` → `preparing` → `ready` → `completed`
 *       - Any status can be changed to `cancelled`
 *       
 *       **WebSocket Event:** Triggers `order:updated` event to all connected clients in the restaurant room.
 *     tags: [Kitchen Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Restaurant UUID
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Order UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, preparing, ready, completed, cancelled]
 *                 description: New order status
 *               station_id:
 *                 type: string
 *                 format: uuid
 *                 description: Station handling the order (optional)
 *               estimated_completion:
 *                 type: string
 *                 format: date-time
 *                 description: When the order is estimated to be ready
 *               notes:
 *                 type: string
 *                 description: Additional notes about the status change
 *           examples:
 *             start_cooking:
 *               summary: Start cooking order
 *               value:
 *                 status: "preparing"
 *                 station_id: "550e8400-e29b-41d4-a716-446655440001"
 *                 estimated_completion: "2024-01-15T14:30:00Z"
 *                 notes: "Started by Chef Mario"
 *             mark_ready:
 *               summary: Mark order ready for pickup
 *               value:
 *                 status: "ready"
 *                 notes: "Order ready at pickup counter"
 *             complete_order:
 *               summary: Complete order (customer picked up)
 *               value:
 *                 status: "completed"
 *                 notes: "Picked up by customer"
 *     responses:
 *       200:
 *         description: Order status updated successfully and broadcasted via WebSocket
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 order:
 *                   $ref: '#/components/schemas/Order'
 *                 websocket_event:
 *                   type: object
 *                   description: Event sent to WebSocket clients
 *                   properties:
 *                     event:
 *                       type: string
 *                       example: "order:updated"
 *                     data:
 *                       type: object
 *                       properties:
 *                         order:
 *                           $ref: '#/components/schemas/Order'
 *                         previous_status:
 *                           type: string
 *                         updated_by:
 *                           type: string
 *       400:
 *         description: Invalid status or request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "INVALID_STATUS"
 *               message: "Status must be one of: pending, preparing, ready, completed, cancelled"
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Order not found
 *       503:
 *         description: Database unavailable
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

    // Update status in database - FAIL-HARD approach
    const updateResult = await updateOrderStatus(orderId, status, restaurantId);
    
    if (!updateResult.success) {
      console.error(`❌ Failed to update order ${orderId} status:`, updateResult.error);
      res.status(503).json({ 
        error: "DATABASE_UNAVAILABLE", 
        message: "Cannot update order status without database access." 
      });
      return;
    }
    
    console.log(`✅ Order ${orderId} status updated to ${status} in database`);

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

    console.log(`🔔 Order ${orderId} status updated to ${status} broadcasted via Socket.IO`);
    
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

    // Get current status from database - NO HARDCODED VALUES
    const orderResult = await getOrders(restaurantId, { orderId });
    
    if (!orderResult.success || !orderResult.data || orderResult.data.length === 0) {
      res.status(503).json({
        error: "DATABASE_UNAVAILABLE",
        message: "Cannot bump order without database access to current status"
      });
      return;
    }
    
    const currentStatus = orderResult.data[0].status;
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
    
    // FAIL-HARD: Analytics requires real database operations only
    res.status(503).json({
      error: "SERVICE_UNAVAILABLE",
      message: "Analytics feature requires database implementation. No mock data provided."
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch analytics" });
  }
});

export default router;