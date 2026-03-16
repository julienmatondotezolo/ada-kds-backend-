import NodeCache from 'node-cache';

// Cache for 5 minutes (300 seconds)
const menuCache = new NodeCache({ stdTTL: 300 });

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  subcategory?: string;
  estimated_prep_time?: number;
  is_available: boolean;
  allergens?: string[];
  dietary_restrictions?: string[];
  image_url?: string;
  station_assignment?: string; // Station ID assigned in KDS
}

export interface MenuCategory {
  id: string;
  name: string;
  description?: string;
  display_order: number;
  is_active: boolean;
  items?: MenuItem[];
}

export interface MenuData {
  restaurant_id: string;
  menu_id: string;
  name: string;
  is_active: boolean;
  categories: MenuCategory[];
  items: MenuItem[];
}

export class AdaMenuClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl = 'https://api-menu.adasystems.app') {
    this.baseUrl = baseUrl;
    this.apiKey = process.env.ADA_MENU_API_KEY;
  }

  private async makeRequest<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`AdaMenu API error: ${response.status} ${response.statusText}`);
    }

    return await response.json() as T;
  }

  /**
   * Fetch menu items for a restaurant with caching
   */
  async getMenuItems(restaurantId: string): Promise<MenuItem[]> {
    const cacheKey = `menu-items-${restaurantId}`;
    const cached = menuCache.get<MenuItem[]>(cacheKey);
    
    if (cached) {
      console.log(`📦 Using cached menu items for restaurant ${restaurantId}`);
      return cached;
    }

    try {
      console.log(`📡 Fetching menu items for restaurant ${restaurantId} from AdaMenu`);
      const items = await this.makeRequest<MenuItem[]>(`/api/v1/restaurants/${restaurantId}/menu/items`);
      menuCache.set(cacheKey, items);
      return items;
    } catch (error) {
      console.error(`❌ Failed to fetch menu items for restaurant ${restaurantId}:`, error);
      
      // Return fallback data if available
      const fallback = this.getFallbackMenuItems(restaurantId);
      if (fallback.length > 0) {
        console.log(`🔄 Using fallback menu items for restaurant ${restaurantId}`);
        return fallback;
      }
      
      throw error;
    }
  }

  /**
   * Fetch menu categories for a restaurant with caching
   */
  async getMenuCategories(restaurantId: string): Promise<MenuCategory[]> {
    const cacheKey = `menu-categories-${restaurantId}`;
    const cached = menuCache.get<MenuCategory[]>(cacheKey);
    
    if (cached) {
      console.log(`📦 Using cached menu categories for restaurant ${restaurantId}`);
      return cached;
    }

    try {
      console.log(`📡 Fetching menu categories for restaurant ${restaurantId} from AdaMenu`);
      const categories = await this.makeRequest<MenuCategory[]>(`/api/v1/restaurants/${restaurantId}/menu/categories`);
      menuCache.set(cacheKey, categories);
      return categories;
    } catch (error) {
      console.error(`❌ Failed to fetch menu categories for restaurant ${restaurantId}:`, error);
      
      // Return fallback data if available
      const fallback = this.getFallbackCategories(restaurantId);
      if (fallback.length > 0) {
        console.log(`🔄 Using fallback menu categories for restaurant ${restaurantId}`);
        return fallback;
      }
      
      throw error;
    }
  }

  /**
   * Get complete menu data (categories + items)
   */
  async getMenuData(restaurantId: string): Promise<MenuData> {
    const [categories, items] = await Promise.all([
      this.getMenuCategories(restaurantId),
      this.getMenuItems(restaurantId)
    ]);

    // Organize items by category
    const categoriesWithItems = categories.map(category => ({
      ...category,
      items: items.filter(item => item.category === category.name)
    }));

    return {
      restaurant_id: restaurantId,
      menu_id: `menu_${restaurantId}_${Date.now()}`,
      name: "Restaurant Menu",
      is_active: true,
      categories: categoriesWithItems,
      items
    };
  }

  /**
   * Clear cache for a specific restaurant
   */
  clearCache(restaurantId: string): void {
    menuCache.del(`menu-items-${restaurantId}`);
    menuCache.del(`menu-categories-${restaurantId}`);
    console.log(`🗑️ Cleared menu cache for restaurant ${restaurantId}`);
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    menuCache.flushAll();
    console.log(`🗑️ Cleared all menu cache`);
  }

  /**
   * Fallback menu items for demo/testing
   */
  private getFallbackMenuItems(restaurantId: string): MenuItem[] {
    if (restaurantId === 'demo-restaurant' || restaurantId === 'c1cbea71-ece5-4d63-bb12-fe06b03d1140') {
      return [
        {
          id: 'item_pizza_margherita',
          name: 'Pizza Margherita',
          description: 'Classic pizza with tomato, mozzarella, and basil',
          price: 14.50,
          category: 'Pizzas',
          estimated_prep_time: 12,
          is_available: true,
          allergens: ['gluten', 'dairy'],
          dietary_restrictions: ['vegetarian']
        },
        {
          id: 'item_pasta_carbonara',
          name: 'Pasta Carbonara',
          description: 'Traditional Roman pasta with eggs, cheese, and bacon',
          price: 16.00,
          category: 'Pasta',
          estimated_prep_time: 8,
          is_available: true,
          allergens: ['gluten', 'eggs', 'dairy']
        },
        {
          id: 'item_tiramisu',
          name: 'Tiramisu',
          description: 'Classic Italian dessert with mascarpone and coffee',
          price: 8.50,
          category: 'Desserts',
          estimated_prep_time: 2,
          is_available: true,
          allergens: ['eggs', 'dairy', 'alcohol']
        },
        {
          id: 'item_aperol_spritz',
          name: 'Aperol Spritz',
          description: 'Refreshing Italian cocktail with prosecco and Aperol',
          price: 9.00,
          category: 'Drinks',
          estimated_prep_time: 3,
          is_available: true,
          allergens: ['alcohol']
        }
      ];
    }
    
    return [];
  }

  /**
   * Fallback menu categories for demo/testing
   */
  private getFallbackCategories(restaurantId: string): MenuCategory[] {
    if (restaurantId === 'demo-restaurant' || restaurantId === 'c1cbea71-ece5-4d63-bb12-fe06b03d1140') {
      return [
        {
          id: 'cat_pizzas',
          name: 'Pizzas',
          description: 'Wood-fired pizzas',
          display_order: 1,
          is_active: true
        },
        {
          id: 'cat_pasta',
          name: 'Pasta',
          description: 'Fresh pasta dishes',
          display_order: 2,
          is_active: true
        },
        {
          id: 'cat_desserts',
          name: 'Desserts',
          description: 'Sweet endings',
          display_order: 3,
          is_active: true
        },
        {
          id: 'cat_drinks',
          name: 'Drinks',
          description: 'Beverages and cocktails',
          display_order: 4,
          is_active: true
        }
      ];
    }
    
    return [];
  }
}

// Export singleton instance
export const adaMenuClient = new AdaMenuClient();