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
 * /api/v1/restaurants/{restaurantId}/stations:
 *   get:
 *     summary: Get kitchen stations configuration
 *     tags: [Kitchen Stations]
 */
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    
    const mockStations = [
      {
        id: "station-hot",
        restaurant_id: restaurantId,
        name: "Hot Kitchen",
        code: "hot_kitchen",
        description: "Main cooking station for hot dishes",
        color: "#FF6B6B",
        display_order: 1,
        active: true,
        estimated_capacity: 8,
        current_load: 5,
        categories: ["pizza", "pasta", "meat", "hot_appetizers"],
        created_at: "2026-02-22T10:00:00Z",
        updated_at: "2026-03-15T10:00:00Z"
      },
      {
        id: "station-cold", 
        restaurant_id: restaurantId,
        name: "Cold Prep",
        code: "cold_prep",
        description: "Cold dishes and salad preparation",
        color: "#4ECDC4",
        display_order: 2,
        active: true,
        estimated_capacity: 6,
        current_load: 2,
        categories: ["salad", "cold_appetizers", "desserts"],
        created_at: "2026-02-22T10:00:00Z",
        updated_at: "2026-03-15T10:00:00Z"
      },
      {
        id: "station-grill",
        restaurant_id: restaurantId,
        name: "Grill Station",
        code: "grill",
        description: "Grilled meats and vegetables",
        color: "#FFD93D",
        display_order: 3,
        active: true,
        estimated_capacity: 4,
        current_load: 3,
        categories: ["grilled_meat", "grilled_fish", "grilled_vegetables"],
        created_at: "2026-02-22T10:00:00Z",
        updated_at: "2026-03-15T10:00:00Z"
      },
      {
        id: "station-bar",
        restaurant_id: restaurantId,
        name: "Bar",
        code: "bar",
        description: "Drinks and beverages",
        color: "#6BCF7F",
        display_order: 4,
        active: true,
        estimated_capacity: 10,
        current_load: 3,
        categories: ["drinks", "cocktails", "wine", "coffee"],
        created_at: "2026-02-22T10:00:00Z",
        updated_at: "2026-03-15T10:00:00Z"
      }
    ];

    res.json({
      success: true,
      stations: mockStations,
      total: mockStations.length,
      restaurant_id: restaurantId
    });
  } catch (error) {
    console.error("Error fetching stations:", error);
    res.status(500).json({ 
      error: "SERVER_ERROR", 
      message: "Failed to fetch stations" 
    });
  }
});

/**
 * @swagger
 * /api/v1/restaurants/{restaurantId}/stations:
 *   post:
 *     summary: Create new kitchen station
 *     tags: [Kitchen Stations]
 */
router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const { name, code, description, color, estimated_capacity, categories } = req.body;

    if (!name || !code) {
      res.status(400).json({
        error: "MISSING_FIELDS",
        message: "Name and code are required fields"
      });
      return;
    }

    const newStation = {
      id: `station-${Date.now()}`,
      restaurant_id: restaurantId,
      name,
      code,
      description: description || "",
      color: color || "#6B7280",
      estimated_capacity: estimated_capacity || 5,
      current_load: 0,
      categories: categories || [],
      active: true,
      display_order: 99,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Real-time update via Socket.IO
    const io = req.app.get('io');
    io.to(`restaurant-${restaurantId}`).emit('station_created', {
      station: newStation,
      restaurant_id: restaurantId
    });

    console.log(`🏢 New station created: ${newStation.name} (${newStation.code})`);
    
    res.status(201).json({
      success: true,
      station: newStation
    });
  } catch (error) {
    console.error("Error creating station:", error);
    res.status(500).json({ 
      error: "SERVER_ERROR", 
      message: "Failed to create station" 
    });
  }
});

/**
 * @swagger
 * /api/v1/restaurants/{restaurantId}/stations/{stationId}:
 *   put:
 *     summary: Update kitchen station
 *     tags: [Kitchen Stations]
 */
router.put("/:stationId", async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId, stationId } = req.params;
    const updates = req.body;

    const updatedStation = {
      id: stationId,
      restaurant_id: restaurantId,
      ...updates,
      updated_at: new Date().toISOString()
    };

    // Real-time update via Socket.IO
    const io = req.app.get('io');
    io.to(`restaurant-${restaurantId}`).emit('station_updated', {
      station: updatedStation,
      restaurant_id: restaurantId
    });

    console.log(`🔄 Station ${stationId} updated:`, updates);

    res.json({
      success: true,
      station: updatedStation
    });
  } catch (error) {
    console.error("Error updating station:", error);
    res.status(500).json({ 
      error: "SERVER_ERROR", 
      message: "Failed to update station" 
    });
  }
});

/**
 * @swagger
 * /api/v1/restaurants/{restaurantId}/stations/{stationId}/orders:
 *   get:
 *     summary: Get orders assigned to specific station
 *     tags: [Kitchen Stations]
 */
router.get("/:stationId/orders", async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId, stationId } = req.params;
    const { status } = req.query;
    
    // Mock orders for this specific station
    const stationOrders = [
      {
        id: "order-1",
        order_number: "KDS001",
        station_id: stationId,
        restaurant_id: restaurantId,
        status: "preparing",
        priority: "normal",
        items: [
          {
            name: "Pizza Margherita",
            quantity: 2,
            prep_time: 12,
            special_requests: "Extra basil"
          }
        ],
        customer: "Table 5",
        customer_type: "dine_in",
        elapsed_time: 720,
        order_time: "2026-03-15T11:30:00Z",
        created_at: "2026-03-15T11:30:00Z"
      },
      {
        id: "order-2",
        order_number: "KDS004",
        station_id: stationId,
        restaurant_id: restaurantId,
        status: "new",
        priority: "high",
        items: [
          {
            name: "Risotto ai Funghi",
            quantity: 1,
            prep_time: 18,
            special_requests: "No parsley"
          }
        ],
        customer: "Table 3",
        customer_type: "dine_in",
        elapsed_time: 120,
        order_time: "2026-03-15T11:52:00Z",
        created_at: "2026-03-15T11:52:00Z"
      }
    ];

    // Filter by status if provided
    const filteredOrders = status 
      ? stationOrders.filter(order => order.status === status)
      : stationOrders;

    res.json({
      success: true,
      station_id: stationId,
      restaurant_id: restaurantId,
      orders: filteredOrders,
      total_orders: filteredOrders.length,
      filters: { status }
    });
  } catch (error) {
    console.error("Error fetching station orders:", error);
    res.status(500).json({ 
      error: "SERVER_ERROR", 
      message: "Failed to fetch station orders" 
    });
  }
});

/**
 * @swagger
 * /api/v1/restaurants/{restaurantId}/stations/{stationId}/capacity:
 *   put:
 *     summary: Update station capacity and load
 *     tags: [Kitchen Stations]
 */
router.put("/:stationId/capacity", async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId, stationId } = req.params;
    const { estimated_capacity, current_load } = req.body;

    const capacityUpdate = {
      station_id: stationId,
      restaurant_id: restaurantId,
      estimated_capacity,
      current_load,
      capacity_percentage: current_load && estimated_capacity 
        ? Math.round((current_load / estimated_capacity) * 100) 
        : 0,
      updated_at: new Date().toISOString()
    };

    // Real-time update via Socket.IO
    const io = req.app.get('io');
    io.to(`restaurant-${restaurantId}`).emit('station_capacity_updated', capacityUpdate);

    console.log(`📊 Station ${stationId} capacity updated: ${current_load}/${estimated_capacity}`);

    res.json({
      success: true,
      capacity: capacityUpdate
    });
  } catch (error) {
    console.error("Error updating station capacity:", error);
    res.status(500).json({ 
      error: "SERVER_ERROR", 
      message: "Failed to update station capacity" 
    });
  }
});

export default router;