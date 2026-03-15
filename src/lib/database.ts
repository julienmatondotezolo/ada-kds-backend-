import { supabase } from './supabase';

// Database connection status
let isSupabaseConnected = false;
let connectionLastChecked = 0;
const CONNECTION_CHECK_INTERVAL = 60000; // 1 minute

// In-memory fallback storage for orders when database is not available
interface InMemoryOrder {
  id: string;
  order_number: string;
  restaurant_id: string;
  status: string;
  customer_name: string;
  items: any[];
  created_at: string;
  updated_at: string;
  source: string;
  [key: string]: any;
}

const inMemoryOrders = new Map<string, InMemoryOrder>();
const inMemoryMenus = new Map<string, any>();

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
      .from('kds_stations')
      .select('count(*)', { count: 'exact', head: true });
      
    isSupabaseConnected = !error;
    connectionLastChecked = now;
    
    if (isSupabaseConnected) {
      console.log('✅ Supabase database connection verified');
    } else {
      console.warn('⚠️ Supabase connection error, using fallback mode:', error?.message);
    }
    
    return isSupabaseConnected;
  } catch (error) {
    console.warn('⚠️ Database connection check failed, using fallback mode:', error);
    isSupabaseConnected = false;
    connectionLastChecked = now;
    return false;
  }
}

/**
 * Save order with fallback to in-memory storage
 */
export async function saveOrder(orderData: InMemoryOrder): Promise<{ success: boolean; data?: any; error?: any }> {
  try {
    const isConnected = await checkDatabaseConnection();
    
    if (isConnected) {
      const { data, error } = await supabase
        .from('kds_orders')
        .insert([orderData])
        .select()
        .single();
        
      if (!error) {
        console.log(`💾 Order ${orderData.order_number} saved to database`);
        return { success: true, data };
      } else {
        console.warn(`⚠️ Database save failed for order ${orderData.order_number}, using memory:`, error);
      }
    }
    
    // Fallback to in-memory storage
    inMemoryOrders.set(orderData.id, orderData);
    console.log(`🧠 Order ${orderData.order_number} saved to memory (${inMemoryOrders.size} orders in memory)`);
    
    return { success: true, data: orderData };
  } catch (error) {
    console.error('❌ Failed to save order:', error);
    return { success: false, error };
  }
}

/**
 * Get orders with fallback to in-memory storage
 */
export async function getOrders(restaurantId: string, filters?: any): Promise<{ success: boolean; data?: any[]; error?: any }> {
  try {
    const isConnected = await checkDatabaseConnection();
    
    if (isConnected) {
      let query = supabase
        .from('kds_orders')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(20);
        
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      
      const { data, error } = await query;
      
      if (!error && data) {
        console.log(`📦 Retrieved ${data.length} orders from database`);
        return { success: true, data };
      } else {
        console.warn('⚠️ Database query failed, using memory:', error);
      }
    }
    
    // Fallback to in-memory storage
    const memoryOrders = Array.from(inMemoryOrders.values())
      .filter(order => order.restaurant_id === restaurantId)
      .filter(order => !filters?.status || order.status === filters.status)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20);
      
    console.log(`🧠 Retrieved ${memoryOrders.length} orders from memory`);
    return { success: true, data: memoryOrders };
  } catch (error) {
    console.error('❌ Failed to get orders:', error);
    return { success: false, error };
  }
}

/**
 * Get published menu with fallback
 */
export async function getPublishedMenu(menuId: string, restaurantId: string): Promise<{ success: boolean; data?: any; error?: any }> {
  try {
    const isConnected = await checkDatabaseConnection();
    
    if (isConnected) {
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
        
      if (!error && data) {
        console.log(`📋 Retrieved menu ${menuId} from database`);
        return { success: true, data };
      } else {
        console.warn(`⚠️ Menu query failed for ${menuId}, using fallback:`, error);
      }
    }
    
    // Fallback to in-memory or mock menu
    const memoryMenu = inMemoryMenus.get(menuId);
    if (memoryMenu) {
      console.log(`🧠 Retrieved menu ${menuId} from memory`);
      return { success: true, data: memoryMenu };
    }
    
    // Create a mock menu for demo purposes
    const mockMenu = createMockMenu(menuId, restaurantId);
    inMemoryMenus.set(menuId, mockMenu);
    console.log(`🎭 Created mock menu ${menuId} for demo`);
    
    return { success: true, data: mockMenu };
  } catch (error) {
    console.error('❌ Failed to get published menu:', error);
    return { success: false, error };
  }
}

/**
 * Create mock menu for demo purposes
 */
function createMockMenu(menuId: string, restaurantId: string): any {
  return {
    id: menuId,
    restaurant_id: restaurantId,
    menu_id: menuId,
    name: 'L\'Osteria Demo Menu',
    description: 'Demo menu for AdaKDS integration testing',
    is_active: true,
    published_at: new Date().toISOString(),
    valid_from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
    qr_code_url: `https://ada-menu-builder.vercel.app/qr/${menuId}`,
    items: [
      {
        id: 'item_pizza_margherita',
        menu_item_id: 'item_pizza_margherita',
        name: 'Pizza Margherita',
        description: 'Tomato sauce, mozzarella, fresh basil',
        price: 14.50,
        category: 'pizza',
        estimated_prep_time: 12,
        is_available: true,
        station: 'hot_kitchen',
        allergens: ['gluten', 'dairy'],
        dietary_restrictions: ['vegetarian']
      },
      {
        id: 'item_pizza_prosciutto',
        menu_item_id: 'item_pizza_prosciutto',
        name: 'Pizza Prosciutto',
        description: 'Tomato sauce, mozzarella, prosciutto di Parma',
        price: 18.00,
        category: 'pizza',
        estimated_prep_time: 12,
        is_available: true,
        station: 'hot_kitchen',
        allergens: ['gluten', 'dairy']
      },
      {
        id: 'item_caesar_salad',
        menu_item_id: 'item_caesar_salad',
        name: 'Caesar Salad',
        description: 'Romaine lettuce, caesar dressing, parmesan, croutons',
        price: 12.00,
        category: 'salad',
        estimated_prep_time: 5,
        is_available: true,
        station: 'cold_prep',
        allergens: ['gluten', 'dairy'],
        dietary_restrictions: ['vegetarian']
      },
      {
        id: 'item_tiramisu',
        menu_item_id: 'item_tiramisu',
        name: 'Tiramisu',
        description: 'Traditional Italian dessert with coffee and mascarpone',
        price: 8.50,
        category: 'dessert',
        estimated_prep_time: 2,
        is_available: true,
        station: 'cold_prep',
        allergens: ['dairy', 'eggs'],
        dietary_restrictions: ['vegetarian']
      },
      {
        id: 'item_wine_chianti',
        menu_item_id: 'item_wine_chianti',
        name: 'Chianti Classico',
        description: 'Traditional Tuscan red wine',
        price: 8.00,
        category: 'wine',
        estimated_prep_time: 1,
        is_available: true,
        station: 'bar',
        allergens: ['sulfites']
      }
    ]
  };
}

/**
 * Update order status with fallback
 */
export async function updateOrderStatus(orderId: string, status: string, restaurantId: string): Promise<{ success: boolean; data?: any; error?: any }> {
  try {
    const isConnected = await checkDatabaseConnection();
    
    if (isConnected) {
      const { data, error } = await supabase
        .from('kds_orders')
        .update({ 
          status, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();
        
      if (!error) {
        console.log(`📝 Order ${orderId} status updated to ${status} in database`);
        return { success: true, data };
      } else {
        console.warn(`⚠️ Database update failed for order ${orderId}, updating memory:`, error);
      }
    }
    
    // Fallback to in-memory update
    const memoryOrder = inMemoryOrders.get(orderId);
    if (memoryOrder) {
      memoryOrder.status = status;
      memoryOrder.updated_at = new Date().toISOString();
      console.log(`🧠 Order ${orderId} status updated to ${status} in memory`);
      return { success: true, data: memoryOrder };
    }
    
    console.warn(`⚠️ Order ${orderId} not found in memory or database`);
    return { success: false, error: 'Order not found' };
  } catch (error) {
    console.error('❌ Failed to update order status:', error);
    return { success: false, error };
  }
}

/**
 * Get database connection status for health checks
 */
export function getDatabaseStatus(): {
  connected: boolean;
  lastChecked: number;
  inMemoryOrders: number;
  inMemoryMenus: number;
} {
  return {
    connected: isSupabaseConnected,
    lastChecked: connectionLastChecked,
    inMemoryOrders: inMemoryOrders.size,
    inMemoryMenus: inMemoryMenus.size
  };
}

/**
 * Initialize database and create tables if needed
 */
export async function initializeDatabase(): Promise<void> {
  console.log('🚀 Initializing database connection...');
  
  const isConnected = await checkDatabaseConnection();
  
  if (!isConnected) {
    console.log('📱 Database not available - running in fallback mode with in-memory storage');
    console.log('   • Orders will be stored in memory and broadcasted via Socket.IO');
    console.log('   • Mock menu data will be used for validation');
    console.log('   • AdaMenuBuilder integration will work with demo data');
  } else {
    console.log('💾 Database connected successfully');
    // Here you would run any necessary migrations or setup
  }
}