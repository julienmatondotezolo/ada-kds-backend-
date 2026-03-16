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
    const response = await fetch(`${ADAAUTH_API_URL}/api/v2/auth/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ token })
    });

    if (!response.ok) {
      console.warn(`[AUTH] Token validation failed: ${response.status}`);
      return null;
    }

    const data: any = await response.json();
    
    if (!data?.valid || !data?.user) {
      console.warn('[AUTH] Invalid token response from AdaAuth');
      return null;
    }

    return {
      id: data.user.id,
      email: data.user.email,
      role: data.user.role || 'staff',
      restaurantIds: data.user.restaurantIds || [],
      permissions: data.user.permissions || [],
      name: data.user.name
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