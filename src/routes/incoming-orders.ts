import { Router, Request, Response } from "express";
import { publicLimiter } from "../middleware/rate-limit";
import { saveOrder } from "../lib/database";
import { v4 as uuidv4 } from 'uuid';

const router = Router({ mergeParams: true });

router.use(publicLimiter);

/**
 * @swagger
 * /api/v1/restaurants/{restaurantId}/orders/incoming:
 *   post:
 *     summary: Receive new order from external sources (phone, website, QR code)
 *     tags: [Incoming Orders]
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *         description: Restaurant ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               source:
 *                 type: string
 *                 enum: [phone_assistant, website, qr_code, pos_system]
 *                 description: Source of the order
 *               order_number:
 *                 type: string
 *                 description: Unique order number
 *               customer_name:
 *                 type: string
 *                 description: Customer name or table number
 *               customer_type:
 *                 type: string
 *                 enum: [dine_in, takeaway, delivery]
 *                 default: dine_in
 *               customer_phone:
 *                 type: string
 *                 description: Customer phone number (for takeaway/delivery)
 *               priority:
 *                 type: string
 *                 enum: [low, normal, high, urgent]
 *                 default: normal
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     quantity:
 *                       type: integer
 *                     special_requests:
 *                       type: string
 *                     category:
 *                       type: string
 *                     estimated_time:
 *                       type: integer
 *                       description: Estimated prep time in minutes
 *               special_instructions:
 *                 type: string
 *                 description: Overall order instructions
 *               requested_time:
 *                 type: string
 *                 format: date-time
 *                 description: When customer wants the order ready (for pre-orders)
 *           example:
 *             source: "phone_assistant"
 *             order_number: "PHONE001"
 *             customer_name: "Maria Rossi"
 *             customer_type: "takeaway"
 *             customer_phone: "+32 456 789 123"
 *             priority: "normal"
 *             items:
 *               - name: "Pizza Margherita"
 *                 quantity: 2
 *                 special_requests: "Extra basil, no oregano"
 *                 category: "pizza"
 *                 estimated_time: 12
 *               - name: "Tiramisu"
 *                 quantity: 1
 *                 special_requests: ""
 *                 category: "dessert"
 *                 estimated_time: 2
 *             special_instructions: "Customer is allergic to nuts"
 *     responses:
 *       201:
 *         description: Order successfully received and added to kitchen queue
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 order:
 *                   type: object
 *                 kds_display_time:
 *                   type: string
 *                   description: When order will appear on KDS
 *       400:
 *         description: Invalid order data
 */
router.post("/incoming", async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const {
      source,
      order_number,
      customer_name,
      customer_type = "dine_in",
      customer_phone,
      priority = "normal",
      items,
      special_instructions,
      requested_time
    } = req.body;

    // Validate required fields
    if (!source || !order_number || !customer_name || !items || items.length === 0) {
      res.status(400).json({
        error: "MISSING_REQUIRED_FIELDS",
        message: "Source, order_number, customer_name, and items are required"
      });
      return;
    }

    // Validate source
    const validSources = ["phone_assistant", "website", "qr_code", "pos_system"];
    if (!validSources.includes(source)) {
      res.status(400).json({
        error: "INVALID_SOURCE", 
        message: `Source must be one of: ${validSources.join(", ")}`
      });
      return;
    }

    // Calculate total estimated time and assign station
    let totalPrepTime = 0;
    let assignedStation = "hot_kitchen"; // Default station

    const processedItems = items.map((item: any) => {
      const estimatedTime = item.estimated_time || 10; // Default 10 minutes
      totalPrepTime = Math.max(totalPrepTime, estimatedTime);
      
      // Auto-assign station based on category
      if (item.category) {
        switch (item.category.toLowerCase()) {
          case 'salad':
          case 'cold_appetizers':
          case 'dessert':
          case 'desserts':
            assignedStation = "cold_prep";
            break;
          case 'grilled_meat':
          case 'grilled_fish':
          case 'grilled_vegetables':
          case 'grill':
            assignedStation = "grill";
            break;
          case 'drinks':
          case 'cocktails':
          case 'wine':
          case 'coffee':
            assignedStation = "bar";
            break;
          default:
            assignedStation = "hot_kitchen";
        }
      }

      return {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: item.name,
        quantity: item.quantity,
        special_requests: item.special_requests || "",
        estimated_time: estimatedTime,
        category: item.category || "main"
      };
    });

    // Determine rush level based on current time
    const currentHour = new Date().getHours();
    let rushLevel = "low";
    if ((currentHour >= 12 && currentHour <= 14) || (currentHour >= 18 && currentHour <= 21)) {
      rushLevel = "high";
    } else if (currentHour >= 11 && currentHour <= 22) {
      rushLevel = "moderate";
    }

    // Calculate ready time
    const orderTime = new Date();
    const readyTime = requested_time 
      ? new Date(requested_time)
      : new Date(orderTime.getTime() + (totalPrepTime * 60 * 1000));

    // Create order object
    const orderId = uuidv4();
    const newOrder = {
      id: orderId,
      order_number,
      restaurant_id: restaurantId,
      status: "new",
      station: assignedStation,
      priority,
      items: processedItems,
      customer_name,
      customer_type,
      customer_phone: customer_phone || "",
      order_time: orderTime.toISOString(),
      estimated_ready_time: readyTime.toISOString(),
      elapsed_time: 0,
      total_prep_time: totalPrepTime,
      rush_level: rushLevel,
      source,
      special_instructions: special_instructions || "",
      created_at: orderTime.toISOString(),
      updated_at: orderTime.toISOString()
    };

    // Save to database
    console.log(`📥 New order received from ${source}: ${order_number} for ${customer_name}`);
    
    const saveResult = await saveOrder(newOrder);
    if (!saveResult.success) {
      console.error('❌ Failed to save order to database:', saveResult.error);
      res.status(500).json({
        error: "DATABASE_ERROR",
        message: "Failed to save order to database. Order could not be processed."
      });
      return;
    }
    
    console.log(`✅ Order ${order_number} saved to database successfully`);

    // Real-time broadcast to KDS displays
    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant-${restaurantId}`).emit('new_order_received', {
        order: newOrder,
        source,
        timestamp: new Date().toISOString()
      });
      console.log(`🔔 Order broadcasted to KDS displays for restaurant ${restaurantId}`);
    }

    res.status(201).json({
      success: true,
      order: newOrder,
      kds_display_time: orderTime.toISOString(),
      message: `Order ${order_number} successfully added to kitchen queue`,
      station_assigned: assignedStation,
      estimated_ready_time: readyTime.toISOString()
    });

  } catch (error) {
    console.error("Error processing incoming order:", error);
    res.status(500).json({ 
      error: "SERVER_ERROR", 
      message: "Failed to process incoming order" 
    });
  }
});

/**
 * @swagger
 * /api/v1/restaurants/{restaurantId}/orders/bulk:
 *   post:
 *     summary: Receive multiple orders at once (for bulk imports)
 *     tags: [Incoming Orders]
 */
router.post("/bulk", async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const { orders, source = "bulk_import" } = req.body;

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      res.status(400).json({
        error: "INVALID_BULK_DATA",
        message: "Orders array is required and must not be empty"
      });
      return;
    }

    const processedOrders = [];
    const errors = [];

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      
      try {
        // Process each order similar to single order endpoint
        if (!order.order_number || !order.customer_name || !order.items) {
          errors.push({
            index: i,
            order_number: order.order_number || `ORDER_${i}`,
            error: "Missing required fields"
          });
          continue;
        }

        // Create processed order
        const orderId = uuidv4();
        const processedOrder = {
          id: orderId,
          order_number: order.order_number,
          restaurant_id: restaurantId,
          status: "new",
          station: "hot_kitchen",
          priority: order.priority || "normal",
          items: order.items,
          customer_name: order.customer_name,
          customer_type: order.customer_type || "dine_in",
          source: source,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          order_time: new Date().toISOString()
        };

        // Save to database
        const saveResult = await saveOrder(processedOrder);
        if (!saveResult.success) {
          errors.push({
            index: i,
            order_number: order.order_number || `ORDER_${i}`,
            error: "Database save failed: " + (saveResult.error?.message || "Unknown error")
          });
          continue;
        }

        processedOrders.push(processedOrder);

      } catch (error) {
        errors.push({
          index: i,
          order_number: order.order_number || `ORDER_${i}`,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    // Broadcast all successful orders
    const io = req.app.get('io');
    if (io && processedOrders.length > 0) {
      io.to(`restaurant-${restaurantId}`).emit('bulk_orders_received', {
        orders: processedOrders,
        count: processedOrders.length,
        source,
        timestamp: new Date().toISOString()
      });
    }

    res.status(201).json({
      success: true,
      processed: processedOrders.length,
      errors: errors.length,
      orders: processedOrders,
      failed_orders: errors
    });

  } catch (error) {
    console.error("Error processing bulk orders:", error);
    res.status(500).json({ 
      error: "SERVER_ERROR", 
      message: "Failed to process bulk orders" 
    });
  }
});

export default router;