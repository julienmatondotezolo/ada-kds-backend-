export interface Order {
  id: string;
  order_number: string;
  restaurant_id: string;
  status: OrderStatus;
  station: string;
  priority: OrderPriority;
  items: OrderItem[];
  customer_name: string;
  customer_type: CustomerType;
  order_time: string;
  estimated_ready_time: string;
  elapsed_time: number; // seconds
  total_prep_time: number; // minutes
  rush_level: RushLevel;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  special_requests?: string;
  estimated_time: number; // minutes
  category: string;
}

export interface Station {
  id: string;
  restaurant_id: string;
  name: string;
  code: string;
  description?: string;
  color: string;
  display_order: number;
  active: boolean;
  estimated_capacity: number;
  current_load: number;
  categories: string[];
  created_at: string;
  updated_at: string;
}

export interface DisplayConfig {
  restaurant_id: string;
  theme: DisplayTheme;
  refresh_interval: number;
  auto_bump_ready_orders: boolean;
  auto_bump_delay: number;
  show_order_times: boolean;
  show_customer_info: boolean;
  show_special_requests: boolean;
  show_item_quantities: boolean;
  sound_enabled: boolean;
  sound_volume: number;
  notification_sounds: NotificationSounds;
  display_layout: DisplayLayout;
  station_colors: Record<string, string>;
  priority_colors: Record<OrderPriority, string>;
  status_colors: Record<OrderStatus, string>;
  time_warnings: TimeWarnings;
  filters: DisplayFilters;
  created_at: string;
  updated_at: string;
}

export interface NotificationSounds {
  new_order: string;
  order_ready: string;
  order_overdue: string;
  order_cancelled: string;
}

export interface DisplayLayout {
  columns: number;
  max_orders_per_column: number;
  card_size: CardSize;
  show_station_headers: boolean;
  compact_mode: boolean;
}

export interface TimeWarnings {
  yellow_threshold: number;
  red_threshold: number;
  critical_threshold: number;
}

export interface DisplayFilters {
  hide_completed: boolean;
  hide_cancelled: boolean;
  group_by_station: boolean;
  sort_by: SortOption;
}

export interface Alert {
  id: string;
  level: AlertLevel;
  type: AlertType;
  message: string;
  order_id?: string;
  station?: string;
  timestamp: string;
}

export interface StationPerformance {
  station: string;
  orders_completed: number;
  orders_active: number;
  average_time: number;
  efficiency: number;
  capacity_used: number;
  status: StationStatus;
}

export interface Analytics {
  restaurant_id: string;
  current_orders: number;
  orders_in_queue: number;
  orders_preparing: number;
  orders_ready: number;
  average_prep_time: number;
  orders_completed_today: number;
  orders_pending: number;
  orders_in_progress: number;
  rush_level: RushLevel;
  station_performance: StationPerformance[];
  peak_hours: PeakHour[];
  current_date: string;
  last_updated: string;
}

export interface PeakHour {
  hour: string;
  orders: number;
}

// Socket.IO Event Types
export interface SocketEvents {
  // Order events
  order_status_updated: {
    order_id: string;
    old_status: string;
    new_status: OrderStatus;
    updated_at: string;
    restaurant_id: string;
  };
  
  order_bumped: {
    order_id: string;
    old_status: OrderStatus;
    new_status: OrderStatus;
    bump_time: string;
    restaurant_id: string;
  };
  
  // Station events
  station_created: {
    station: Station;
    restaurant_id: string;
  };
  
  station_updated: {
    station: Station;
    restaurant_id: string;
  };
  
  station_capacity_updated: {
    station_id: string;
    restaurant_id: string;
    estimated_capacity: number;
    current_load: number;
    capacity_percentage: number;
    updated_at: string;
  };
  
  // Display events
  display_config_updated: {
    restaurant_id: string;
    config: DisplayConfig;
    updated_at: string;
  };
  
  force_refresh: {
    type: string;
    restaurant_id: string;
    refresh_time: string;
    reason: string;
  };
  
  test_alert: {
    id: string;
    type: string;
    level: AlertLevel;
    message: string;
    timestamp: string;
    restaurant_id: string;
    auto_dismiss?: number;
  };
  
  display_notification: {
    id: string;
    restaurant_id: string;
    title?: string;
    message?: string;
    type: NotificationType;
    duration: number;
    sound: boolean;
    timestamp: string;
  };
}

// Enums and Union Types
export type OrderStatus = "new" | "preparing" | "ready" | "completed" | "cancelled";
export type OrderPriority = "low" | "normal" | "high" | "urgent";
export type CustomerType = "dine_in" | "takeaway" | "delivery";
export type RushLevel = "low" | "moderate" | "high" | "extreme";
export type DisplayTheme = "light" | "dark";
export type CardSize = "small" | "medium" | "large";
export type SortOption = "order_time" | "priority" | "estimated_time";
export type AlertLevel = "info" | "warning" | "error" | "success";
export type AlertType = "order_overdue" | "station_busy" | "system_error" | "test";
export type StationStatus = "normal" | "busy" | "overloaded" | "offline";
export type NotificationType = "info" | "success" | "warning" | "error";

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}