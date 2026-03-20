import { supabase } from './supabase';

// Database connection status
let isSupabaseConnected = false;
let connectionLastChecked = 0;
const CONNECTION_CHECK_INTERVAL = 60000; // 1 minute

// Restaurant ID mapping for UUID compatibility
const RESTAURANT_UUID_MAP: { [key: string]: string } = {
  'losteria': 'c1cbea71-ece5-4d63-bb12-fe06b03d1140'
  // Add real restaurant UUIDs here as needed
};

// Order interface for database operations  
interface KDSOrder {
  id: string;
  order_number: string;
  restaurant_id: string;
  status: string;
  station?: string;
  priority?: string;
  customer_name: string;
  customer_type?: string;
  order_time: string;
  estimated_ready_time?: string;
  elapsed_time?: number;
  total_prep_time?: number;
  items: any[];
  created_at: string;
  updated_at: string;
  source: string;
  special_instructions?: string;
  [key: string]: any;
}

// Convert restaurant name to UUID
function getRestaurantUUID(restaurantId: string): string {
  return RESTAURANT_UUID_MAP[restaurantId] || restaurantId;
}

/**
 * Check if Supabase is connected and available
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  const now = Date.now();
  
  // Use cached result if checked recently
  if (now - connectionLastChecked < CONNECTION_CHECK_INTERVAL) {
    return isSupabaseConnected;
  }
  
  try {
    // Simple connectivity test - just query a table that we know exists
    const { error } = await supabase
      .from('kds_orders')
      .select('id')
      .limit(1);
      
    isSupabaseConnected = !error;
    connectionLastChecked = now;
    
    if (isSupabaseConnected) {
      console.log('✅ Supabase database connection verified');
    } else {
      console.error('❌ Supabase connection failed:', error?.message);
    }
    
    return isSupabaseConnected;
  } catch (error) {
    console.error('❌ Database connection check failed:', error);
    isSupabaseConnected = false;
    connectionLastChecked = now;
    return false;
  }
}

/**
 * Save order to database (database-only, no fallback)
 */
// First, let's check what columns exist in the kds_orders table
export async function checkTableSchema(): Promise<{ success: boolean; columns?: string[]; error?: any }> {
  try {
    const { data, error } = await supabase
      .from('kds_orders')
      .select('*')
      .limit(1);
      
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows, which is fine
      return { success: false, error };
    }

    // Get the columns from the data structure or extract from error message
    let columns: string[] = [];
    if (data && data.length > 0) {
      columns = Object.keys(data[0]);
    }
    
    return { success: true, columns };
  } catch (error) {
    return { success: false, error };
  }
}

export async function saveOrder(orderData: KDSOrder): Promise<{ success: boolean; data?: any; error?: any }> {
  try {
    const isConnected = await checkDatabaseConnection();

    if (!isConnected) {
      throw new Error('Database connection not available');
    }

    // Only insert columns that exist in the kds_orders table:
    // id, restaurant_id, order_number, status, priority, station, customer_name,
    // customer_type, table_number, source, order_time, estimated_ready_time,
    // items, special_instructions, total_price, created_at, updated_at
    const dbOrderData: Record<string, any> = {
      id: orderData.id,
      order_number: orderData.order_number,
      restaurant_id: getRestaurantUUID(orderData.restaurant_id),
      status: orderData.status || 'new',
      priority: orderData.priority || 'normal',
      station: orderData.station || 'hot_kitchen',
      customer_name: orderData.customer_name,
      customer_type: orderData.customer_type || 'dine_in',
      source: orderData.source || 'qr_code',
      order_time: orderData.order_time || new Date().toISOString(),
      items: orderData.items || [],
      special_instructions: orderData.special_instructions || '',
      created_at: orderData.created_at || new Date().toISOString(),
      updated_at: orderData.updated_at || new Date().toISOString(),
    };

    // Optional fields — only include if present
    if (orderData.table_number) dbOrderData.table_number = orderData.table_number;
    if (orderData.total_price) dbOrderData.total_price = orderData.total_price;
    if (orderData.estimated_ready_time) dbOrderData.estimated_ready_time = orderData.estimated_ready_time;

    console.log(`💾 Saving order ${orderData.order_number} to kds_orders table...`);

    const { data, error } = await supabase
      .from('kds_orders')
      .insert([dbOrderData])
      .select()
      .single();

    if (error) {
      console.error(`❌ Failed to save order ${orderData.order_number}:`, error);
      return { success: false, error };
    }

    console.log(`✅ Order ${orderData.order_number} saved to database successfully`);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Failed to save order:', error);
    return { success: false, error };
  }
}

/**
 * Get orders from database (database-only, no fallback)
 */
export async function getOrders(restaurantId: string, filters?: any): Promise<{ success: boolean; data?: any[]; error?: any }> {
  try {
    const isConnected = await checkDatabaseConnection();
    
    if (!isConnected) {
      throw new Error('Database connection not available');
    }
    
    // Convert restaurant_id to UUID format for database query
    const dbRestaurantId = getRestaurantUUID(restaurantId);
    
    let query = supabase
      .from('kds_orders')
      .select('*')
      .eq('restaurant_id', dbRestaurantId)
      .order('created_at', { ascending: false })
      .limit(50);
      
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('❌ Failed to retrieve orders:', error);
      return { success: false, error };
    }

    console.log(`📦 Retrieved ${data.length} orders from database`);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Failed to get orders:', error);
    return { success: false, error };
  }
}

/**
 * Get published menu from database (database-only, no fallback)
 */
export async function getPublishedMenu(menuId: string, restaurantId: string): Promise<{ success: boolean; data?: any; error?: any }> {
  try {
    const isConnected = await checkDatabaseConnection();
    
    if (!isConnected) {
      throw new Error('Database connection not available');
    }
    
    const { data, error } = await supabase
      .from('published_menus')
      .select(`
        *,
        menu_items:menu_items(*)
      `)
      .eq('menu_id', menuId)
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .single();
      
    if (error) {
      console.error(`❌ Failed to retrieve menu ${menuId}:`, error);
      return { success: false, error };
    }

    console.log(`📋 Retrieved menu ${menuId} from database`);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Failed to get published menu:', error);
    return { success: false, error };
  }
}

/**
 * Update order status in database (database-only, no fallback)
 */
export async function updateOrderStatus(orderId: string, status: string, restaurantId: string): Promise<{ success: boolean; data?: any; error?: any }> {
  try {
    const isConnected = await checkDatabaseConnection();
    
    if (!isConnected) {
      throw new Error('Database connection not available');
    }
    
    // Convert restaurant_id to UUID format for database query
    const dbRestaurantId = getRestaurantUUID(restaurantId);
    
    const { data, error } = await supabase
      .from('kds_orders')
      .update({ 
        status, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', orderId)
      .eq('restaurant_id', dbRestaurantId)
      .select()
      .single();
      
    if (error) {
      console.error(`❌ Failed to update order ${orderId}:`, error);
      return { success: false, error };
    }

    console.log(`📝 Order ${orderId} status updated to ${status} in database`);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Failed to update order status:', error);
    return { success: false, error };
  }
}

/**
 * Get a single order by ID (public — no restaurant scoping)
 */
export async function getOrderById(orderId: string): Promise<{ success: boolean; data?: any; error?: any }> {
  try {
    const isConnected = await checkDatabaseConnection();
    if (!isConnected) throw new Error('Database connection not available');

    const { data, error } = await supabase
      .from('kds_orders')
      .select('id, order_number, status, customer_name, items, estimated_ready_time, created_at, updated_at')
      .eq('id', orderId)
      .single();

    if (error) return { success: false, error };
    return { success: true, data };
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * Get database connection status for health checks
 */
export function getDatabaseStatus(): {
  connected: boolean;
  lastChecked: number;
} {
  return {
    connected: isSupabaseConnected,
    lastChecked: connectionLastChecked
  };
}

/**
 * Initialize database and verify connectivity
 */
export async function initializeDatabase(): Promise<void> {
  console.log('🚀 Initializing database connection...');
  
  const isConnected = await checkDatabaseConnection();
  
  if (!isConnected) {
    console.error('❌ Database connection failed - service will not function properly');
    console.error('   • Orders cannot be saved or retrieved');
    console.error('   • Menu validation will fail'); 
    console.error('   • Please check database configuration and connectivity');
    throw new Error('Database connection required but not available');
  } else {
    console.log('💾 Database connected successfully - service ready');
  }
}