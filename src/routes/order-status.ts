import { Router, Request, Response } from "express";
import { publicLimiter } from "../middleware/rate-limit";
import { getOrderById } from "../lib/database";

const router = Router();

router.use(publicLimiter);

/**
 * @swagger
 * /api/v1/orders/{orderId}/status:
 *   get:
 *     summary: Get order status (public, no auth required)
 *     description: Used by QR code customers to track their order status in real-time.
 *     tags: [QR Code Integration]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: Order UUID returned when the order was placed
 *     responses:
 *       200:
 *         description: Current order status
 *       404:
 *         description: Order not found
 */
router.get("/:orderId/status", async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;

    const result = await getOrderById(orderId);

    if (!result.success || !result.data) {
      res.status(404).json({ error: "NOT_FOUND", message: "Order not found" });
      return;
    }

    const order = result.data;

    res.json({
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      customer_name: order.customer_name,
      items: order.items,
      estimated_ready_time: order.estimated_ready_time,
      created_at: order.created_at,
      updated_at: order.updated_at,
    });
  } catch (error) {
    console.error("Error fetching order status:", error);
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch order status" });
  }
});

export default router;
