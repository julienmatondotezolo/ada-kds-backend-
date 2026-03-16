import { Request, Response, NextFunction } from "express";

// ─── Types ──────────────────────────────────────────────────────────────────
interface User {
  id: string;
  email: string;
  role: string;
  restaurantIds: string[];
  permissions: string[];
  name?: string;
}

export type AuthUser = User;

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
      restaurant?: {
        id: string;
        name: string;
      };
    }
  }
}

// ─── Authentication Utilities ──────────────────────────────────────────────
const ADAAUTH_API_URL = process.env.ADAAUTH_API_URL || 'https://auth.adasystems.app';

async function validateTokenWithAdaAuth(token: string): Promise<User | null> {
  try {
    // Use the user profile endpoint to validate OAuth token
    const response = await fetch(`${ADAAUTH_API_URL}/api/v2/user/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      console.warn(`[AUTH] Token validation failed: ${response.status}`);
      return null;
    }

    const userData: any = await response.json();
    
    if (!userData?.id || !userData?.email) {
      console.warn('[AUTH] Invalid user data from AdaAuth');
      return null;
    }

    return {
      id: userData.id,
      email: userData.email,
      role: userData.role || 'staff',
      restaurantIds: userData.restaurant_ids || [],
      permissions: userData.permissions || [],
      name: userData.name || userData.full_name
    };
  } catch (error) {
    console.error('[AUTH] Error validating token:', error);
    return null;
  }
}

// ─── Middleware Functions ──────────────────────────────────────────────────
/**
 * Require valid JWT token for API access
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide a valid Bearer token'
      });
      return;
    }

    const token = authHeader.substring(7);
    const user = await validateTokenWithAdaAuth(token);
    
    if (!user) {
      res.status(401).json({
        error: 'Invalid token',
        message: 'Token validation failed or token has expired'
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('[AUTH] requireAuth error:', error);
    res.status(500).json({
      error: 'Authentication error',
      message: 'Internal server error during authentication'
    });
  }
};

/**
 * Check restaurant access permissions
 */
export const requireRestaurantAccess = (req: Request, res: Response, next: NextFunction): void => {
  const restaurantId = req.params.restaurantId;
  const user = req.user;

  if (!user) {
    res.status(401).json({
      error: 'Authentication required',
      message: 'User not authenticated'
    });
    return;
  }

  if (!restaurantId) {
    res.status(400).json({
      error: 'Restaurant ID required',
      message: 'Restaurant ID must be provided in the URL'
    });
    return;
  }

  // Check if user has access to this restaurant
  const hasAccess = user.role === 'admin' || 
                   user.role === 'super_admin' ||
                   user.restaurantIds.includes(restaurantId);

  if (!hasAccess) {
    res.status(403).json({
      error: 'Access denied',
      message: `You don't have access to restaurant ${restaurantId}`
    });
    return;
  }

  // Add restaurant info to request
  req.restaurant = {
    id: restaurantId,
    name: restaurantId // TODO: Fetch actual restaurant name from database
  };

  next();
};

/**
 * Require admin role (Admin or Owner)
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const user = req.user;

  if (!user) {
    res.status(401).json({
      error: 'Authentication required',
      message: 'User not authenticated'
    });
    return;
  }

  const adminRoles = ['admin', 'owner', 'super_admin'];
  if (!adminRoles.includes(user.role.toLowerCase())) {
    res.status(403).json({
      error: 'Admin access required',
      message: `This endpoint requires admin privileges. Your role: ${user.role}`
    });
    return;
  }

  next();
};

/**
 * Require owner role (Owner or Super Admin only)
 */
export const requireOwner = (req: Request, res: Response, next: NextFunction): void => {
  const user = req.user;

  if (!user) {
    res.status(401).json({
      error: 'Authentication required',
      message: 'User not authenticated'
    });
    return;
  }

  const ownerRoles = ['owner', 'super_admin'];
  if (!ownerRoles.includes(user.role.toLowerCase())) {
    res.status(403).json({
      error: 'Owner access required',
      message: `This endpoint requires owner privileges. Your role: ${user.role}`
    });
    return;
  }

  next();
};

/**
 * Optional authentication - adds user to request if token provided
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const user = await validateTokenWithAdaAuth(token);
      
      if (user) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Don't fail on optional auth errors
    console.warn('[AUTH] optionalAuth error:', error);
    next();
  }
};

/**
 * Create role-based middleware that requires authentication and specific roles
 * @param allowedRoles Array of roles that can access this endpoint
 */
export const authMiddleware = (allowedRoles: string[]) => {
  return [
    requireAuth,
    (req: Request, res: Response, next: NextFunction): void => {
      const user = req.user;

      if (!user) {
        res.status(401).json({
          error: 'Authentication required',
          message: 'User not authenticated'
        });
        return;
      }

      const userRole = user.role.toLowerCase();
      const normalizedAllowedRoles = allowedRoles.map(role => role.toLowerCase());

      // Super admin has access to everything
      if (userRole === 'super_admin') {
        next();
        return;
      }

      // Check if user's role is in allowed roles
      if (!normalizedAllowedRoles.includes(userRole)) {
        res.status(403).json({
          error: 'Insufficient permissions',
          message: `This endpoint requires one of: ${allowedRoles.join(', ')}. Your role: ${user.role}`
        });
        return;
      }

      next();
    }
  ];
};

// ─── Enhanced Auth Middleware ──────────────────────────────────────────────
/**
 * Require admin or owner role
 */
export const requireAdminOrOwner = authMiddleware(['admin', 'owner']);

/**
 * Demo authentication for development
 */
export const demoAuth = (req: Request, res: Response, next: NextFunction): void => {
  // Mock user for development
  req.user = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'admin@losteria.com',
    role: 'admin',
    restaurantIds: ['c1cbea71-ece5-4d63-bb12-fe06b03d1140'],
    permissions: ['*'],
    name: 'Demo Admin'
  };
  next();
};

/**
 * Simple audit logger
 */
export const auditLogger = (action: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    const timestamp = new Date().toISOString();
    console.log(`[AUDIT] ${timestamp} - User ${user?.email || 'unknown'} attempted ${action}`);
    next();
  };
};

/**
 * Check if user has specific permission
 */
export const hasPermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
      return;
    }

    // Super admin has all permissions
    if (user.role === 'super_admin') {
      next();
      return;
    }

    // Check if user has wildcard permission or specific permission
    if (user.permissions.includes('*') || user.permissions.includes(permission)) {
      next();
      return;
    }

    res.status(403).json({
      error: 'Insufficient permissions',
      message: `Required permission: ${permission}`
    });
  };
};

/**
 * Permission checker for stations
 */
export const stationPermissions = {
  canCreateStation: (user: AuthUser): boolean => {
    if (!user) return false;
    if (user.role === 'super_admin' || user.role === 'admin') return true;
    return user.permissions.includes('*') || user.permissions.includes('station:create');
  },
  
  canEditStation: (user: AuthUser): boolean => {
    if (!user) return false;
    if (user.role === 'super_admin' || user.role === 'admin' || user.role === 'owner') return true;
    return user.permissions.includes('*') || user.permissions.includes('station:edit');
  },
  
  canDeleteStation: (user: AuthUser): boolean => {
    if (!user) return false;
    if (user.role === 'super_admin' || user.role === 'admin') return true;
    return user.permissions.includes('*') || user.permissions.includes('station:delete');
  },
  
  canSoftDeleteStation: (user: AuthUser): boolean => {
    if (!user) return false;
    if (user.role === 'super_admin' || user.role === 'admin' || user.role === 'owner') return true;
    return user.permissions.includes('*') || user.permissions.includes('station:soft_delete');
  }
};