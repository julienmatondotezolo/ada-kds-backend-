import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing Supabase environment variables:');
  console.error('SUPABASE_URL:', !!supabaseUrl ? 'SET' : 'MISSING');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceRoleKey ? 'SET (length: ' + supabaseServiceRoleKey?.length + ')' : 'MISSING');
  throw new Error('Missing required Supabase environment variables. Please check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file.');
}

console.log('🔑 Supabase client initialized with:');
console.log('URL:', supabaseUrl);
console.log('Key:', supabaseServiceRoleKey?.slice(0, 20) + '...');

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// KDS-specific interfaces
export interface KdsOrder {
  id: string;
  order_number: string;
  restaurant_id: string;
  status: 'new' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  station: 'hot_kitchen' | 'cold_prep' | 'grill' | 'bar';
  priority: 'normal' | 'high' | 'urgent';
  items: KdsOrderItem[];
  customer_name: string;
  order_time: string;
  estimated_ready_time?: string;
  elapsed_time: number; // seconds since order creation
  total_prep_time: number; // estimated total prep time in minutes
}

export interface KdsOrderItem {
  name: string;
  quantity: number;
  special_requests?: string;
  estimated_time: number; // minutes
}

export interface KdsStation {
  id: string;
  restaurant_id: string;
  name: string;
  code: string;
  description: string;
  color: string;
  display_order: number;
  active: boolean;
  estimated_capacity: number;
  current_load: number;
  categories: string[];
}

// Transform raw order data to KDS format
export function transformToKdsOrder(order: any): KdsOrder {
  const now = new Date();
  // Handle different date field names (created_time vs created_at)
  const createdTimeStr = order.created_time || order.created_at || order.order_time || new Date().toISOString();
  let orderTime = new Date(createdTimeStr);
  let elapsedSeconds: number;
  
  // Validate the date
  if (isNaN(orderTime.getTime())) {
    console.warn(`Invalid date for order ${order.id}:`, createdTimeStr);
    // Fallback to current time minus 5 minutes for demo
    orderTime = new Date(Date.now() - 5 * 60 * 1000);
    elapsedSeconds = 300; // 5 minutes
  } else {
    elapsedSeconds = Math.floor((now.getTime() - orderTime.getTime()) / 1000);
  }
  
  // Assign station based on menu item categories
  const assignStation = (items: any[]): 'hot_kitchen' | 'cold_prep' | 'grill' | 'bar' => {
    // Default to hot kitchen if no items or no category information
    if (!items || items.length === 0) return 'hot_kitchen';
    
    // Use the first item's category to determine station
    const firstItem = items[0];
    const category = firstItem.category?.toLowerCase();
    
    if (category) {
      switch (category) {
        case 'salad':
        case 'cold_appetizers':
        case 'dessert':
        case 'desserts':
          return 'cold_prep';
        case 'grilled_meat':
        case 'grilled_fish': 
        case 'grilled_vegetables':
        case 'grill':
          return 'grill';
        case 'drinks':
        case 'cocktails':
        case 'wine':
        case 'coffee':
          return 'bar';
        default:
          return 'hot_kitchen';
      }
    }
    
    // Fallback to hot kitchen
    return 'hot_kitchen';
  };

  // Parse meals string to create items array (for legacy compatibility only)
  const parseItems = (meals: string): KdsOrderItem[] => {
    const mealCount = parseInt(meals) || 1;
    
    // Create simple items without mock data
    const items: KdsOrderItem[] = [];
    for (let i = 0; i < mealCount; i++) {
      items.push({
        name: `Item ${i + 1}`,
        quantity: 1,
        estimated_time: 10 // Default time
      });
    }
    return items;
  };

  // Handle items - either from order.items (in-memory) or order.meals (legacy)
  let items: KdsOrderItem[];
  if (order.items && Array.isArray(order.items)) {
    // Use existing items from in-memory orders
    items = order.items.map((item: any) => ({
      name: item.name,
      quantity: item.quantity || 1,
      estimated_time: item.estimated_time || 10,
      special_requests: item.special_requests || ""
    }));
  } else {
    // Fallback to parsing meals string for legacy format
    items = parseItems(order.meals || "1");
  }
  
  const totalPrepTime = items.reduce((sum, item) => sum + item.estimated_time * item.quantity, 0);

  return {
    id: order.id,
    order_number: order.order_number || `ORD${order.id.slice(-3).toUpperCase()}`,
    restaurant_id: order.restaurant_id || 'losteria', // Use actual restaurant instead of demo
    status: mapOrderStatus(order.status),
    station: assignStation(items),
    priority: elapsedSeconds > 1200 ? 'high' : 'normal', // High priority if over 20 minutes
    items,
    customer_name: order.customer_name || order.table || "Unknown Customer",
    order_time: orderTime.toISOString(),
    estimated_ready_time: new Date(orderTime.getTime() + totalPrepTime * 60000).toISOString(),
    elapsed_time: elapsedSeconds,
    total_prep_time: Math.ceil(totalPrepTime)
  };
}

// Map order status from the orders table to KDS status
export function mapOrderStatus(status: string): 'new' | 'preparing' | 'ready' | 'completed' | 'cancelled' {
  switch (status?.toUpperCase()) {
    case 'CREATED':
      return 'new';
    case 'PREPARING':
    case 'IN_PROGRESS':
      return 'preparing';
    case 'READY':
      return 'ready';
    case 'COMPLETED':
    case 'DELIVERED':
      return 'completed';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'new';
  }
}

// NOTE: Stations should be managed through the database, not hardcoded
// This export is kept for reference only - do not use for production data
export const stationCategories = {
  hot_kitchen: ['pizza', 'pasta', 'meat', 'hot_appetizers', 'main_course'],
  cold_prep: ['salad', 'cold_appetizers', 'desserts', 'cold_dishes'],
  grill: ['grilled_meat', 'grilled_fish', 'grilled_vegetables', 'bbq'],
  bar: ['drinks', 'cocktails', 'wine', 'coffee', 'beverages']
};