import { Router, Request, Response } from "express";
import { adminLimiter } from "../middleware/rate-limit";
import { requireAuth, requireRestaurantAccess } from "../middleware/auth";
import { KdsStation, stationCategories } from "../lib/supabase";

const router = Router({ mergeParams: true });

router.use(adminLimiter);
// TODO: Uncomment when AdaAuth is working
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
    
    console.log(`Fetching stations for restaurant: ${restaurantId}`);

    // TODO: Implement database query for stations
    // For now, return basic stations based on standard categories
    const stations: KdsStation[] = [
      {
        id: 'hot_kitchen',
        restaurant_id: restaurantId,
        name: 'Hot Kitchen',
        code: 'hot_kitchen',
        description: 'Main cooking station for hot dishes',
        color: '#FF6B6B',
        display_order: 1,
        active: true,
        estimated_capacity: 8,
        current_load: 0,
        categories: stationCategories.hot_kitchen
      },
      {
        id: 'cold_prep',
        restaurant_id: restaurantId,
        name: 'Cold Prep',
        code: 'cold_prep',
        description: 'Cold dishes and salad preparation',
        color: '#4ECDC4',
        display_order: 2,
        active: true,
        estimated_capacity: 6,
        current_load: 0,
        categories: stationCategories.cold_prep
      },
      {
        id: 'grill',
        restaurant_id: restaurantId,
        name: 'Grill',
        code: 'grill',
        description: 'Grilled meats and vegetables',
        color: '#FFD93D',
        display_order: 3,
        active: true,
        estimated_capacity: 4,
        current_load: 0,
        categories: stationCategories.grill
      },
      {
        id: 'bar',
        restaurant_id: restaurantId,
        name: 'Bar',
        code: 'bar',
        description: 'Drinks and beverages',
        color: '#6BCF7F',
        display_order: 4,
        active: true,
        estimated_capacity: 10,
        current_load: 0,
        categories: stationCategories.bar
      }
    ];

    res.json(stations);
  } catch (error) {
    console.error("Error fetching stations:", error);
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch stations" });
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
        message: "Name and code are required"
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
      created_at: new Date().toISOString()
    };

    console.log("New station created:", newStation);
    
    res.status(201).json(newStation);
  } catch (error) {
    console.error("Error creating station:", error);
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to create station" });
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

    console.log(`Station ${stationId} updated:`, updates);

    res.json({
      success: true,
      station_id: stationId,
      restaurant_id: restaurantId,
      updates,
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error updating station:", error);
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to update station" });
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
    
    // Mock orders for this station
    const stationOrders = [
      {
        id: "order-1",
        order_number: "KDS001",
        station_id: stationId,
        status: "preparing",
        items: [
          {
            name: "Margherita Pizza",
            quantity: 2,
            prep_time: 12
          }
        ],
        customer: "Table 5",
        elapsed_time: 720
      }
    ];

    res.json({
      station_id: stationId,
      restaurant_id: restaurantId,
      orders: stationOrders,
      total_orders: stationOrders.length
    });
  } catch (error) {
    console.error("Error fetching station orders:", error);
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch station orders" });
  }
});

export default router;