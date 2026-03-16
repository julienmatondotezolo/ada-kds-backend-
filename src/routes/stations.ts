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

    // FAIL-HARD: No hardcoded stations - requires database implementation
    res.status(503).json({
      error: "DATABASE_REQUIRED",
      message: "Stations require database implementation. No hardcoded fallback data provided."
    });
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

    // FAIL-HARD: No console-only station creation - requires database persistence
    res.status(503).json({
      error: "DATABASE_REQUIRED",
      message: "Station creation requires database persistence. Console-only creation not allowed."
    });
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

    // FAIL-HARD: No console-only updates - requires database persistence
    res.status(503).json({
      error: "DATABASE_REQUIRED",
      message: "Station updates require database persistence. Console-only updates not allowed."
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
    
    // FAIL-HARD: No mock station orders - requires database queries
    res.status(503).json({
      error: "DATABASE_REQUIRED",
      message: "Station orders require database queries. No mock data provided."
    });
  } catch (error) {
    console.error("Error fetching station orders:", error);
    res.status(500).json({ error: "SERVER_ERROR", message: "Failed to fetch station orders" });
  }
});

export default router;