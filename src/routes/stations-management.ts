import express from 'express';
import { supabase } from '../lib/supabase';

const router = express.Router();

/**
 * @swagger
 * /api/v1/stations:
 *   get:
 *     tags: [Stations]
 *     summary: Get all stations for a restaurant
 *     parameters:
 *       - in: query
 *         name: restaurant_id
 *         schema:
 *           type: string
 *         required: false
 *         description: Restaurant ID (defaults to demo restaurant)
 *     responses:
 *       200:
 *         description: List of stations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 stations:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Station'
 *       500:
 *         description: Server error
 */
router.get('/stations', async (req, res) => {
  try {
    console.log('🔍 Stations endpoint called with query:', req.query);
    console.log('🔑 Current env vars:', {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY ? `${process.env.SUPABASE_SERVICE_ROLE_KEY.slice(0, 20)}...` : 'MISSING'
    });
    
    const restaurantId = req.query.restaurant_id as string || 'c1cbea71-ece5-4d63-bb12-fe06b03d1140';
    console.log('🏪 Using restaurant ID:', restaurantId);

    console.log('📡 Making Supabase query...');
    const { data, error } = await supabase
      .from('kds_stations')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('display_order', { ascending: true });

    console.log('📊 Supabase response - data:', data?.length, 'error:', error);

    if (error) {
      console.error('❌ Database error fetching stations:', error);
      return res.status(500).json({ error: 'Database error: ' + error.message });
    }

    console.log('✅ Sending stations response:', data?.length || 0, 'stations');
    res.json({ stations: data || [] });
  } catch (error) {
    console.error('💥 Catch block error fetching stations:', error);
    res.status(500).json({ error: 'Catch error: ' + (error instanceof Error ? error.message : 'Unknown error') });
  }
});

/**
 * @swagger
 * /api/v1/stations:
 *   post:
 *     tags: [Stations]
 *     summary: Create a new station
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Station name
 *               code:
 *                 type: string
 *                 description: Station code (unique)
 *               color:
 *                 type: string
 *                 description: Station color (hex)
 *               categories:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Food categories handled by this station
 *               active:
 *                 type: boolean
 *                 description: Whether the station is active
 *               restaurant_id:
 *                 type: string
 *                 description: Restaurant ID (optional, defaults to demo)
 *             required:
 *               - name
 *               - code
 *     responses:
 *       201:
 *         description: Station created successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post('/stations', async (req, res) => {
  try {
    const { name, code, color, categories, active, restaurant_id } = req.body;

    // Validate required fields
    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }

    // Check if code already exists for this restaurant
    const restaurantId = restaurant_id || 'c1cbea71-ece5-4d63-bb12-fe06b03d1140';
    
    const { data: existing, error: existingError } = await supabase
      .from('kds_stations')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('code', code)
      .single();

    if (existingError && existingError.code !== 'PGRST116') {
      console.error('Error checking existing station:', existingError);
      return res.status(500).json({ error: 'Database error' });
    }

    if (existing) {
      return res.status(400).json({ error: 'A station with this code already exists' });
    }

    // Get the next display order
    const { data: maxOrder, error: maxOrderError } = await supabase
      .from('kds_stations')
      .select('display_order')
      .eq('restaurant_id', restaurantId)
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    if (maxOrderError && maxOrderError.code !== 'PGRST116') {
      console.error('Error getting max display order:', maxOrderError);
      return res.status(500).json({ error: 'Database error' });
    }

    const nextDisplayOrder = (maxOrder?.display_order || 0) + 1;

    // Create the station
    const { data, error } = await supabase
      .from('kds_stations')
      .insert([{
        restaurant_id: restaurantId,
        name: name.trim(),
        code: code.trim(),
        color: color || '#3B82F6',
        categories: categories || [],
        active: active !== undefined ? active : true,
        display_order: nextDisplayOrder
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating station:', error);
      return res.status(500).json({ error: 'Failed to create station' });
    }

    res.status(201).json({ station: data });
  } catch (error) {
    console.error('Error creating station:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/v1/stations/{id}:
 *   put:
 *     tags: [Stations]
 *     summary: Update a station
 *     parameters:
 *       - in: path
 *         name: id
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
 *               name:
 *                 type: string
 *               code:
 *                 type: string
 *               color:
 *                 type: string
 *               categories:
 *                 type: array
 *                 items:
 *                   type: string
 *               active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Station updated successfully
 *       404:
 *         description: Station not found
 *       500:
 *         description: Server error
 */
router.put('/stations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, color, categories, active } = req.body;

    // Check if station exists
    const { data: existing, error: existingError } = await supabase
      .from('kds_stations')
      .select('*')
      .eq('id', id)
      .single();

    if (existingError || !existing) {
      return res.status(404).json({ error: 'Station not found' });
    }

    // If code is being changed, check for duplicates
    if (code && code !== existing.code) {
      const { data: duplicate, error: duplicateError } = await supabase
        .from('kds_stations')
        .select('id')
        .eq('restaurant_id', existing.restaurant_id)
        .eq('code', code)
        .neq('id', id)
        .single();

      if (duplicateError && duplicateError.code !== 'PGRST116') {
        console.error('Error checking duplicate code:', duplicateError);
        return res.status(500).json({ error: 'Database error' });
      }

      if (duplicate) {
        return res.status(400).json({ error: 'A station with this code already exists' });
      }
    }

    // Update the station
    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (code !== undefined) updateData.code = code.trim();
    if (color !== undefined) updateData.color = color;
    if (categories !== undefined) updateData.categories = categories;
    if (active !== undefined) updateData.active = active;

    const { data, error } = await supabase
      .from('kds_stations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating station:', error);
      return res.status(500).json({ error: 'Failed to update station' });
    }

    res.json({ station: data });
  } catch (error) {
    console.error('Error updating station:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/v1/stations/{id}:
 *   delete:
 *     tags: [Stations]
 *     summary: Delete a station
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Station ID
 *     responses:
 *       200:
 *         description: Station deleted successfully
 *       404:
 *         description: Station not found
 *       500:
 *         description: Server error
 */
router.delete('/stations/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if station exists
    const { data: existing, error: existingError } = await supabase
      .from('kds_stations')
      .select('*')
      .eq('id', id)
      .single();

    if (existingError || !existing) {
      return res.status(404).json({ error: 'Station not found' });
    }

    // Delete the station
    const { error } = await supabase
      .from('kds_stations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting station:', error);
      return res.status(500).json({ error: 'Failed to delete station' });
    }

    res.json({ message: 'Station deleted successfully' });
  } catch (error) {
    console.error('Error deleting station:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/v1/stations/{id}/move:
 *   post:
 *     tags: [Stations]
 *     summary: Move a station up or down in display order
 *     parameters:
 *       - in: path
 *         name: id
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
 *               direction:
 *                 type: string
 *                 enum: [up, down]
 *                 description: Direction to move the station
 *             required:
 *               - direction
 *     responses:
 *       200:
 *         description: Station moved successfully
 *       400:
 *         description: Invalid direction or cannot move further
 *       404:
 *         description: Station not found
 *       500:
 *         description: Server error
 */
router.post('/stations/:id/move', async (req, res) => {
  try {
    const { id } = req.params;
    const { direction } = req.body;

    if (!direction || !['up', 'down'].includes(direction)) {
      return res.status(400).json({ error: 'Direction must be "up" or "down"' });
    }

    // Get the station to move
    const { data: station, error: stationError } = await supabase
      .from('kds_stations')
      .select('*')
      .eq('id', id)
      .single();

    if (stationError || !station) {
      return res.status(404).json({ error: 'Station not found' });
    }

    // Get all stations for this restaurant, ordered by display_order
    const { data: allStations, error: allStationsError } = await supabase
      .from('kds_stations')
      .select('*')
      .eq('restaurant_id', station.restaurant_id)
      .order('display_order', { ascending: true });

    if (allStationsError) {
      console.error('Error fetching all stations:', allStationsError);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!allStations || allStations.length === 0) {
      return res.status(400).json({ error: 'No stations found' });
    }

    const currentIndex = allStations.findIndex(s => s.id === id);
    if (currentIndex === -1) {
      return res.status(404).json({ error: 'Station not found in list' });
    }

    let targetIndex: number;
    if (direction === 'up') {
      targetIndex = currentIndex - 1;
    } else {
      targetIndex = currentIndex + 1;
    }

    // Check bounds
    if (targetIndex < 0 || targetIndex >= allStations.length) {
      return res.status(400).json({ error: `Cannot move station ${direction} further` });
    }

    // Swap display orders
    const currentStation = allStations[currentIndex];
    const targetStation = allStations[targetIndex];

    const { error: updateError1 } = await supabase
      .from('kds_stations')
      .update({ display_order: targetStation.display_order })
      .eq('id', currentStation.id);

    const { error: updateError2 } = await supabase
      .from('kds_stations')
      .update({ display_order: currentStation.display_order })
      .eq('id', targetStation.id);

    if (updateError1 || updateError2) {
      console.error('Error updating display orders:', updateError1 || updateError2);
      return res.status(500).json({ error: 'Failed to update station order' });
    }

    res.json({ message: 'Station moved successfully' });
  } catch (error) {
    console.error('Error moving station:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;