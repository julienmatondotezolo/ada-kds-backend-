import express from 'express';
import { supabase } from '../lib/supabase';
import { adaMenuClient } from '../lib/ada-menu-client';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * /api/v1/restaurants/{id}/menu/items:
 *   get:
 *     tags: [Menu Integration]
 *     summary: Get menu items from AdaMenu API
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Restaurant ID
 *       - in: query
 *         name: refresh
 *         schema:
 *           type: boolean
 *         description: Force refresh cache
 *     responses:
 *       200:
 *         description: Menu items fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       price:
 *                         type: number
 *                       category:
 *                         type: string
 *                       estimated_prep_time:
 *                         type: number
 *                       is_available:
 *                         type: boolean
 *                       station_assignment:
 *                         type: string
 *                         description: KDS station ID if assigned
 *       500:
 *         description: Failed to fetch menu items
 */
router.get('/:restaurantId/menu/items', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { refresh } = req.query;

    // Clear cache if refresh is requested
    if (refresh === 'true') {
      adaMenuClient.clearCache(restaurantId);
    }

    // Fetch menu items from AdaMenu
    const items = await adaMenuClient.getMenuItems(restaurantId);

    // Get station assignments from KDS database
    const { data: assignments, error: assignmentsError } = await supabase
      .from('menu_item_assignments')
      .select('*')
      .eq('restaurant_id', restaurantId);

    if (assignmentsError) {
      console.error('Error fetching menu item assignments:', assignmentsError);
    }

    // Merge assignments with menu items
    const itemsWithAssignments = items.map(item => {
      const assignment = assignments?.find(a => a.menu_item_id === item.id);
      return {
        ...item,
        station_assignment: assignment?.station_id || null
      };
    });

    res.json({ 
      items: itemsWithAssignments,
      source: 'ada-menu-api',
      cached: refresh !== 'true'
    });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({ 
      error: 'Failed to fetch menu items',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/v1/restaurants/{id}/menu/categories:
 *   get:
 *     tags: [Menu Integration]
 *     summary: Get menu categories from AdaMenu API
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Restaurant ID
 *       - in: query
 *         name: refresh
 *         schema:
 *           type: boolean
 *         description: Force refresh cache
 *     responses:
 *       200:
 *         description: Menu categories fetched successfully
 *       500:
 *         description: Failed to fetch menu categories
 */
router.get('/:restaurantId/menu/categories', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { refresh } = req.query;

    // Clear cache if refresh is requested
    if (refresh === 'true') {
      adaMenuClient.clearCache(restaurantId);
    }

    const categories = await adaMenuClient.getMenuCategories(restaurantId);

    res.json({ 
      categories,
      source: 'ada-menu-api',
      cached: refresh !== 'true'
    });
  } catch (error) {
    console.error('Error fetching menu categories:', error);
    res.status(500).json({ 
      error: 'Failed to fetch menu categories',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/v1/restaurants/{id}/stations/{stationId}/assign-items:
 *   post:
 *     tags: [Menu Assignments]
 *     summary: Assign menu items to a station (Admin/Owner only)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Restaurant ID
 *       - in: path
 *         name: stationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Station ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               menu_item_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of menu item IDs to assign
 *               replace_existing:
 *                 type: boolean
 *                 description: Whether to replace existing assignments or add to them
 *             required:
 *               - menu_item_ids
 *     responses:
 *       200:
 *         description: Items assigned successfully
 *       401:
 *         description: Unauthorized - Admin/Owner access required
 *       404:
 *         description: Station not found
 *       500:
 *         description: Assignment failed
 */
router.post('/:restaurantId/stations/:stationId/assign-items', authMiddleware(['admin', 'owner']), async (req, res) => {
  try {
    const { restaurantId, stationId } = req.params;
    const { menu_item_ids, replace_existing = false } = req.body;

    if (!menu_item_ids || !Array.isArray(menu_item_ids)) {
      return res.status(400).json({ error: 'menu_item_ids must be an array' });
    }

    // Verify station exists
    const { data: station, error: stationError } = await supabase
      .from('kds_stations')
      .select('id, name')
      .eq('id', stationId)
      .eq('restaurant_id', restaurantId)
      .single();

    if (stationError || !station) {
      return res.status(404).json({ error: 'Station not found' });
    }

    // If replacing existing, remove all current assignments for this station
    if (replace_existing) {
      const { error: deleteError } = await supabase
        .from('menu_item_assignments')
        .delete()
        .eq('restaurant_id', restaurantId)
        .eq('station_id', stationId);

      if (deleteError) {
        console.error('Error removing existing assignments:', deleteError);
        return res.status(500).json({ error: 'Failed to remove existing assignments' });
      }
    }

    // Prepare new assignments
    const assignments = menu_item_ids.map(itemId => ({
      restaurant_id: restaurantId,
      station_id: stationId,
      menu_item_id: itemId,
      assigned_at: new Date().toISOString(),
      assigned_by: req.user?.id || 'system'
    }));

    // Insert new assignments (upsert to handle duplicates)
    const { data, error } = await supabase
      .from('menu_item_assignments')
      .upsert(assignments, { 
        onConflict: 'restaurant_id,station_id,menu_item_id',
        ignoreDuplicates: false 
      })
      .select();

    if (error) {
      console.error('Error creating assignments:', error);
      return res.status(500).json({ error: 'Failed to assign items' });
    }

    // Broadcast update to real-time clients
    const io = req.app.get('io');
    io.to(`restaurant-${restaurantId}`).emit('menu_assignments_updated', {
      station_id: stationId,
      station_name: station.name,
      assigned_items: menu_item_ids.length,
      replaced_existing: replace_existing
    });

    res.json({
      success: true,
      assigned: data?.length || 0,
      station: station.name,
      replaced_existing: replace_existing,
      message: `Assigned ${menu_item_ids.length} items to ${station.name}`
    });
  } catch (error) {
    console.error('Error assigning menu items:', error);
    res.status(500).json({ 
      error: 'Assignment failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/v1/restaurants/{id}/stations/{stationId}/items:
 *   get:
 *     tags: [Menu Assignments]
 *     summary: Get menu items assigned to a station
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Restaurant ID
 *       - in: path
 *         name: stationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Station ID
 *     responses:
 *       200:
 *         description: Assigned items retrieved successfully
 *       404:
 *         description: Station not found
 *       500:
 *         description: Failed to retrieve assignments
 */
router.get('/:restaurantId/stations/:stationId/items', async (req, res) => {
  try {
    const { restaurantId, stationId } = req.params;

    // Get station info
    const { data: station, error: stationError } = await supabase
      .from('kds_stations')
      .select('id, name, code, color')
      .eq('id', stationId)
      .eq('restaurant_id', restaurantId)
      .single();

    if (stationError || !station) {
      return res.status(404).json({ error: 'Station not found' });
    }

    // Get assigned menu item IDs
    const { data: assignments, error: assignmentsError } = await supabase
      .from('menu_item_assignments')
      .select('menu_item_id, assigned_at, assigned_by')
      .eq('restaurant_id', restaurantId)
      .eq('station_id', stationId);

    if (assignmentsError) {
      console.error('Error fetching assignments:', assignmentsError);
      return res.status(500).json({ error: 'Failed to fetch assignments' });
    }

    if (!assignments || assignments.length === 0) {
      return res.json({
        station,
        items: [],
        total_assigned: 0
      });
    }

    // Fetch menu items details from AdaMenu
    try {
      const allMenuItems = await adaMenuClient.getMenuItems(restaurantId);
      const assignedItemIds = assignments.map(a => a.menu_item_id);
      const assignedItems = allMenuItems
        .filter(item => assignedItemIds.includes(item.id))
        .map(item => {
          const assignment = assignments.find(a => a.menu_item_id === item.id);
          return {
            ...item,
            assigned_at: assignment?.assigned_at,
            assigned_by: assignment?.assigned_by
          };
        });

      res.json({
        station,
        items: assignedItems,
        total_assigned: assignedItems.length
      });
    } catch (menuError) {
      // If AdaMenu is not available, return just the assignment info
      console.warn('AdaMenu not available, returning assignment IDs only:', menuError);
      res.json({
        station,
        assigned_item_ids: assignments.map(a => a.menu_item_id),
        items: [],
        total_assigned: assignments.length,
        warning: 'Menu details not available - AdaMenu API not accessible'
      });
    }
  } catch (error) {
    console.error('Error fetching station items:', error);
    res.status(500).json({ 
      error: 'Failed to fetch station items',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/v1/restaurants/{id}/stations/{stationId}/items/{itemId}:
 *   delete:
 *     tags: [Menu Assignments]
 *     summary: Remove menu item assignment from station (Admin/Owner only)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Restaurant ID
 *       - in: path
 *         name: stationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Station ID
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *         description: Menu Item ID
 *     responses:
 *       200:
 *         description: Assignment removed successfully
 *       401:
 *         description: Unauthorized - Admin/Owner access required
 *       404:
 *         description: Assignment not found
 *       500:
 *         description: Failed to remove assignment
 */
router.delete('/:restaurantId/stations/:stationId/items/:itemId', authMiddleware(['admin', 'owner']), async (req, res) => {
  try {
    const { restaurantId, stationId, itemId } = req.params;

    // Check if assignment exists
    const { data: existing, error: existingError } = await supabase
      .from('menu_item_assignments')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('station_id', stationId)
      .eq('menu_item_id', itemId)
      .single();

    if (existingError || !existing) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Remove assignment
    const { error } = await supabase
      .from('menu_item_assignments')
      .delete()
      .eq('restaurant_id', restaurantId)
      .eq('station_id', stationId)
      .eq('menu_item_id', itemId);

    if (error) {
      console.error('Error removing assignment:', error);
      return res.status(500).json({ error: 'Failed to remove assignment' });
    }

    // Get station name for response
    const { data: station } = await supabase
      .from('kds_stations')
      .select('name')
      .eq('id', stationId)
      .single();

    // Broadcast update to real-time clients
    const io = req.app.get('io');
    io.to(`restaurant-${restaurantId}`).emit('menu_assignment_removed', {
      station_id: stationId,
      station_name: station?.name || 'Unknown Station',
      menu_item_id: itemId
    });

    res.json({
      success: true,
      message: 'Assignment removed successfully',
      removed: {
        restaurant_id: restaurantId,
        station_id: stationId,
        menu_item_id: itemId
      }
    });
  } catch (error) {
    console.error('Error removing assignment:', error);
    res.status(500).json({ 
      error: 'Failed to remove assignment',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;