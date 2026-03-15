import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing required Supabase environment variables. Please check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file.');
}

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
  const orderTime = new Date(order.created_time);
  const elapsedSeconds = Math.floor((now.getTime() - orderTime.getTime()) / 1000);
  
  // Assign station based on simple logic
  const assignStation = (): 'hot_kitchen' | 'cold_prep' | 'grill' | 'bar' => {
    // This is a simple assignment - in a real system you'd have menu item categorization
    const random = Math.random();
    if (random < 0.4) return 'hot_kitchen';
    if (random < 0.6) return 'cold_prep';
    if (random < 0.8) return 'grill';
    return 'bar';
  };

  // Parse meals string to create items array
  const parseItems = (meals: string): KdsOrderItem[] => {
    const mealCount = parseInt(meals) || 1;
    // Generate mock items based on meal count
    const sampleItems = [
      { name: 'Margherita Pizza', estimated_time: 12 },
      { name: 'Caesar Salad', estimated_time: 5 },
      { name: 'Spaghetti Carbonara', estimated_time: 8 },
      { name: 'Grilled Salmon', estimated_time: 15 },
      { name: 'Tiramisu', estimated_time: 3 },
    ];
    
    const items: KdsOrderItem[] = [];
    for (let i = 0; i < mealCount; i++) {
      const item = sampleItems[i % sampleItems.length];
      items.push({
        name: item.name,
        quantity: 1,
        estimated_time: item.estimated_time
      });
    }
    return items;
  };

  const items = parseItems(order.meals);
  const totalPrepTime = items.reduce((sum, item) => sum + item.estimated_time * item.quantity, 0);

  return {
    id: order.id,
    order_number: `KDS${order.id.slice(-3).toUpperCase()}`,
    restaurant_id: 'demo-restaurant', // Default restaurant ID for demo
    status: mapOrderStatus(order.status),
    station: assignStation(),
    priority: elapsedSeconds > 1200 ? 'high' : 'normal', // High priority if over 20 minutes
    items,
    customer_name: order.table,
    order_time: order.created_time,
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

// Default stations configuration
export const defaultStations: KdsStation[] = [
  {
    id: 'station-1',
    restaurant_id: 'demo-restaurant',
    name: 'Hot Kitchen',
    code: 'hot_kitchen',
    description: 'Main cooking station for hot dishes',
    color: '#FF6B6B',
    display_order: 1,
    active: true,
    estimated_capacity: 8,
    current_load: 0,
    categories: ['pizza', 'pasta', 'meat', 'hot_appetizers']
  },
  {
    id: 'station-2',
    restaurant_id: 'demo-restaurant',
    name: 'Cold Prep',
    code: 'cold_prep',
    description: 'Cold dishes and salad preparation',
    color: '#4ECDC4',
    display_order: 2,
    active: true,
    estimated_capacity: 6,
    current_load: 0,
    categories: ['salad', 'cold_appetizers', 'desserts']
  },
  {
    id: 'station-3',
    restaurant_id: 'demo-restaurant',
    name: 'Grill',
    code: 'grill',
    description: 'Grilled meats and vegetables',
    color: '#FFD93D',
    display_order: 3,
    active: true,
    estimated_capacity: 4,
    current_load: 0,
    categories: ['grilled_meat', 'grilled_fish', 'grilled_vegetables']
  },
  {
    id: 'station-4',
    restaurant_id: 'demo-restaurant',
    name: 'Bar',
    code: 'bar',
    description: 'Drinks and beverages',
    color: '#6BCF7F',
    display_order: 4,
    active: true,
    estimated_capacity: 10,
    current_load: 0,
    categories: ['drinks', 'cocktails', 'wine']
  }
];