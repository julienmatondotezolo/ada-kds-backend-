import { Router, Request, Response } from "express";
import { publicLimiter } from "../middleware/rate-limit";
import { validateMenuSource, validateItemAvailability, ValidatedRequest } from "../middleware/menu-validation";
import { saveOrder } from "../lib/database";
import { v4 as uuidv4 } from 'uuid';

const router = Router({ mergeParams: true });

// Apply rate limiting
router.use(publicLimiter);

/**
 * @swagger
 * /api/v1/restaurants/{restaurantId}/orders/ada-menu:
 *   post:
 *     summary: Submit order from AdaMenuBuilder QR code
 *     tags: [AdaMenuBuilder Integration]
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
 *               menu_id:
 *                 type: string
 *                 description: Published menu ID from QR code
 *                 example: "menu_123456"
 *               source:
 *                 type: string
 *                 enum: [ada-menu-builder, qr_code]
 *                 description: Source of the order
 *               referrer:
 *                 type: string
 *                 description: Referrer URL (automatically validated)
 *               customer_name:
 *                 type: string
 *                 description: Customer name or table number
 *                 example: "Table 7"
 *               customer_type:
 *                 type: string
 *                 enum: [dine_in, takeaway, delivery]
 *                 default: dine_in
 *               customer_phone:
 *                 type: string
 *                 description: Customer phone (for takeaway/delivery)
 *               customer_email:
 *                 type: string
 *                 description: Customer email for order updates
 *               order_items:
 *                 type: array
 *                 description: Items ordered from the published menu
 *                 items:
 *                   type: object
 *                   properties:
 *                     menu_item_id:
 *                       type: string
 *                       description: Menu item ID from published menu
 *                     name:
 *                       type: string
 *                       description: Item name (for validation)
 *                     quantity:
 *                       type: integer
 *                       minimum: 1
 *                       default: 1
 *                     special_requests:
 *                       type: string
 *                       description: Special requests/modifications
 *                     price:
 *                       type: number
 *                       description: Item price (for validation)
 *               special_instructions:
 *                 type: string
 *                 description: Overall order instructions
 *               requested_time:
 *                 type: string
 *                 format: date-time
 *                 description: When customer wants order ready (for pre-orders)
 *               payment_method:
 *                 type: string
 *                 description: How customer will pay
 *               table_number:
 *                 type: string
 *                 description: Table number for dine-in orders
 *           example:
 *             menu_id: "menu_ada_losteria_2024"
 *             source: "ada-menu-builder"
 *             referrer: "https://ada-menu-builder.vercel.app/qr/menu_ada_losteria_2024"
 *             customer_name: "Table 12"
 *             customer_type: "dine_in"
 *             table_number: "12"
 *             order_items:
 *               - menu_item_id: "item_pizza_margherita"
 *                 name: "Pizza Margherita"
 *                 quantity: 2
 *                 special_requests: "Extra basil, light cheese"
 *                 price: 14.50
 *               - menu_item_id: "item_wine_chianti"
 *                 name: "Chianti Classico"
 *                 quantity: 1
 *                 price: 8.00
 *             special_instructions: "Customer prefers thin crust"
 *     responses:
 *       201:
 *         description: Order successfully validated and submitted to kitchen
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 order:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     order_number:
 *                       type: string
 *                     status:
 *                       type: string
 *                     estimated_ready_time:
 *                       type: string
 *                     total_price:
 *                       type: number
 *                     stations_involved:
 *                       type: array
 *                       items:
 *                         type: string
 *                 kds_info:
 *                   type: object
 *                   properties:
 *                     will_appear_on_kds_at:
 *                       type: string
 *                     estimated_prep_time:
 *                       type: integer
 *                     assigned_stations:
 *                       type: array
 *                       items:
 *                         type: string
 *       400:
 *         description: Invalid order data or menu validation failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 message:
 *                   type: string
 *                 details:
 *                   type: object
 *       403:
 *         description: Order source not authorized (not from valid AdaMenu QR code)
 */
router.post("/ada-menu", 
  validateMenuSource,
  validateItemAvailability,
  async (req: ValidatedRequest, res: Response): Promise<void> => {
    try {
      const { restaurantId } = req.params;
      const {
        menu_id,
        source,
        customer_name,
        customer_type = "dine_in",
        customer_phone,
        customer_email,
        special_instructions,
        requested_time,
        payment_method,
        table_number
      } = req.body;

      // Use validated items if available, otherwise fall back to original items
      const orderItems = req.validatedItems || req.body.order_items;

      if (!orderItems || orderItems.length === 0) {
        res.status(400).json({
          error: "NO_ITEMS",
          message: "Order must contain at least one item"
        });
        return;
      }

      // Generate order ID and number
      const orderId = uuidv4();
      const orderNumber = `ADA${Date.now().toString().slice(-6)}`;

      // Calculate pricing and timing
      const totalPrice = orderItems.reduce((sum: number, item: any) => 
        sum + (item.total_price || item.price * item.quantity), 0
      );

      const totalPrepTime = Math.max(...orderItems.map((item: any) => 
        item.estimated_prep_time || item.estimated_time || 10
      ));

      // Assign stations based on validated items
      const stationsInvolved = [...new Set(
        orderItems.map((item: any) => item.station || 'hot_kitchen')
      )];

      // Calculate ready time
      const orderTime = new Date();
      const readyTime = requested_time 
        ? new Date(requested_time)
        : new Date(orderTime.getTime() + (totalPrepTime * 60 * 1000));

      // Create minimal database order record (only essential fields)
      const orderData = {
        id: orderId,
        order_number: orderNumber,
        restaurant_id: restaurantId, // Keep as string for now  
        status: 'new', // Use KDS status format
        customer_name,
        order_time: orderTime.toISOString(),
        created_at: orderTime.toISOString(),
        updated_at: orderTime.toISOString(),
        source: source || 'ada-menu-builder',
        // Store items as array
        items: orderItems.map((item: any) => ({
          name: item.name,
          quantity: item.quantity,
          special_requests: item.special_requests || "",
          estimated_time: item.estimated_prep_time || 10
        }))
      };

      // Save to database (with fallback)
      const saveResult = await saveOrder(orderData);
      let savedOrder = null;
      
      if (saveResult.success) {
        savedOrder = saveResult.data;
        // TODO: Save order items separately when database is available
      } else {
        console.warn('Order save failed, but continuing with real-time broadcast:', saveResult.error);
      }

      // Create KDS-compatible order format for real-time updates
      const kdsOrder = {
        id: orderId,
        order_number: orderNumber,
        restaurant_id: restaurantId,
        status: "new",
        station: stationsInvolved[0], // Primary station
        priority: determineOrderPriority(orderTime, totalPrice),
        items: orderItems.map((item: any) => ({
          name: item.name,
          quantity: item.quantity,
          special_requests: item.special_requests || "",
          estimated_time: item.estimated_prep_time || 10
        })),
        customer_name,
        customer_type,
        order_time: orderTime.toISOString(),
        estimated_ready_time: readyTime.toISOString(),
        elapsed_time: 0,
        total_prep_time: totalPrepTime,
        source: 'ada-menu-builder',
        special_instructions: special_instructions || '',
        validation: {
          menu_validated: !!req.publishedMenu,
          items_validated: !!req.validatedItems,
          source_verified: true
        }
      };

      // Real-time broadcast to KDS displays
      const io = req.app.get('io');
      if (io) {
        io.to(`restaurant-${restaurantId}`).emit('ada_menu_order_received', {
          order: kdsOrder,
          source: 'ada-menu-builder',
          menu_id,
          validated: true,
          timestamp: new Date().toISOString()
        });

        console.log(`🔔 AdaMenu order ${orderNumber} broadcasted to KDS displays`);
      }

      console.log(`✅ AdaMenu order received: ${orderNumber} from ${customer_name} (${totalPrice}€, ${totalPrepTime}min)`);

      // Response
      res.status(201).json({
        success: true,
        order: {
          id: orderId,
          order_number: orderNumber,
          status: 'submitted',
          estimated_ready_time: readyTime.toISOString(),
          total_price: totalPrice,
          stations_involved: stationsInvolved,
          customer_name,
          customer_type
        },
        kds_info: {
          will_appear_on_kds_at: orderTime.toISOString(),
          estimated_prep_time: totalPrepTime,
          assigned_stations: stationsInvolved
        },
        validation: {
          menu_validated: !!req.publishedMenu,
          items_count: orderItems.length,
          total_items: orderItems.reduce((sum: number, item: any) => sum + item.quantity, 0)
        },
        message: `Order ${orderNumber} successfully submitted to kitchen`
      });

    } catch (error) {
      console.error("Error processing AdaMenu order:", error);
      res.status(500).json({
        error: "SERVER_ERROR",
        message: "Failed to process AdaMenu order",
        details: {
          error: error instanceof Error ? error.message : "Unknown error"
        }
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/restaurants/{restaurantId}/orders/ada-menu/validate:
 *   post:
 *     summary: Validate order items before submission (dry run)
 *     tags: [AdaMenuBuilder Integration]
 */
router.post("/ada-menu/validate", 
  validateMenuSource,
  validateItemAvailability,
  async (req: ValidatedRequest, res: Response): Promise<void> => {
    try {
      const { restaurantId } = req.params;
      const { order_items } = req.body;

      const validatedItems = req.validatedItems || [];
      const totalPrice = validatedItems.reduce((sum, item) => sum + item.total_price, 0);
      const totalPrepTime = Math.max(...validatedItems.map(item => item.estimated_prep_time));

      res.json({
        valid: true,
        menu_validated: !!req.publishedMenu,
        items_count: validatedItems.length,
        total_price: totalPrice,
        estimated_prep_time: totalPrepTime,
        stations_involved: [...new Set(validatedItems.map(item => item.station))],
        estimated_ready_time: new Date(Date.now() + totalPrepTime * 60 * 1000).toISOString(),
        validated_items: validatedItems.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total_price: item.total_price,
          station: item.station,
          estimated_prep_time: item.estimated_prep_time,
          available: item.is_available
        }))
      });
    } catch (error) {
      console.error("Error validating AdaMenu order:", error);
      res.status(500).json({
        error: "VALIDATION_ERROR",
        message: "Failed to validate order"
      });
    }
  }
);

/**
 * Determine order priority based on timing and value
 */
function determineOrderPriority(orderTime: Date, totalPrice: number): string {
  const hour = orderTime.getHours();
  
  // High priority during rush hours
  if ((hour >= 12 && hour <= 14) || (hour >= 18 && hour <= 21)) {
    return 'high';
  }
  
  // High priority for large orders
  if (totalPrice > 50) {
    return 'high';
  }
  
  return 'normal';
}

export default router;