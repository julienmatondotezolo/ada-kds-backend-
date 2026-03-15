import { Request, Response, NextFunction } from 'express';
import { getPublishedMenu } from '../lib/database';

// Extended request type for menu validation
export interface ValidatedRequest extends Request {
  publishedMenu?: PublishedMenu;
  validatedItems?: ValidatedMenuItem[];
}

// Types for menu validation
export interface PublishedMenu {
  id: string;
  restaurant_id: string;
  menu_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  published_at: string;
  valid_from: string;
  valid_until?: string;
  qr_code_url: string;
  items: PublishedMenuItem[];
}

export interface PublishedMenuItem {
  id: string;
  menu_item_id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  estimated_prep_time: number;
  is_available: boolean;
  allergens?: string[];
  dietary_restrictions?: string[];
  station: string;
  ingredients?: string[];
}

export interface ValidatedMenuItem extends PublishedMenuItem {
  quantity: number;
  special_requests?: string;
  total_price: number;
  order_item_id: string;
}

// Allowed order sources for validation
const ALLOWED_ORDER_SOURCES = [
  'http://localhost:5173',
  'https://ada-menu-builder.vercel.app',
  'ada-menu-builder',
  'qr_code'
];

/**
 * Middleware to validate that orders come from published menus only
 */
export const validateMenuSource = async (
  req: ValidatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const { menu_id, source, order_items, referrer } = req.body;

    // Check source validation
    if (source && !isValidOrderSource(source, referrer)) {
      res.status(403).json({
        error: 'INVALID_ORDER_SOURCE',
        message: 'Orders can only be placed through published AdaMenu QR codes',
        allowed_sources: ALLOWED_ORDER_SOURCES
      });
      return;
    }

    // If no menu_id provided, try to validate by other means
    if (!menu_id) {
      console.warn('No menu_id provided in order, allowing for backward compatibility');
      next();
      return;
    }

    // Validate menu exists and is active
    const publishedMenu = await getMenuForValidation(menu_id, restaurantId);
    if (!publishedMenu) {
      res.status(404).json({
        error: 'MENU_NOT_FOUND',
        message: `Published menu ${menu_id} not found or not active for restaurant ${restaurantId}`
      });
      return;
    }

    // Validate menu is still valid (within date range)
    if (!isMenuCurrentlyValid(publishedMenu)) {
      res.status(400).json({
        error: 'MENU_EXPIRED',
        message: 'Menu is no longer valid',
        valid_from: publishedMenu.valid_from,
        valid_until: publishedMenu.valid_until
      });
      return;
    }

    // Validate all order items exist in the published menu
    if (order_items && order_items.length > 0) {
      const validatedItems = await validateOrderItems(order_items, publishedMenu);
      if (!validatedItems.success) {
        res.status(400).json({
          error: 'INVALID_MENU_ITEMS',
          message: validatedItems.message,
          invalid_items: validatedItems.invalidItems
        });
        return;
      }

      // Attach validated data to request
      req.publishedMenu = publishedMenu;
      req.validatedItems = validatedItems.items;
    }

    next();
  } catch (error) {
    console.error('Menu validation error:', error);
    res.status(500).json({
      error: 'VALIDATION_ERROR',
      message: 'Failed to validate menu and items'
    });
  }
};

/**
 * Check if order source is valid
 */
function isValidOrderSource(source: string, referrer?: string): boolean {
  // Check direct source
  if (ALLOWED_ORDER_SOURCES.includes(source)) {
    return true;
  }

  // Check referrer URL
  if (referrer) {
    return ALLOWED_ORDER_SOURCES.some(allowedSource => 
      referrer.startsWith(allowedSource)
    );
  }

  return false;
}

/**
 * Get published menu from database (renamed to avoid conflict)
 */
async function getMenuForValidation(menuId: string, restaurantId: string): Promise<PublishedMenu | null> {
  try {
    const result = await getPublishedMenu(menuId, restaurantId);
    
    if (!result.success) {
      console.error('Error fetching published menu:', result.error);
      return null;
    }

    return result.data as PublishedMenu;
  } catch (error) {
    console.error('Error in getMenuForValidation:', error);
    return null;
  }
}

/**
 * Check if menu is currently valid based on date range
 */
function isMenuCurrentlyValid(menu: PublishedMenu): boolean {
  const now = new Date();
  const validFrom = new Date(menu.valid_from);
  const validUntil = menu.valid_until ? new Date(menu.valid_until) : null;

  return now >= validFrom && (!validUntil || now <= validUntil);
}

/**
 * Validate order items against published menu
 */
async function validateOrderItems(
  orderItems: any[],
  publishedMenu: PublishedMenu
): Promise<{
  success: boolean;
  message?: string;
  items?: ValidatedMenuItem[];
  invalidItems?: string[];
}> {
  const validatedItems: ValidatedMenuItem[] = [];
  const invalidItems: string[] = [];

  for (const orderItem of orderItems) {
    // Find matching menu item
    const menuItem = publishedMenu.items.find(
      item => item.id === orderItem.menu_item_id || item.name === orderItem.name
    );

    if (!menuItem) {
      invalidItems.push(`Item not found in menu: ${orderItem.name || orderItem.menu_item_id}`);
      continue;
    }

    // Check if item is available
    if (!menuItem.is_available) {
      invalidItems.push(`Item not available: ${menuItem.name}`);
      continue;
    }

    // Create validated item
    const validatedItem: ValidatedMenuItem = {
      ...menuItem,
      quantity: orderItem.quantity || 1,
      special_requests: orderItem.special_requests,
      total_price: menuItem.price * (orderItem.quantity || 1),
      order_item_id: orderItem.id || `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    validatedItems.push(validatedItem);
  }

  if (invalidItems.length > 0) {
    return {
      success: false,
      message: `${invalidItems.length} items failed validation`,
      invalidItems
    };
  }

  return {
    success: true,
    items: validatedItems
  };
}

/**
 * Middleware to validate menu item availability in real-time
 */
export const validateItemAvailability = async (
  req: ValidatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { order_items } = req.body;

    if (!order_items || !req.validatedItems) {
      next();
      return;
    }

    // Check real-time availability
    const unavailableItems = [];
    
    for (const item of req.validatedItems) {
      // Here you could add additional real-time checks like:
      // - Stock levels
      // - Kitchen capacity
      // - Time of day restrictions
      // - Special dietary availability
      
      // For now, we'll just re-verify the item is still marked as available
      const currentItem = await getCurrentItemAvailability(item.menu_item_id);
      if (!currentItem || !currentItem.is_available) {
        unavailableItems.push(item.name);
      }
    }

    if (unavailableItems.length > 0) {
      res.status(400).json({
        error: 'ITEMS_UNAVAILABLE',
        message: 'Some items are no longer available',
        unavailable_items: unavailableItems
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Availability validation error:', error);
    next(); // Continue on error to avoid blocking orders
  }
};

/**
 * Get current item availability (simplified for demo)
 */
async function getCurrentItemAvailability(menuItemId: string): Promise<PublishedMenuItem | null> {
  try {
    // In a real implementation, this would check real-time inventory/availability
    // For now, we assume items are available if they were in the validated menu
    console.log(`Checking availability for item: ${menuItemId} (assuming available for demo)`);
    
    // Could integrate with inventory system, kitchen capacity, time-based availability, etc.
    return {
      id: menuItemId,
      menu_item_id: menuItemId,
      name: 'Unknown Item',
      price: 0,
      category: 'unknown',
      estimated_prep_time: 10,
      is_available: true,
      station: 'hot_kitchen'
    } as PublishedMenuItem;
  } catch (error) {
    console.error('Error checking item availability:', error);
    return null;
  }
}

/**
 * Create database tables if they don't exist (for initial setup)
 */
export const createMenuValidationTables = async (): Promise<void> => {
  try {
    // This would typically be done via migrations, but for demo purposes:
    console.log('📋 Menu validation tables setup - would be handled by database migrations');
    
    // Log what tables we expect to exist
    console.log('Expected tables:');
    console.log('- published_menus (id, restaurant_id, menu_id, name, is_active, published_at, valid_from, valid_until, qr_code_url)');
    console.log('- menu_items (id, published_menu_id, name, description, price, category, estimated_prep_time, is_available, station, allergens, dietary_restrictions)');
    console.log('- orders (id, restaurant_id, published_menu_id, status, customer_name, customer_type, source, created_time, updated_time)');
    console.log('- order_items (id, order_id, menu_item_id, name, quantity, special_requests, price)');
  } catch (error) {
    console.error('Error creating menu validation tables:', error);
  }
};