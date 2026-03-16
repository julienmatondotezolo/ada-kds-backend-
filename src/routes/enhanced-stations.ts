import { Router, Request, Response } from "express";
import { requireAuth, requireAdminOrOwner, requireAdmin, auditLogger, hasPermission, AuthUser, demoAuth } from "../middleware/enhanced-auth";
import { supabase } from "../lib/supabase";
import { getSocketManager } from "../lib/socket-manager";
import { adminLimiter } from "../middleware/rate-limit";
import { z } from "zod";

const router = Router({ mergeParams: true });

// Apply middleware
router.use(adminLimiter);

// For production, use actual auth. For development, allow demo mode
if (process.env.NODE_ENV === 'development') {
  // Development: Allow both real auth and demo mode
  router.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.includes('demo-token')) {
      return demoAuth(req, res, next);
    } else if (authHeader) {
      return requireAuth(req, res, next);
    } else {
      // No auth header, use demo mode
      return demoAuth(req, res, next);
    }
  });
} else {
  router.use(requireAuth);
}

router.use(auditLogger);

// Validation schemas
const createStationSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/),
  type: z.enum(['hot_kitchen', 'cold_prep', 'grill', 'bar', 'pizza', 'pasta', 'salad', 'dessert', 'drinks', 'expo']).optional(),
  location: z.string().max(200).optional(),
  capacity: z.number().int().min(1).max(50).optional(),
  description: z.string().max(1000).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  categories: z.array(z.string()).optional(),
  active_status: z.boolean().optional()
});

const updateStationSchema = createStationSchema.partial();

/**
 * @swagger
 * /api/v1/restaurants/{restaurantId}/stations:
 *   get:
 *     summary: Get kitchen stations (All roles)
 *     tags: [Kitchen Stations]
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: include_deleted
 *         schema:
 *           type: boolean
 *         description: Include soft-deleted stations (admin only)
 *     responses:
 *       200:
 *         description: Stations retrieved successfully
 *       403:
 *         description: Access denied
 */
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const includeDeleted = req.query.include_deleted === 'true';
    const user = req.user as AuthUser;

    console.log(`Fetching stations for restaurant: ${restaurantId}, user: ${user?.email}, role: ${user?.role}`);

    // Verify restaurant access
    if (user.restaurant_id !== restaurantId) {
      res.status(403).json({
        error: "RESTAURANT_ACCESS_DENIED",
        message: "Access denied to this restaurant"
      });
      return;
    }

    // Build query
    let query = supabase
      .from('kds_stations')
      .select('*')
      .eq('restaurant_id', restaurantId);

    // Only admins can see deleted stations
    if (!includeDeleted || user.role !== 'admin') {
      query = query.is('deleted_at', null);
    }

    query = query.order('display_order', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('Database error fetching stations:', error);
      res.status(500).json({ 
        error: 'DATABASE_ERROR', 
        message: 'Failed to fetch stations' 
      });
      return;
    }

    console.log(`✅ Returning ${data?.length || 0} stations`);
    res.json({ 
      stations: data || [],
      total: data?.length || 0,
      user_role: user.role,
      permissions: {
        can_create: hasPermission.canCreateStation(user),
        can_edit: hasPermission.canEditStation(user),
        can_delete: hasPermission.canDeleteStation(user),
        can_soft_delete: hasPermission.canSoftDeleteStation(user)
      }
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
 *     summary: Create new kitchen station (Admin/Owner only)
 *     tags: [Kitchen Stations]
 */
router.post("/", requireAdminOrOwner, async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const user = req.user as AuthUser;

    // Validate input
    const validationResult = createStationSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Invalid input data",
        details: validationResult.error.errors
      });
      return;
    }

    const stationData = validationResult.data;

    // Check if code already exists
    const { data: existing, error: existingError } = await supabase
      .from('kds_stations')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('code', stationData.code)
      .is('deleted_at', null)
      .single();

    if (existingError && existingError.code !== 'PGRST116') {
      console.error('Error checking existing station:', existingError);
      res.status(500).json({ 
        error: 'DATABASE_ERROR', 
        message: 'Failed to validate station code' 
      });
      return;
    }

    if (existing) {
      res.status(409).json({
        error: 'DUPLICATE_CODE',
        message: 'A station with this code already exists'
      });
      return;
    }

    // Get next display order
    const { data: maxOrder, error: maxOrderError } = await supabase
      .from('kds_stations')
      .select('display_order')
      .eq('restaurant_id', restaurantId)
      .is('deleted_at', null)
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const nextDisplayOrder = (maxOrder?.display_order || 0) + 1;

    // Create station
    const { data, error } = await supabase
      .from('kds_stations')
      .insert([{
        restaurant_id: restaurantId,
        name: stationData.name.trim(),
        code: stationData.code.toLowerCase().trim(),
        type: stationData.type || 'hot_kitchen',
        location: stationData.location,
        capacity: stationData.capacity || 5,
        description: stationData.description,
        color: stationData.color || '#3B82F6',
        categories: stationData.categories || [],
        active_status: stationData.active_status !== false,
        display_order: nextDisplayOrder,
        created_by: user.id
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating station:', error);
      res.status(500).json({ 
        error: 'DATABASE_ERROR', 
        message: 'Failed to create station' 
      });
      return;
    }

    // Emit real-time update
    const socketManager = getSocketManager(req.app);
    if (socketManager) {
      socketManager.emitStationCreated(restaurantId, data, user.id);
      socketManager.emitAdminNotification(restaurantId, {
        title: 'Station Created',
        message: `${data.name} station has been created`,
        type: 'success',
        userId: user.id
      });
    }

    console.log(`✅ Station created: ${data.name} by ${user.email}`);
    res.status(201).json({ 
      station: data,
      message: 'Station created successfully' 
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
 *     summary: Update kitchen station (Admin/Owner only)
 *     tags: [Kitchen Stations]
 */
router.put("/:stationId", requireAdminOrOwner, async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId, stationId } = req.params;
    const user = req.user as AuthUser;

    // Validate input
    const validationResult = updateStationSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Invalid input data",
        details: validationResult.error.errors
      });
      return;
    }

    const updates = validationResult.data;

    // Check if station exists and is not deleted
    const { data: existing, error: existingError } = await supabase
      .from('kds_stations')
      .select('*')
      .eq('id', stationId)
      .eq('restaurant_id', restaurantId)
      .is('deleted_at', null)
      .single();

    if (existingError || !existing) {
      res.status(404).json({
        error: 'STATION_NOT_FOUND',
        message: 'Station not found'
      });
      return;
    }

    // Check for code conflicts if code is being changed
    if (updates.code && updates.code !== existing.code) {
      const { data: duplicate, error: duplicateError } = await supabase
        .from('kds_stations')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('code', updates.code)
        .neq('id', stationId)
        .is('deleted_at', null)
        .single();

      if (duplicateError && duplicateError.code !== 'PGRST116') {
        console.error('Error checking duplicate code:', duplicateError);
        res.status(500).json({ 
          error: 'DATABASE_ERROR', 
          message: 'Failed to validate station code' 
        });
        return;
      }

      if (duplicate) {
        res.status(409).json({
          error: 'DUPLICATE_CODE',
          message: 'A station with this code already exists'
        });
        return;
      }
    }

    // Update station
    const updateData: any = { 
      ...updates, 
      updated_by: user.id,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('kds_stations')
      .update(updateData)
      .eq('id', stationId)
      .eq('restaurant_id', restaurantId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      console.error('Error updating station:', error);
      res.status(500).json({ 
        error: 'DATABASE_ERROR', 
        message: 'Failed to update station' 
      });
      return;
    }

    // Emit real-time update
    const socketManager = getSocketManager(req.app);
    if (socketManager) {
      socketManager.emitStationUpdated(restaurantId, data, user.id);
    }

    console.log(`✅ Station updated: ${data.name} by ${user.email}`);
    res.json({ 
      station: data,
      message: 'Station updated successfully' 
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
 * /api/v1/restaurants/{restaurantId}/stations/{stationId}:
 *   delete:
 *     summary: Hard delete station (Admin only)
 *     tags: [Kitchen Stations]
 */
router.delete("/:stationId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId, stationId } = req.params;
    const user = req.user as AuthUser;

    // Check if station exists
    const { data: existing, error: existingError } = await supabase
      .from('kds_stations')
      .select('*')
      .eq('id', stationId)
      .eq('restaurant_id', restaurantId)
      .single();

    if (existingError || !existing) {
      res.status(404).json({
        error: 'STATION_NOT_FOUND',
        message: 'Station not found'
      });
      return;
    }

    // Check if station has active orders
    const { data: activeOrders, error: ordersError } = await supabase
      .from('kds_orders')
      .select('id')
      .eq('station_id', stationId)
      .in('status', ['new', 'preparing'])
      .limit(1);

    if (ordersError) {
      console.error('Error checking active orders:', ordersError);
      res.status(500).json({ 
        error: 'DATABASE_ERROR', 
        message: 'Failed to check station orders' 
      });
      return;
    }

    if (activeOrders && activeOrders.length > 0) {
      res.status(409).json({
        error: 'STATION_HAS_ACTIVE_ORDERS',
        message: 'Cannot delete station with active orders. Move orders first or use soft delete.'
      });
      return;
    }

    // Perform hard delete
    const { error } = await supabase
      .from('kds_stations')
      .delete()
      .eq('id', stationId)
      .eq('restaurant_id', restaurantId);

    if (error) {
      console.error('Error deleting station:', error);
      res.status(500).json({ 
        error: 'DATABASE_ERROR', 
        message: 'Failed to delete station' 
      });
      return;
    }

    // Emit real-time update
    const socketManager = getSocketManager(req.app);
    if (socketManager) {
      socketManager.emitStationDeleted(restaurantId, stationId, existing.name, user.id, 'hard');
      socketManager.emitAdminNotification(restaurantId, {
        title: 'Station Deleted',
        message: `${existing.name} station has been permanently deleted`,
        type: 'warning',
        userId: user.id
      });
    }

    console.log(`✅ Station hard deleted: ${existing.name} by ${user.email}`);
    res.json({ 
      message: 'Station permanently deleted',
      deleted_station: { id: existing.id, name: existing.name }
    });
  } catch (error) {
    console.error("Error deleting station:", error);
    res.status(500).json({ 
      error: "SERVER_ERROR", 
      message: "Failed to delete station" 
    });
  }
});

/**
 * @swagger
 * /api/v1/restaurants/{restaurantId}/stations/{stationId}/deactivate:
 *   patch:
 *     summary: Soft delete/deactivate station (Owner can do this)
 *     tags: [Kitchen Stations]
 */
router.patch("/:stationId/deactivate", requireAdminOrOwner, async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId, stationId } = req.params;
    const user = req.user as AuthUser;

    // Check if station exists and is not already deleted
    const { data: existing, error: existingError } = await supabase
      .from('kds_stations')
      .select('*')
      .eq('id', stationId)
      .eq('restaurant_id', restaurantId)
      .is('deleted_at', null)
      .single();

    if (existingError || !existing) {
      res.status(404).json({
        error: 'STATION_NOT_FOUND',
        message: 'Station not found or already deactivated'
      });
      return;
    }

    // Perform soft delete
    const { data, error } = await supabase
      .from('kds_stations')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
        active_status: false
      })
      .eq('id', stationId)
      .eq('restaurant_id', restaurantId)
      .select()
      .single();

    if (error) {
      console.error('Error soft deleting station:', error);
      res.status(500).json({ 
        error: 'DATABASE_ERROR', 
        message: 'Failed to deactivate station' 
      });
      return;
    }

    // Emit real-time update
    const socketManager = getSocketManager(req.app);
    if (socketManager) {
      socketManager.emitStationDeleted(restaurantId, stationId, existing.name, user.id, 'soft');
      socketManager.emitAdminNotification(restaurantId, {
        title: 'Station Deactivated',
        message: `${existing.name} station has been deactivated`,
        type: 'info',
        userId: user.id
      });
    }

    console.log(`✅ Station soft deleted: ${existing.name} by ${user.email}`);
    res.json({ 
      message: 'Station deactivated successfully',
      station: data,
      note: 'Station has been soft deleted and can be restored by an administrator'
    });
  } catch (error) {
    console.error("Error soft deleting station:", error);
    res.status(500).json({ 
      error: "SERVER_ERROR", 
      message: "Failed to deactivate station" 
    });
  }
});

/**
 * @swagger
 * /api/v1/restaurants/{restaurantId}/stations/{stationId}/restore:
 *   patch:
 *     summary: Restore soft-deleted station (Admin only)
 *     tags: [Kitchen Stations]
 */
router.patch("/:stationId/restore", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId, stationId } = req.params;
    const user = req.user as AuthUser;

    // Check if station exists and is soft deleted
    const { data: existing, error: existingError } = await supabase
      .from('kds_stations')
      .select('*')
      .eq('id', stationId)
      .eq('restaurant_id', restaurantId)
      .not('deleted_at', 'is', null)
      .single();

    if (existingError || !existing) {
      res.status(404).json({
        error: 'STATION_NOT_FOUND',
        message: 'Soft-deleted station not found'
      });
      return;
    }

    // Restore station
    const { data, error } = await supabase
      .from('kds_stations')
      .update({
        deleted_at: null,
        updated_by: user.id,
        active_status: true
      })
      .eq('id', stationId)
      .eq('restaurant_id', restaurantId)
      .select()
      .single();

    if (error) {
      console.error('Error restoring station:', error);
      res.status(500).json({ 
        error: 'DATABASE_ERROR', 
        message: 'Failed to restore station' 
      });
      return;
    }

    // Emit real-time update
    const socketManager = getSocketManager(req.app);
    if (socketManager) {
      socketManager.emitStationRestored(restaurantId, data, user.id);
      socketManager.emitAdminNotification(restaurantId, {
        title: 'Station Restored',
        message: `${existing.name} station has been restored`,
        type: 'success',
        userId: user.id
      });
    }

    console.log(`✅ Station restored: ${existing.name} by ${user.email}`);
    res.json({ 
      message: 'Station restored successfully',
      station: data
    });
  } catch (error) {
    console.error("Error restoring station:", error);
    res.status(500).json({ 
      error: "SERVER_ERROR", 
      message: "Failed to restore station" 
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
    const status = req.query.status as string;
    const user = req.user as AuthUser;

    // Build query
    let query = supabase
      .from('kds_orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('station_id', stationId);

    if (status) {
      query = query.eq('status', status);
    }

    query = query.order('created_at', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching station orders:', error);
      res.status(500).json({ 
        error: 'DATABASE_ERROR', 
        message: 'Failed to fetch station orders' 
      });
      return;
    }

    res.json({ 
      orders: data || [],
      total: data?.length || 0,
      station_id: stationId
    });
  } catch (error) {
    console.error("Error fetching station orders:", error);
    res.status(500).json({ 
      error: "SERVER_ERROR", 
      message: "Failed to fetch station orders" 
    });
  }
});

export default router;